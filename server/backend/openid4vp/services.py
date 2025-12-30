"""
OpenID4VP service classes for session management and verification logic.
"""
from typing import Optional, Dict, Any, List
from django.utils import timezone
from django.contrib.auth.models import User
from datetime import timedelta
import json
import logging
import base64
import hashlib
import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import load_der_public_key, load_pem_public_key
from cryptography.exceptions import InvalidSignature
import multibase
from pyld import jsonld
from pyld.jsonld import JsonLdProcessor
import re
from .models import OpenID4VPSession
from organization.models import Organization
from .presentation_definition_service import PresentationDefinitionService


class OpenID4VPSessionService:
    """
    Service class for managing OpenID4VP verification sessions.
    Handles session creation, retrieval, status updates, and cleanup.
    """
    
    @staticmethod
    def create_session(
        presentation_definition_id: str, 
        organization: Organization,
        created_by: User,
        expires_in_minutes: int = 10
    ) -> OpenID4VPSession:
        """
        Create a new OpenID4VP verification session.
        
        Args:
            presentation_definition_id: ID of the presentation definition to use
            organization: Organization initiating the verification
            created_by: User who initiated the session
            expires_in_minutes: Session expiration time in minutes (default: 10)
            
        Returns:
            OpenID4VPSession: The created session instance
        """
        expires_at = timezone.now() + timedelta(minutes=expires_in_minutes)
        
        session = OpenID4VPSession.objects.create(
            organization=organization,
            created_by=created_by,
            presentation_definition_id=presentation_definition_id,
            expires_at=expires_at
        )
        
        return session
    
    @staticmethod
    def get_session(session_id: str) -> Optional[OpenID4VPSession]:
        """
        Retrieve a session by its ID.
        
        Args:
            session_id: UUID string of the session
            
        Returns:
            OpenID4VPSession or None if not found
        """
        try:
            return OpenID4VPSession.objects.get(session_id=session_id)
        except OpenID4VPSession.DoesNotExist:
            return None
    
    @staticmethod
    def get_active_session(session_id: str) -> Optional[OpenID4VPSession]:
        """
        Retrieve an active (non-expired, pending) session by its ID.
        
        Args:
            session_id: UUID string of the session
            
        Returns:
            OpenID4VPSession or None if not found or not active
        """
        session = OpenID4VPSessionService.get_session(session_id)
        if session and session.is_active():
            return session
        return None
    
    @staticmethod
    def can_session_be_used(session_id: str) -> tuple[bool, str]:
        """
        Check if a session can be used for presentation submission or definition retrieval.
        Implements session reuse prevention logic.
        
        Args:
            session_id: UUID string of the session
            
        Returns:
            tuple: (can_be_used: bool, reason: str)
        """
        session = OpenID4VPSessionService.get_session(session_id)
        if not session:
            return False, "Session not found"
        
        # Check if session is expired
        if session.is_expired():
            return False, "Session has expired"
        
        # Check session status - only pending sessions can be used
        if session.status == 'completed':
            return False, "Session has already been completed and cannot be reused"
        elif session.status == 'error':
            return False, "Session is in error state and cannot be reused"
        elif session.status == 'expired':
            return False, "Session has expired"
        elif session.status != 'pending':
            return False, f"Session is not active (status: {session.status})"
        
        return True, "Session is active and can be used"
    
    @staticmethod
    def update_session_status(
        session_id: str, 
        status: str, 
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update session status and verification result.
        Implements session reuse prevention by ensuring completed sessions cannot be reused.
        
        Args:
            session_id: UUID string of the session
            status: New status ('completed', 'error', etc.)
            result: Verification result data (optional)
            error_message: Error message if status is 'error' (optional)
            
        Returns:
            bool: True if update was successful, False otherwise
        """
        session = OpenID4VPSessionService.get_session(session_id)
        if not session:
            return False
        
        # Prevent reuse of completed or error sessions
        if session.status in ['completed', 'error'] and status in ['completed', 'error']:
            # Session is already in a final state, don't allow further updates
            # unless we're just updating the error message or result details
            if session.status == status:
                # Allow updating result or error message for the same status
                if result is not None:
                    session.verification_result = result
                if error_message is not None:
                    session.error_message = error_message
                session.save()
                return True
            else:
                # Don't allow changing from one final state to another
                return False
        
        session.status = status
        if result is not None:
            session.verification_result = result
        if error_message is not None:
            session.error_message = error_message
            
        session.save()
        return True
    
    @staticmethod
    def cleanup_expired_sessions() -> int:
        """
        Clean up expired sessions by updating their status.
        
        Returns:
            int: Number of sessions that were marked as expired
        """
        expired_sessions = OpenID4VPSession.objects.filter(
            status='pending',
            expires_at__lt=timezone.now()
        )
        
        count = expired_sessions.count()
        expired_sessions.update(status='expired')
        
        return count
    
    @staticmethod
    def get_organization_sessions(
        organization: Organization,
        limit: int = 100
    ) -> list[OpenID4VPSession]:
        """
        Get recent sessions for an organization.
        
        Args:
            organization: Organization to get sessions for
            limit: Maximum number of sessions to return
            
        Returns:
            List of OpenID4VPSession instances
        """
        return list(
            OpenID4VPSession.objects.filter(organization=organization)
            .order_by('-created_at')[:limit]
        )


class PresentationVerifier:
    """
    Core presentation verification logic ported from Kotlin implementation.
    Handles Ed25519 signature verification for presentations and credentials.
    """
    
    # Proof type constants matching Kotlin implementation
    ED25519_PROOF_TYPE_2018 = "Ed25519Signature2018"
    ED25519_PROOF_TYPE_2020 = "Ed25519Signature2020"
    JSON_WEB_PROOF_TYPE_2020 = "JsonWebSignature2020"
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.credentials_verifier = CredentialsVerifier()
    
    def verify(self, presentation: str) -> Dict[str, Any]:
        """
        Main verification method matching Kotlin PresentationVerifier.verify()
        
        Args:
            presentation: JSON string of the verifiable presentation
            
        Returns:
            Dict containing verification results
        """
        try:
            presentation_verification_status = self._get_presentation_verification_status(presentation)
            
            presentation_obj = json.loads(presentation)
            verifiable_credentials = presentation_obj.get('verifiableCredential', [])
            
            vc_verification_results = self._get_vc_verification_results(verifiable_credentials)
            
            return {
                'presentation_status': presentation_verification_status,
                'credential_results': vc_verification_results,
                'verified': presentation_verification_status == 'VALID' and 
                          all(vc.get('status') == 'SUCCESS' for vc in vc_verification_results)
            }
            
        except Exception as e:
            self.logger.error(f"Error in presentation verification: {str(e)}")
            raise
    
    def _get_presentation_verification_status(self, presentation: str) -> str:
        """
        Verify presentation signature matching Kotlin getPresentationVerificationStatus()
        
        Args:
            presentation: JSON string of the presentation
            
        Returns:
            String status: 'VALID' or 'INVALID'
        """
        self.logger.info("Received Presentation For Verification - Start")
        
        try:
            # Parse presentation JSON
            presentation_obj = json.loads(presentation)
            
            # Get proof from presentation
            proof = presentation_obj.get('proof')
            if not proof:
                self.logger.error("Presentation is missing proof")
                return 'INVALID'
            
            # Canonicalize the presentation for signature verification
            canonical_hash_bytes = self._canonicalize_presentation(presentation_obj, proof)
            
            # Get verification method and resolve public key
            verification_method = proof.get('verificationMethod')
            if not verification_method:
                self.logger.error("Proof is missing verificationMethod")
                return 'INVALID'
            
            public_key_obj = self._resolve_public_key(verification_method)
            if not public_key_obj:
                self.logger.error(f"Unable to resolve public key for: {verification_method}")
                return 'INVALID'
            
            # Verify signature based on proof type
            proof_type = proof.get('type')
            
            if proof_type == self.ED25519_PROOF_TYPE_2018 and proof.get('jws'):
                return self._verify_ed25519_2018_signature(proof, canonical_hash_bytes, public_key_obj)
            
            elif proof_type == self.ED25519_PROOF_TYPE_2020 and proof.get('proofValue'):
                return self._verify_ed25519_2020_signature(proof, canonical_hash_bytes, public_key_obj)
            
            elif proof_type == self.JSON_WEB_PROOF_TYPE_2020 and proof.get('jws'):
                return self._verify_json_web_signature_2020(proof, canonical_hash_bytes, public_key_obj)
            
            else:
                self.logger.error(f"Unsupported proof type: {proof_type}")
                return 'INVALID'
                
        except Exception as e:
            self.logger.error(f"Error while verifying presentation proof: {str(e)}")
            return 'INVALID'
    
    def _canonicalize_presentation(self, presentation_obj: Dict[str, Any], proof: Dict[str, Any]) -> bytes:
        """
        Canonicalize presentation using URDNA2015 algorithm.
        
        Args:
            presentation_obj: Presentation JSON object
            proof: Proof object from presentation
            
        Returns:
            Canonical hash bytes
        """
        try:
            # Create a copy without the proof for canonicalization
            presentation_copy = presentation_obj.copy()
            if 'proof' in presentation_copy:
                del presentation_copy['proof']
            
            # Create proof options for canonicalization
            proof_options = {
                'type': proof.get('type'),
                'created': proof.get('created'),
                'verificationMethod': proof.get('verificationMethod'),
                'proofPurpose': proof.get('proofPurpose')
            }
            
            # Add challenge and domain if present
            if proof.get('challenge'):
                proof_options['challenge'] = proof['challenge']
            if proof.get('domain'):
                proof_options['domain'] = proof['domain']
            
            # Canonicalize both document and proof options
            document_canonical = jsonld.normalize(
                presentation_copy, 
                {'algorithm': 'URDNA2015', 'format': 'application/n-quads'}
            )
            
            proof_canonical = jsonld.normalize(
                proof_options,
                {'algorithm': 'URDNA2015', 'format': 'application/n-quads'}
            )
            
            # Combine and hash
            combined = proof_canonical.encode('utf-8') + document_canonical.encode('utf-8')
            return hashlib.sha256(combined).digest()
            
        except Exception as e:
            self.logger.error(f"Error in canonicalization: {str(e)}")
            raise
    
    def _resolve_public_key(self, verification_method: str) -> Optional[bytes]:
        """
        Resolve public key from verification method URL.
        
        Args:
            verification_method: DID URL or key identifier
            
        Returns:
            Public key bytes or None if resolution fails
        """
        try:
            # Handle different DID methods
            if verification_method.startswith('did:web:'):
                return self._resolve_did_web_key(verification_method)
            elif verification_method.startswith('did:key:'):
                return self._resolve_did_key(verification_method)
            else:
                # Try to resolve as generic DID
                return self._resolve_generic_did_key(verification_method)
                
        except Exception as e:
            self.logger.error(f"Error resolving public key: {str(e)}")
            return None
    
    def _resolve_did_web_key(self, did_url: str) -> Optional[bytes]:
        """
        Resolve public key from did:web method.
        
        Args:
            did_url: DID web URL
            
        Returns:
            Public key bytes or None
        """
        try:
            # Extract domain from did:web URL
            # Format: did:web:domain.com:path#key-id
            parts = did_url.split('#')
            did_part = parts[0]
            key_id = parts[1] if len(parts) > 1 else None
            
            # Convert did:web to HTTPS URL
            did_components = did_part.split(':')
            if len(did_components) < 3:
                return None
            
            domain_path = ':'.join(did_components[2:])
            domain_parts = domain_path.split(':')
            domain = domain_parts[0]
            path = '/'.join(domain_parts[1:]) if len(domain_parts) > 1 else ''
            
            # Construct DID document URL
            if path:
                did_doc_url = f"https://{domain}/{path}/did.json"
            else:
                did_doc_url = f"https://{domain}/.well-known/did.json"
            
            # Fetch DID document
            response = requests.get(did_doc_url, timeout=10)
            response.raise_for_status()
            
            did_doc = response.json()
            
            # Extract public key
            verification_methods = did_doc.get('verificationMethod', [])
            for vm in verification_methods:
                if not key_id or vm.get('id', '').endswith(key_id):
                    return self._extract_public_key_from_verification_method(vm)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error resolving did:web key: {str(e)}")
            return None
    
    def _resolve_did_key(self, did_url: str) -> Optional[bytes]:
        """
        Resolve public key from did:key method.
        
        Args:
            did_url: DID key URL
            
        Returns:
            Public key bytes or None
        """
        try:
            # Format: did:key:z6Mk... where z6Mk is multibase encoded key
            if not did_url.startswith('did:key:'):
                return None
            
            key_part = did_url[8:]  # Remove 'did:key:' prefix
            
            # Handle fragment identifier
            if '#' in key_part:
                key_part = key_part.split('#')[0]
            
            # Decode multibase encoded key
            decoded = multibase.decode(key_part)
            
            # For Ed25519 keys, the first two bytes are the multicodec prefix (0xed01)
            if len(decoded) >= 34 and decoded[0:2] == b'\xed\x01':
                return decoded[2:]  # Return the 32-byte Ed25519 public key
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error resolving did:key: {str(e)}")
            return None
    
    def _resolve_generic_did_key(self, verification_method: str) -> Optional[bytes]:
        """
        Resolve public key from generic DID method.
        
        Args:
            verification_method: DID URL
            
        Returns:
            Public key bytes or None
        """
        try:
            # This is a simplified implementation
            # In production, you'd use a proper DID resolver
            self.logger.warning(f"Generic DID resolution not fully implemented for: {verification_method}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error resolving generic DID: {str(e)}")
            return None
    
    def _extract_public_key_from_verification_method(self, vm: Dict[str, Any]) -> Optional[bytes]:
        """
        Extract public key bytes from verification method object.
        
        Args:
            vm: Verification method object from DID document
            
        Returns:
            Public key bytes or None
        """
        try:
            # Handle different key formats
            if 'publicKeyMultibase' in vm:
                decoded = multibase.decode(vm['publicKeyMultibase'])
                # For Ed25519, remove multicodec prefix if present
                if len(decoded) >= 34 and decoded[0:2] == b'\xed\x01':
                    return decoded[2:]
                return decoded
            
            elif 'publicKeyBase58' in vm:
                # Base58 decode (simplified - would need proper base58 library)
                import base58
                return base58.b58decode(vm['publicKeyBase58'])
            
            elif 'publicKeyJwk' in vm:
                jwk = vm['publicKeyJwk']
                if jwk.get('kty') == 'OKP' and jwk.get('crv') == 'Ed25519':
                    # Decode base64url encoded key
                    x = jwk.get('x', '')
                    # Add padding if needed
                    x += '=' * (4 - len(x) % 4)
                    return base64.urlsafe_b64decode(x)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error extracting public key: {str(e)}")
            return None
    
    def _verify_ed25519_2018_signature(self, proof: Dict[str, Any], canonical_hash: bytes, public_key_bytes: bytes) -> str:
        """
        Verify Ed25519Signature2018 proof.
        
        Args:
            proof: Proof object
            canonical_hash: Canonicalized hash bytes
            public_key_bytes: Public key bytes
            
        Returns:
            'VALID' or 'INVALID'
        """
        try:
            jws = proof.get('jws')
            if not jws:
                return 'INVALID'
            
            # Parse JWS (header.payload.signature)
            parts = jws.split('.')
            if len(parts) != 3:
                return 'INVALID'
            
            header = parts[0]
            signature_b64 = parts[2]
            
            # Decode signature
            signature = base64.urlsafe_b64decode(signature_b64 + '=' * (4 - len(signature_b64) % 4))
            
            # Create signing input (header + canonical hash)
            header_bytes = header.encode('utf-8')
            signing_input = header_bytes + b'.' + base64.urlsafe_b64encode(canonical_hash).rstrip(b'=')
            
            # Verify signature
            return self._verify_ed25519_signature(public_key_bytes, signing_input, signature)
            
        except Exception as e:
            self.logger.error(f"Error verifying Ed25519Signature2018: {str(e)}")
            return 'INVALID'
    
    def _verify_ed25519_2020_signature(self, proof: Dict[str, Any], canonical_hash: bytes, public_key_bytes: bytes) -> str:
        """
        Verify Ed25519Signature2020 proof.
        
        Args:
            proof: Proof object
            canonical_hash: Canonicalized hash bytes
            public_key_bytes: Public key bytes
            
        Returns:
            'VALID' or 'INVALID'
        """
        try:
            proof_value = proof.get('proofValue')
            if not proof_value:
                return 'INVALID'
            
            # Decode multibase encoded signature
            signature = multibase.decode(proof_value)
            
            # Verify signature directly against canonical hash
            return self._verify_ed25519_signature(public_key_bytes, canonical_hash, signature)
            
        except Exception as e:
            self.logger.error(f"Error verifying Ed25519Signature2020: {str(e)}")
            return 'INVALID'
    
    def _verify_json_web_signature_2020(self, proof: Dict[str, Any], canonical_hash: bytes, public_key_bytes: bytes) -> str:
        """
        Verify JsonWebSignature2020 proof.
        
        Args:
            proof: Proof object
            canonical_hash: Canonicalized hash bytes
            public_key_bytes: Public key bytes
            
        Returns:
            'VALID' or 'INVALID'
        """
        try:
            jws = proof.get('jws')
            if not jws:
                return 'INVALID'
            
            # Parse JWS
            parts = jws.split('.')
            if len(parts) != 3:
                return 'INVALID'
            
            header_b64 = parts[0]
            signature_b64 = parts[2]
            
            # Decode and verify header algorithm
            header_bytes = base64.urlsafe_b64decode(header_b64 + '=' * (4 - len(header_b64) % 4))
            header = json.loads(header_bytes)
            
            if header.get('alg') != 'EdDSA':
                self.logger.error(f"Unsupported JWS algorithm: {header.get('alg')}")
                return 'INVALID'
            
            # Decode signature
            signature = base64.urlsafe_b64decode(signature_b64 + '=' * (4 - len(signature_b64) % 4))
            
            # Create signing input
            header_encoded = header_b64.encode('utf-8')
            canonical_encoded = base64.urlsafe_b64encode(canonical_hash).rstrip(b'=')
            signing_input = header_encoded + b'.' + canonical_encoded
            
            # Verify signature
            return self._verify_ed25519_signature(public_key_bytes, signing_input, signature)
            
        except Exception as e:
            self.logger.error(f"Error verifying JsonWebSignature2020: {str(e)}")
            return 'INVALID'
    
    def _verify_ed25519_signature(self, public_key_bytes: bytes, message: bytes, signature: bytes) -> str:
        """
        Verify Ed25519 signature using cryptography library.
        
        Args:
            public_key_bytes: 32-byte Ed25519 public key
            message: Message that was signed
            signature: 64-byte signature
            
        Returns:
            'VALID' or 'INVALID'
        """
        try:
            # Create Ed25519 public key object
            public_key = Ed25519PublicKey.from_public_bytes(public_key_bytes)
            
            # Verify signature
            public_key.verify(signature, message)
            return 'VALID'
            
        except InvalidSignature:
            return 'INVALID'
        except Exception as e:
            self.logger.error(f"Error in Ed25519 signature verification: {str(e)}")
            return 'INVALID'
    
    def _get_vc_verification_results(self, verifiable_credentials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Verify individual credentials matching Kotlin getVCVerificationResults()
        
        Args:
            verifiable_credentials: List of credential objects
            
        Returns:
            List of verification results
        """
        results = []
        
        for i, credential in enumerate(verifiable_credentials):
            try:
                # Convert credential to JSON string for verification
                credential_json = json.dumps(credential)
                
                # Verify the credential
                verification_result = self.credentials_verifier.verify(credential_json)
                
                # Map to result format
                status = 'SUCCESS' if verification_result.get('verified', False) else 'INVALID'
                
                results.append({
                    'credential': credential_json,
                    'status': status,
                    'index': i,
                    'credential_id': credential.get('id', f'credential-{i}')
                })
                
            except Exception as e:
                self.logger.error(f"Error verifying credential {i}: {str(e)}")
                results.append({
                    'credential': json.dumps(credential),
                    'status': 'INVALID',
                    'index': i,
                    'credential_id': credential.get('id', f'credential-{i}'),
                    'error': str(e)
                })
        
        return results


class CredentialsVerifier:
    """
    Individual credential verification logic.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.presentation_verifier = None  # Avoid circular reference
    
    def verify(self, credential_json: str) -> Dict[str, Any]:
        """
        Verify a single credential.
        
        Args:
            credential_json: JSON string of the credential
            
        Returns:
            Dict containing verification result
        """
        try:
            credential = json.loads(credential_json)
            
            # Basic structure validation
            if not self._validate_credential_structure(credential):
                return {'verified': False, 'error': 'Invalid credential structure'}
            
            # Verify credential signature
            proof = credential.get('proof')
            if not proof:
                return {'verified': False, 'error': 'Credential missing proof'}
            
            # Use similar verification logic as presentation
            if not self.presentation_verifier:
                self.presentation_verifier = PresentationVerifier()
            
            # Create a temporary presentation wrapper for verification
            temp_presentation = {
                '@context': credential.get('@context', []),
                'type': ['VerifiablePresentation'],
                'verifiableCredential': [credential],
                'proof': proof
            }
            
            result = self.presentation_verifier._get_presentation_verification_status(
                json.dumps(temp_presentation)
            )
            
            return {
                'verified': result == 'VALID',
                'status': result,
                'credential_id': credential.get('id')
            }
            
        except Exception as e:
            self.logger.error(f"Error verifying credential: {str(e)}")
            return {'verified': False, 'error': str(e)}
    
    def _validate_credential_structure(self, credential: Dict[str, Any]) -> bool:
        """
        Validate basic credential structure.
        
        Args:
            credential: Credential object
            
        Returns:
            True if structure is valid
        """
        required_fields = ['@context', 'type', 'issuer', 'credentialSubject']
        return all(field in credential for field in required_fields)
class OpenID4VPVerificationService:
    """
    Service class for verifying OpenID4VP presentations using the ported verification logic.
    Now uses the actual cryptographic verification algorithms ported from Kotlin.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.presentation_definition_service = PresentationDefinitionService()
        self.presentation_verifier = PresentationVerifier()
    
    async def verify_presentation(
        self,
        presentation_data: Dict[str, Any],
        session: OpenID4VPSession,
        presentation_definition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Verify a submitted verifiable presentation against the requested definition.
        Now uses actual cryptographic verification.
        
        Args:
            presentation_data: The submitted verifiable presentation
            session: The OpenID4VP session
            presentation_definition: The requested presentation definition
            
        Returns:
            Dict containing verification results
        """
        try:
            # Step 1: Validate presentation structure and format
            self._validate_presentation_structure(presentation_data)
            
            # Step 2: Verify presentation signature using actual cryptographic verification
            presentation_json = json.dumps(presentation_data)
            crypto_verification_result = self.presentation_verifier.verify(presentation_json)
            
            # Step 3: Validate against presentation definition (enhanced)
            definition_validation = self.validate_presentation_completeness(
                presentation_data, presentation_definition, 
                session.organization.config if hasattr(session.organization, 'config') else None
            )
            
            # Step 4: Check revocation status for all credentials
            revocation_results = await self._check_revocation_status(
                presentation_data.get('verifiableCredential', [])
            )
            
            # Combine all results
            overall_verified = (
                crypto_verification_result.get('verified', False) and
                definition_validation.get('valid', False) and
                all(rr.get('valid', True) for rr in revocation_results)  # Default to True if no revocation check
            )
            
            verification_result = {
                'verified': overall_verified,
                'presentation_signature': {
                    'verified': crypto_verification_result.get('verified', False),
                    'status': crypto_verification_result.get('presentation_status', 'INVALID'),
                    'algorithm': 'Ed25519'  # Based on our implementation
                },
                'credentials': self._format_credential_results(crypto_verification_result.get('credential_results', [])),
                'definition_validation': definition_validation,
                'revocation_status': revocation_results,
                'session_id': str(session.session_id),
                'verified_at': timezone.now().isoformat(),
                'verification_method': 'openid4vp',
                'organization_id': session.organization.id,
                'verified_by': session.created_by.id,
                'credential_count': len(presentation_data.get('verifiableCredential', [])),
                'error_details': []
            }
            
            # Collect any error details
            if not overall_verified:
                error_details = []
                
                if not crypto_verification_result.get('verified', False):
                    error_details.append(f"Cryptographic verification failed: {crypto_verification_result.get('presentation_status', 'Unknown error')}")
                
                # Check individual credential verification results
                for cr in crypto_verification_result.get('credential_results', []):
                    if cr.get('status') != 'SUCCESS':
                        error_details.append(f"Credential {cr.get('index', 'unknown')} verification failed: {cr.get('error', 'Signature verification failed')}")
                
                if not definition_validation.get('valid', False):
                    error_details.append(f"Presentation definition validation failed: {definition_validation.get('error', 'Unknown error')}")
                
                for i, rr in enumerate(revocation_results):
                    if not rr.get('valid', True):
                        error_details.append(f"Credential {i} revocation check failed: {rr.get('errorMessage', 'Credential is revoked')}")
                
                verification_result['error_details'] = error_details
            
            return verification_result
            
        except Exception as e:
            self.logger.error(f"Error during presentation verification: {str(e)}")
            return {
                'verified': False,
                'error': str(e),
                'session_id': str(session.session_id),
                'verified_at': timezone.now().isoformat(),
                'verification_method': 'openid4vp',
                'organization_id': session.organization.id,
                'verified_by': session.created_by.id,
                'credential_count': 0,
                'error_details': [f"Verification service error: {str(e)}"]
            }
    
    def _format_credential_results(self, credential_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format credential verification results for API response.
        
        Args:
            credential_results: Raw credential verification results
            
        Returns:
            Formatted credential results
        """
        formatted_results = []
        
        for cr in credential_results:
            try:
                credential_data = json.loads(cr.get('credential', '{}'))
                
                formatted_results.append({
                    'index': cr.get('index', 0),
                    'verified': cr.get('status') == 'SUCCESS',
                    'credential_id': cr.get('credential_id'),
                    'credential_type': credential_data.get('type', []),
                    'issuer': credential_data.get('issuer'),
                    'subject': credential_data.get('credentialSubject', {}),
                    'issuance_date': credential_data.get('issuanceDate'),
                    'expiration_date': credential_data.get('expirationDate'),
                    'verification_status': cr.get('status'),
                    'error': cr.get('error')
                })
            except Exception as e:
                formatted_results.append({
                    'index': cr.get('index', 0),
                    'verified': False,
                    'error': f"Error formatting credential result: {str(e)}"
                })
        
        return formatted_results
    
    def _validate_presentation_structure(self, presentation_data: Dict[str, Any]) -> None:
        """
        Validate basic presentation structure and required fields.
        
        Args:
            presentation_data: The presentation to validate
            
        Raises:
            ValueError: If presentation structure is invalid
        """
        if not isinstance(presentation_data, dict):
            raise ValueError("Presentation must be a JSON object")
        
        # Check required fields
        required_fields = ['@context', 'type', 'verifiableCredential']
        for field in required_fields:
            if field not in presentation_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Validate type
        presentation_types = presentation_data.get('type', [])
        if isinstance(presentation_types, str):
            presentation_types = [presentation_types]
        
        if 'VerifiablePresentation' not in presentation_types:
            raise ValueError("Presentation type must include 'VerifiablePresentation'")
        
        # Validate credentials array
        credentials = presentation_data.get('verifiableCredential', [])
        if not isinstance(credentials, list) or len(credentials) == 0:
            raise ValueError("Presentation must contain at least one verifiable credential")
    
    
    async def _verify_presentation_signature(
        self, 
        presentation_data: Dict[str, Any], 
        session: OpenID4VPSession
    ) -> Dict[str, Any]:
        """
        Legacy method - now redirects to the actual cryptographic verification.
        
        Args:
            presentation_data: The presentation to verify
            session: The OpenID4VP session
            
        Returns:
            Dict containing signature verification results
        """
        try:
            presentation_json = json.dumps(presentation_data)
            result = self.presentation_verifier.verify(presentation_json)
            
            return {
                'verified': result.get('verified', False),
                'status': result.get('presentation_status', 'INVALID'),
                'algorithm': 'Ed25519'
            }
            
        except Exception as e:
            return {
                'verified': False,
                'error': f'Signature verification error: {str(e)}',
                'status': 'INVALID'
            }
    
    async def _verify_credentials(self, credentials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Legacy method - now uses actual cryptographic verification.
        
        Args:
            credentials: List of verifiable credentials to verify
            
        Returns:
            List of verification results for each credential
        """
        results = []
        credentials_verifier = CredentialsVerifier()
        
        for i, credential in enumerate(credentials):
            try:
                credential_json = json.dumps(credential)
                verification_result = credentials_verifier.verify(credential_json)
                
                results.append({
                    'index': i,
                    'verified': verification_result.get('verified', False),
                    'credential_id': credential.get('id', f'credential-{i}'),
                    'credential_type': credential.get('type', []),
                    'issuer': credential.get('issuer'),
                    'subject': credential.get('credentialSubject', {}),
                    'issuance_date': credential.get('issuanceDate'),
                    'expiration_date': credential.get('expirationDate'),
                    'error': verification_result.get('error')
                })
                
            except Exception as e:
                results.append({
                    'index': i,
                    'verified': False,
                    'error': f'Credential verification error: {str(e)}',
                    'credential_id': credential.get('id', f'credential-{i}'),
                    'credential_type': credential.get('type', [])
                })
        
        return results
    
    def _validate_against_definition(
        self, 
        presentation_data: Dict[str, Any], 
        presentation_definition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate that the submitted presentation matches the requested definition.
        Uses the comprehensive validation methods from PresentationDefinitionService.
        
        Args:
            presentation_data: The submitted presentation
            presentation_definition: The requested presentation definition
            
        Returns:
            Dict containing validation results
        """
        try:
            # Use the comprehensive validation from PresentationDefinitionService
            validation_result = self.presentation_definition_service.validate_presentation_against_definition(
                presentation_data, presentation_definition
            )
            
            # Convert to our expected format
            return {
                'valid': validation_result.get('valid', False),
                'error': '; '.join(validation_result.get('errors', [])) if validation_result.get('errors') else None,
                'descriptor_results': self._get_detailed_descriptor_results(
                    presentation_data, presentation_definition
                )
            }
            
        except Exception as e:
            return {
                'valid': False,
                'error': f'Definition validation error: {str(e)}',
                'descriptor_results': []
            }
    
    def _get_detailed_descriptor_results(
        self, 
        presentation_data: Dict[str, Any], 
        presentation_definition: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Get detailed validation results for each input descriptor.
        
        Args:
            presentation_data: The submitted presentation
            presentation_definition: The requested presentation definition
            
        Returns:
            List of detailed descriptor validation results
        """
        results = []
        input_descriptors = presentation_definition.get('input_descriptors', [])
        credentials = presentation_data.get('verifiableCredential', [])
        
        for descriptor in input_descriptors:
            descriptor_id = descriptor.get('id', 'unknown')
            matching_credentials = []
            validation_errors = []
            
            # Check each credential against this descriptor
            for i, credential in enumerate(credentials):
                try:
                    if self.presentation_definition_service._validate_credential_against_descriptor(
                        credential, descriptor
                    ):
                        matching_credentials.append({
                            'index': i,
                            'credential_id': credential.get('id', f'credential-{i}'),
                            'credential_type': credential.get('type', [])
                        })
                    else:
                        # Get specific validation errors for this credential
                        credential_errors = self._get_credential_descriptor_errors(credential, descriptor)
                        if credential_errors:
                            validation_errors.extend([
                                f"Credential {i}: {error}" for error in credential_errors
                            ])
                except Exception as e:
                    validation_errors.append(f"Credential {i}: Validation error - {str(e)}")
            
            results.append({
                'descriptor_id': descriptor_id,
                'required': True,  # Assume all descriptors are required
                'satisfied': len(matching_credentials) > 0,
                'matching_credentials': matching_credentials,
                'validation_errors': validation_errors
            })
        
        return results
    
    def _get_credential_descriptor_errors(
        self, 
        credential: Dict[str, Any], 
        descriptor: Dict[str, Any]
    ) -> List[str]:
        """
        Get specific validation errors for a credential against a descriptor.
        
        Args:
            credential: The credential to validate
            descriptor: The input descriptor
            
        Returns:
            List of validation error messages
        """
        errors = []
        
        try:
            # Check format requirements
            format_requirements = descriptor.get("format", {})
            if format_requirements and not self.presentation_definition_service._validate_credential_format(
                credential, format_requirements
            ):
                errors.append("Credential format does not meet requirements")
            
            # Check field constraints
            constraints = descriptor.get("constraints", {})
            fields = constraints.get("fields", [])
            
            for field_constraint in fields:
                try:
                    if not self.presentation_definition_service._validate_field_constraint(
                        credential, field_constraint
                    ):
                        path = field_constraint.get("path", ["unknown"])
                        errors.append(f"Field constraint not satisfied for path: {path}")
                except Exception as e:
                    path = field_constraint.get("path", ["unknown"])
                    errors.append(f"Field constraint evaluation error for path {path}: {str(e)}")
        
        except Exception as e:
            errors.append(f"Descriptor validation error: {str(e)}")
        
        return errors
    
    def validate_presentation_completeness(
        self,
        presentation_data: Dict[str, Any],
        presentation_definition: Dict[str, Any],
        organization_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform comprehensive validation of presentation completeness and correctness.
        
        Args:
            presentation_data: The submitted presentation
            presentation_definition: The requested presentation definition
            organization_config: Optional organization configuration for issuer constraints
            
        Returns:
            Dict containing comprehensive validation results
        """
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'credential_validations': [],
            'issuer_validations': [],
            'type_validations': []
        }
        
        try:
            credentials = presentation_data.get('verifiableCredential', [])
            input_descriptors = presentation_definition.get('input_descriptors', [])
            
            # Validate each credential individually
            for i, credential in enumerate(credentials):
                credential_validation = self._validate_individual_credential(
                    credential, i, input_descriptors, organization_config
                )
                validation_result['credential_validations'].append(credential_validation)
                
                if not credential_validation['valid']:
                    validation_result['valid'] = False
                    validation_result['errors'].extend([
                        f"Credential {i}: {error}" for error in credential_validation['errors']
                    ])
            
            # Validate that all required descriptors are satisfied
            descriptor_satisfaction = self._validate_descriptor_satisfaction(
                credentials, input_descriptors
            )
            
            if not descriptor_satisfaction['all_satisfied']:
                validation_result['valid'] = False
                validation_result['errors'].extend(descriptor_satisfaction['errors'])
            
            # Add warnings for any issues that don't fail validation
            validation_result['warnings'].extend(descriptor_satisfaction.get('warnings', []))
            
        except Exception as e:
            validation_result['valid'] = False
            validation_result['errors'].append(f"Validation error: {str(e)}")
        
        return validation_result
    
    def _validate_individual_credential(
        self,
        credential: Dict[str, Any],
        index: int,
        input_descriptors: List[Dict[str, Any]],
        organization_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Validate an individual credential against all applicable descriptors.
        
        Args:
            credential: The credential to validate
            index: Index of the credential in the presentation
            input_descriptors: List of input descriptors from presentation definition
            organization_config: Optional organization configuration
            
        Returns:
            Dict containing validation results for this credential
        """
        result = {
            'index': index,
            'credential_id': credential.get('id', f'credential-{index}'),
            'valid': True,
            'errors': [],
            'warnings': [],
            'matches_descriptors': []
        }
        
        # Check if credential matches any descriptor
        matches_any_descriptor = False
        
        for descriptor in input_descriptors:
            descriptor_id = descriptor.get('id', 'unknown')
            
            try:
                if self.presentation_definition_service._validate_credential_against_descriptor(
                    credential, descriptor
                ):
                    matches_any_descriptor = True
                    result['matches_descriptors'].append(descriptor_id)
                    
                    # Additional issuer validation if organization config is provided
                    if organization_config:
                        credential_types = credential.get('type', [])
                        if isinstance(credential_types, str):
                            credential_types = [credential_types]
                        
                        # Find the main credential type (not VerifiableCredential)
                        main_type = None
                        for cred_type in credential_types:
                            if cred_type != 'VerifiableCredential':
                                main_type = cred_type
                                break
                        
                        if main_type:
                            issuer_valid = self.presentation_definition_service.validate_issuer_constraints(
                                credential, main_type, organization_config
                            )
                            if not issuer_valid:
                                result['warnings'].append(
                                    f"Issuer may not be trusted for credential type {main_type}"
                                )
                
            except Exception as e:
                result['errors'].append(f"Error validating against descriptor {descriptor_id}: {str(e)}")
        
        if not matches_any_descriptor:
            result['valid'] = False
            result['errors'].append("Credential does not match any required input descriptor")
        
        return result
    
    def _validate_descriptor_satisfaction(
        self,
        credentials: List[Dict[str, Any]],
        input_descriptors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate that all required input descriptors are satisfied by the credentials.
        
        Args:
            credentials: List of submitted credentials
            input_descriptors: List of required input descriptors
            
        Returns:
            Dict containing descriptor satisfaction results
        """
        result = {
            'all_satisfied': True,
            'errors': [],
            'warnings': [],
            'descriptor_results': []
        }
        
        for descriptor in input_descriptors:
            descriptor_id = descriptor.get('id', 'unknown')
            satisfied = False
            matching_credentials = []
            
            # Check if any credential satisfies this descriptor
            for i, credential in enumerate(credentials):
                try:
                    if self.presentation_definition_service._validate_credential_against_descriptor(
                        credential, descriptor
                    ):
                        satisfied = True
                        matching_credentials.append({
                            'index': i,
                            'credential_id': credential.get('id', f'credential-{i}')
                        })
                except Exception as e:
                    result['warnings'].append(
                        f"Error checking credential {i} against descriptor {descriptor_id}: {str(e)}"
                    )
            
            descriptor_result = {
                'descriptor_id': descriptor_id,
                'satisfied': satisfied,
                'matching_credentials': matching_credentials
            }
            
            result['descriptor_results'].append(descriptor_result)
            
            if not satisfied:
                result['all_satisfied'] = False
                result['errors'].append(f"Input descriptor '{descriptor_id}' is not satisfied by any credential")
        
        return result
    
    def validate_credential_types(
        self,
        presentation_data: Dict[str, Any],
        expected_types: List[str]
    ) -> Dict[str, Any]:
        """
        Validate that the presentation contains credentials of expected types.
        
        Args:
            presentation_data: The submitted presentation
            expected_types: List of expected credential types
            
        Returns:
            Dict containing type validation results
        """
        result = {
            'valid': True,
            'errors': [],
            'found_types': [],
            'missing_types': [],
            'unexpected_types': []
        }
        
        credentials = presentation_data.get('verifiableCredential', [])
        found_types = set()
        
        # Collect all credential types from the presentation
        for credential in credentials:
            credential_types = credential.get('type', [])
            if isinstance(credential_types, str):
                credential_types = [credential_types]
            
            for cred_type in credential_types:
                if cred_type != 'VerifiableCredential':  # Skip the base type
                    found_types.add(cred_type)
        
        result['found_types'] = list(found_types)
        
        # Check for missing expected types
        expected_set = set(expected_types)
        missing_types = expected_set - found_types
        if missing_types:
            result['valid'] = False
            result['missing_types'] = list(missing_types)
            result['errors'].extend([
                f"Missing expected credential type: {cred_type}" for cred_type in missing_types
            ])
        
        # Check for unexpected types (optional warning)
        unexpected_types = found_types - expected_set
        if unexpected_types:
            result['unexpected_types'] = list(unexpected_types)
            # Note: Unexpected types don't invalidate the presentation
        
        return result
    
    async def _check_revocation_status(self, credentials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Check revocation status for all credentials.
        
        Args:
            credentials: List of credentials to check
            
        Returns:
            List of revocation check results
        """
        results = []
        
        for i, credential in enumerate(credentials):
            try:
                # TODO: Integrate with actual SDK RevocationChecker
                # For now, perform basic revocation status checks
                
                credential_status = credential.get('credentialStatus')
                if not credential_status:
                    # No revocation status declared - assume valid
                    results.append({
                        'index': i,
                        'valid': True,
                        'status': 0,
                        'purpose': 'none',
                        'message': 'No revocation status declared'
                    })
                    continue
                
                # Check if it's a bitstring status list entry
                status_entries = credential_status if isinstance(credential_status, list) else [credential_status]
                bitstring_entry = None
                
                for entry in status_entries:
                    entry_type = entry.get('type', [])
                    if isinstance(entry_type, str):
                        entry_type = [entry_type]
                    
                    if 'BitstringStatusListEntry' in entry_type or 'statusListIndex' in entry:
                        bitstring_entry = entry
                        break
                
                if not bitstring_entry:
                    # Different status method - assume valid for now
                    results.append({
                        'index': i,
                        'valid': True,
                        'status': 0,
                        'purpose': 'unknown',
                        'message': 'Non-bitstring status method'
                    })
                    continue
                
                # For now, assume all credentials are not revoked
                # In production, this would call the actual SDK RevocationChecker
                results.append({
                    'index': i,
                    'valid': True,
                    'status': 0,
                    'purpose': bitstring_entry.get('statusPurpose', 'revocation'),
                    'message': 'Revocation check passed (simulated)'
                })
                
            except Exception as e:
                results.append({
                    'index': i,
                    'valid': False,
                    'status': 1,
                    'purpose': 'unknown',
                    'errorCode': 'STATUS_VERIFICATION_ERROR',
                    'errorMessage': f'Revocation check error: {str(e)}'
                })
        
        return results