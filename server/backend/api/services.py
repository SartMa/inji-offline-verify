# server/backend/api/services.py
from django.contrib.auth.models import User
from .models import VerificationLog
from openid4vp.models import OpenID4VPSession
from typing import Dict, Any, Optional
import uuid


class VerificationLogService:
    """
    Service class for creating and managing verification logs.
    Provides unified interface for both offline QR and OpenID4VP verification logging.
    """
    
    @staticmethod
    def create_openid4vp_log(
        session: OpenID4VPSession,
        verification_result: Dict[str, Any],
        verified_by: User,
        vc_hash: Optional[str] = None
    ) -> VerificationLog:
        """
        Create a verification log entry for OpenID4VP verification.
        
        Args:
            session: The OpenID4VP session associated with this verification
            verification_result: The verification result data from the verification process
            verified_by: The user who performed the verification
            vc_hash: Optional hash of the verified credential
            
        Returns:
            VerificationLog: The created verification log entry
        """
        # Map verification result status to VerificationLog status
        verification_status = VerificationLogService._map_verification_status(verification_result)
        
        # Extract credential subject data from verification result
        credential_subject = VerificationLogService._extract_credential_subject(verification_result)
        
        # Extract error message if verification failed
        error_message = verification_result.get('error_message') if verification_status != VerificationLog.VerificationStatus.SUCCESS else None
        
        # Create the verification log entry
        verification_log = VerificationLog.objects.create(
            id=uuid.uuid4(),  # Generate unique ID
            verification_status=verification_status,
            verified_at=session.created_at,  # Use session creation time as verification time
            vc_hash=vc_hash,
            credential_subject=credential_subject,
            error_message=error_message,
            organization=session.organization,
            verified_by=verified_by,
            verification_method=VerificationLog.VerificationMethod.OPENID4VP,
            openid4vp_session=session
        )
        
        return verification_log
    
    @staticmethod
    def create_offline_qr_log(
        verification_result: Dict[str, Any],
        verified_by: User,
        organization,
        vc_hash: Optional[str] = None,
        verified_at=None
    ) -> VerificationLog:
        """
        Create a verification log entry for offline QR verification.
        Maintains compatibility with existing offline verification logging.
        
        Args:
            verification_result: The verification result data from the verification process
            verified_by: The user who performed the verification
            organization: The organization the user belongs to
            vc_hash: Optional hash of the verified credential
            verified_at: When the verification occurred (defaults to now)
            
        Returns:
            VerificationLog: The created verification log entry
        """
        from django.utils import timezone
        
        # Map verification result status to VerificationLog status
        verification_status = VerificationLogService._map_verification_status(verification_result)
        
        # Extract credential subject data from verification result
        credential_subject = VerificationLogService._extract_credential_subject(verification_result)
        
        # Extract error message if verification failed
        error_message = verification_result.get('error_message') if verification_status != VerificationLog.VerificationStatus.SUCCESS else None
        
        # Create the verification log entry
        verification_log = VerificationLog.objects.create(
            id=uuid.uuid4(),  # Generate unique ID
            verification_status=verification_status,
            verified_at=verified_at or timezone.now(),
            vc_hash=vc_hash,
            credential_subject=credential_subject,
            error_message=error_message,
            organization=organization,
            verified_by=verified_by,
            verification_method=VerificationLog.VerificationMethod.OFFLINE_QR,
            openid4vp_session=None  # No session for offline verification
        )
        
        return verification_log
    
    @staticmethod
    def _map_verification_status(verification_result: Dict[str, Any]) -> str:
        """
        Map verification result to VerificationLog status choices.
        
        Args:
            verification_result: The verification result data
            
        Returns:
            str: The mapped verification status
        """
        # Check if verification was successful
        if verification_result.get('valid', False) or verification_result.get('status') == 'success':
            return VerificationLog.VerificationStatus.SUCCESS
        
        # Check for specific failure reasons
        error_type = verification_result.get('error_type', '').lower()
        if 'expired' in error_type:
            return VerificationLog.VerificationStatus.EXPIRED
        elif 'revoked' in error_type:
            return VerificationLog.VerificationStatus.REVOKED
        elif 'suspended' in error_type:
            return VerificationLog.VerificationStatus.SUSPENDED
        else:
            return VerificationLog.VerificationStatus.FAILED
    
    @staticmethod
    def _extract_credential_subject(verification_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract credential subject data from verification result.
        
        Args:
            verification_result: The verification result data
            
        Returns:
            Dict[str, Any]: The extracted credential subject data
        """
        # Try to extract credential subject from various possible locations
        credential_subject = {}
        
        # Check if credentials are present in the result
        credentials = verification_result.get('credentials', [])
        if credentials and isinstance(credentials, list) and len(credentials) > 0:
            # Take the first credential's subject
            first_credential = credentials[0]
            if isinstance(first_credential, dict):
                credential_subject = first_credential.get('credentialSubject', {})
        
        # Fallback to direct credentialSubject field
        if not credential_subject:
            credential_subject = verification_result.get('credentialSubject', {})
        
        # Fallback to subject field
        if not credential_subject:
            credential_subject = verification_result.get('subject', {})
        
        return credential_subject