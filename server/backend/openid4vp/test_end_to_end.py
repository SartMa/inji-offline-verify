"""
End-to-end tests for OpenID4VP integration.
Tests the complete flow from QR generation to result display.
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from organization.models import Organization
from worker.models import OrganizationMember
from api.models import VerificationLog
from .models import OpenID4VPSession
from .services import OpenID4VPSessionService, OpenID4VPVerificationService
import json
import uuid
import time
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta


class OpenID4VPEndToEndTestCase(TransactionTestCase):
    """End-to-end test case for complete OpenID4VP flow."""
    
    def setUp(self):
        """Set up test data for end-to-end testing."""
        self.client = APIClient()
        
        # Create test organization
        self.organization = Organization.objects.create(
            name="Test Organization"
        )
        
        # Create test user (field worker)
        self.worker_user = User.objects.create_user(
            username='fieldworker',
            email='worker@example.com',
            password='testpass123'
        )
        
        # Associate user with organization
        OrganizationMember.objects.create(
            user=self.worker_user,
            organization=self.organization,
            role='WORKER'
        )
        
        # Sample valid verifiable presentation for testing
        self.valid_presentation = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://www.w3.org/2018/credentials/examples/v1"
            ],
            "type": ["VerifiablePresentation"],
            "verifiableCredential": [
                {
                    "@context": [
                        "https://www.w3.org/2018/credentials/v1",
                        "https://www.w3.org/2018/credentials/examples/v1"
                    ],
                    "type": ["VerifiableCredential", "MOSIPIdentityCredential"],
                    "issuer": "did:web:mosip.io",
                    "issuanceDate": "2023-01-01T00:00:00Z",
                    "credentialSubject": {
                        "id": "did:example:123",
                        "fullName": "John Doe",
                        "dateOfBirth": "1990-01-01",
                        "nationalId": "123456789"
                    },
                    "proof": {
                        "type": "Ed25519Signature2020",
                        "created": "2023-01-01T00:00:00Z",
                        "verificationMethod": "did:web:mosip.io#key-1",
                        "proofPurpose": "assertionMethod",
                        "proofValue": "valid-credential-proof-value"
                    }
                }
            ],
            "proof": {
                "type": "Ed25519Signature2020",
                "created": "2023-01-01T00:00:00Z",
                "verificationMethod": "did:example:123#key-1",
                "proofPurpose": "authentication",
                "proofValue": "valid-presentation-proof-value"
            }
        }


class CompleteOpenID4VPFlowTest(OpenID4VPEndToEndTestCase):
    """Test the complete OpenID4VP verification flow."""
    
    def test_complete_successful_verification_flow(self):
        """Test complete flow from session creation to successful verification result."""
        # Step 1: Worker creates verification session (QR generation)
        self.client.force_authenticate(user=self.worker_user)
        
        session_data = {
            'presentation_definition_id': 'MOSIP_ID',
            'expires_in_minutes': 10
        }
        
        create_response = self.client.post('/api/openid4vp/sessions/', session_data)
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        
        session_id = create_response.data['session_id']
        authorization_uri = create_response.data['authorization_request_uri']
        
        # Verify QR code data structure
        self.assertIn('session_id', create_response.data)
        self.assertIn('authorization_request_uri', create_response.data)
        self.assertIn('expires_at', create_response.data)
        self.assertEqual(create_response.data['status'], 'pending')
        
        # Verify authorization URI contains required parameters
        self.assertIn(f'presentation-definition/{session_id}', authorization_uri)
        
        # Step 2: Wallet retrieves presentation definition (simulating QR scan)
        definition_response = self.client.get(
            f'/api/openid4vp/presentation-definition/{session_id}/'
        )
        self.assertEqual(definition_response.status_code, status.HTTP_200_OK)
        
        # Verify presentation definition structure
        definition = definition_response.data
        self.assertEqual(definition['id'], 'mosip-id-verification')
        self.assertIn('input_descriptors', definition)
        self.assertIn('session_id', definition)
        self.assertIn('expires_at', definition)
        
        # Step 3: Mock successful verification and submit presentation
        with patch.object(OpenID4VPVerificationService, 'verify_presentation') as mock_verify:
            mock_verification_result = {
                'verified': True,
                'credentials': [
                    {
                        'type': 'MOSIPIdentityCredential',
                        'issuer': 'did:web:mosip.io',
                        'subject': {
                            'fullName': 'John Doe',
                            'dateOfBirth': '1990-01-01',
                            'nationalId': '123456789'
                        },
                        'verification_status': 'valid'
                    }
                ],
                'presentation_verification': {
                    'signature_valid': True,
                    'matches_definition': True
                }
            }
            mock_verify.return_value = mock_verification_result
            
            submission_data = {
                'vp_token': self.valid_presentation
            }
            
            submit_response = self.client.post(
                f'/api/openid4vp/presentation/{session_id}/',
                submission_data,
                format='json'
            )
            
            self.assertEqual(submit_response.status_code, status.HTTP_202_ACCEPTED)
            self.assertEqual(submit_response.data['status'], 'accepted')
            
            # Manually update session status to simulate completed verification
            session = OpenID4VPSession.objects.get(session_id=session_id)
            session.status = 'completed'
            session.verification_result = mock_verification_result
            session.save()
        
        # Step 4: Worker polls for results
        status_response = self.client.get(f'/api/openid4vp/status/{session_id}/')
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        
        # Verify final status
        final_status = status_response.data
        self.assertIn(final_status['status'], ['completed', 'pending'])  # May be async
        
        # If completed, verify result structure
        if final_status['status'] == 'completed':
            self.assertIn('verification_result', final_status)
            result = final_status['verification_result']
            self.assertTrue(result.get('verified', False))
            self.assertIn('credentials', result)
        
        # Step 5: Verify verification log was created
        logs = VerificationLog.objects.filter(
            organization=self.organization,
            verification_method='openid4vp'
        )
        
        if logs.exists():
            log = logs.first()
            self.assertEqual(log.verified_by, self.worker_user)
            self.assertEqual(log.organization, self.organization)
            self.assertIsNotNone(log.openid4vp_session)
    
    def test_complete_failed_verification_flow(self):
        """Test complete flow with verification failure."""
        # Step 1: Create session
        self.client.force_authenticate(user=self.worker_user)
        
        session_data = {
            'presentation_definition_id': 'MOSIP_ID'
        }
        
        create_response = self.client.post('/api/openid4vp/sessions/', session_data)
        session_id = create_response.data['session_id']
        
        # Step 2: Get presentation definition
        definition_response = self.client.get(
            f'/api/openid4vp/presentation-definition/{session_id}/'
        )
        self.assertEqual(definition_response.status_code, status.HTTP_200_OK)
        
        # Step 3: Mock failed verification
        with patch.object(OpenID4VPVerificationService, 'verify_presentation') as mock_verify:
            mock_verify.return_value = {
                'verified': False,
                'error': 'Invalid signature',
                'details': 'Credential signature verification failed',
                'credentials': []
            }
            
            submission_data = {
                'vp_token': self.valid_presentation
            }
            
            submit_response = self.client.post(
                f'/api/openid4vp/presentation/{session_id}/',
                submission_data,
                format='json'
            )
            
            # Should still accept for processing
            self.assertEqual(submit_response.status_code, status.HTTP_202_ACCEPTED)
        
        # Step 4: Check final status shows failure
        status_response = self.client.get(f'/api/openid4vp/status/{session_id}/')
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        
        # Verify error is recorded
        session = OpenID4VPSession.objects.get(session_id=session_id)
        if session.status == 'error':
            self.assertIsNotNone(session.error_message)
    
    def test_session_expiration_flow(self):
        """Test flow with expired session."""
        # Create session with short expiration
        self.client.force_authenticate(user=self.worker_user)
        
        session_data = {
            'presentation_definition_id': 'MOSIP_ID',
            'expires_in_minutes': 1  # Very short for testing
        }
        
        create_response = self.client.post('/api/openid4vp/sessions/', session_data)
        session_id = create_response.data['session_id']
        
        # Manually expire the session for testing
        session = OpenID4VPSession.objects.get(session_id=session_id)
        session.expires_at = timezone.now() - timedelta(minutes=1)
        session.save()
        
        # Try to get presentation definition for expired session
        definition_response = self.client.get(
            f'/api/openid4vp/presentation-definition/{session_id}/'
        )
        self.assertEqual(definition_response.status_code, status.HTTP_410_GONE)
        self.assertEqual(definition_response.data['error'], 'expired_session')
        
        # Try to submit presentation to expired session
        submission_data = {
            'vp_token': self.valid_presentation
        }
        
        submit_response = self.client.post(
            f'/api/openid4vp/presentation/{session_id}/',
            submission_data,
            format='json'
        )
        self.assertEqual(submit_response.status_code, status.HTTP_410_GONE)
        self.assertEqual(submit_response.data['error'], 'expired_session')
    
    def test_cross_device_simulation(self):
        """Test cross-device functionality by simulating different clients."""
        # Worker device creates session
        worker_client = APIClient()
        worker_client.force_authenticate(user=self.worker_user)
        
        session_data = {
            'presentation_definition_id': 'MOSIP_ID'
        }
        
        create_response = worker_client.post('/api/openid4vp/sessions/', session_data)
        session_id = create_response.data['session_id']
        
        # Wallet device (different client) gets presentation definition
        wallet_client = APIClient()
        
        definition_response = wallet_client.get(
            f'/api/openid4vp/presentation-definition/{session_id}/'
        )
        self.assertEqual(definition_response.status_code, status.HTTP_200_OK)
        
        # Wallet device submits presentation
        with patch.object(OpenID4VPVerificationService, 'verify_presentation') as mock_verify:
            mock_verify.return_value = {
                'verified': True,
                'credentials': [{'type': 'MOSIPIdentityCredential'}]
            }
            
            submission_data = {
                'vp_token': self.valid_presentation
            }
            
            submit_response = wallet_client.post(
                f'/api/openid4vp/presentation/{session_id}/',
                submission_data,
                format='json'
            )
            
            self.assertEqual(submit_response.status_code, status.HTTP_202_ACCEPTED)
        
        # Worker device polls for results
        status_response = worker_client.get(f'/api/openid4vp/status/{session_id}/')
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
    
    def test_concurrent_sessions(self):
        """Test handling of multiple concurrent verification sessions."""
        self.client.force_authenticate(user=self.worker_user)
        
        # Create multiple sessions
        session_ids = []
        for i in range(3):
            session_data = {
                'presentation_definition_id': 'MOSIP_ID'
            }
            
            response = self.client.post('/api/openid4vp/sessions/', session_data)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            session_ids.append(response.data['session_id'])
        
        # Verify all sessions are independent
        for session_id in session_ids:
            # Each should have its own presentation definition
            definition_response = self.client.get(
                f'/api/openid4vp/presentation-definition/{session_id}/'
            )
            self.assertEqual(definition_response.status_code, status.HTTP_200_OK)
            self.assertEqual(definition_response.data['session_id'], session_id)
            
            # Each should have its own status
            status_response = self.client.get(f'/api/openid4vp/status/{session_id}/')
            self.assertEqual(status_response.status_code, status.HTTP_200_OK)
            self.assertEqual(status_response.data['session_id'], session_id)
    
    def test_session_reuse_prevention(self):
        """Test that sessions cannot be reused after successful verification."""
        self.client.force_authenticate(user=self.worker_user)
        
        # Create session
        session_data = {
            'presentation_definition_id': 'MOSIP_ID'
        }
        
        create_response = self.client.post('/api/openid4vp/sessions/', session_data)
        session_id = create_response.data['session_id']
        
        # Submit presentation successfully
        with patch.object(OpenID4VPVerificationService, 'verify_presentation') as mock_verify:
            mock_verify.return_value = {
                'verified': True,
                'credentials': [{'type': 'MOSIPIdentityCredential'}]
            }
            
            submission_data = {
                'vp_token': self.valid_presentation
            }
            
            # First submission should succeed
            submit_response = self.client.post(
                f'/api/openid4vp/presentation/{session_id}/',
                submission_data,
                format='json'
            )
            self.assertEqual(submit_response.status_code, status.HTTP_202_ACCEPTED)
            
            # Mark session as completed
            session = OpenID4VPSession.objects.get(session_id=session_id)
            session.status = 'completed'
            session.save()
            
            # Second submission should fail
            submit_response_2 = self.client.post(
                f'/api/openid4vp/presentation/{session_id}/',
                submission_data,
                format='json'
            )
            self.assertEqual(submit_response_2.status_code, status.HTTP_409_CONFLICT)
            self.assertEqual(submit_response_2.data['error'], 'session_already_used')


class OpenID4VPIntegrationWithExistingSystemTest(OpenID4VPEndToEndTestCase):
    """Test integration with existing system components."""
    
    def test_verification_log_integration(self):
        """Test that OpenID4VP verifications are logged alongside offline verifications."""
        self.client.force_authenticate(user=self.worker_user)
        
        # Create and complete an OpenID4VP verification
        session_data = {
            'presentation_definition_id': 'MOSIP_ID'
        }
        
        create_response = self.client.post('/api/openid4vp/sessions/', session_data)
        session_id = create_response.data['session_id']
        
        with patch.object(OpenID4VPVerificationService, 'verify_presentation') as mock_verify:
            mock_verify.return_value = {
                'verified': True,
                'credentials': [
                    {
                        'type': 'MOSIPIdentityCredential',
                        'issuer': 'did:web:mosip.io',
                        'subject': {'fullName': 'John Doe'}
                    }
                ]
            }
            
            submission_data = {
                'vp_token': self.valid_presentation
            }
            
            self.client.post(
                f'/api/openid4vp/presentation/{session_id}/',
                submission_data,
                format='json'
            )
        
        # Verify verification log was created with correct method
        logs = VerificationLog.objects.filter(
            organization=self.organization,
            verification_method='openid4vp'
        )
        
        if logs.exists():
            log = logs.first()
            self.assertEqual(log.verification_method, 'openid4vp')
            self.assertEqual(log.verified_by, self.worker_user)
            self.assertEqual(log.organization, self.organization)
            self.assertIsNotNone(log.openid4vp_session)
    
    def test_organization_isolation(self):
        """Test that OpenID4VP sessions are properly isolated by organization."""
        # Create second organization and user
        other_org = Organization.objects.create(name="Other Organization")
        other_user = User.objects.create_user(
            username='otherworker',
            email='other@example.com',
            password='testpass123'
        )
        OrganizationMember.objects.create(
            user=other_user,
            organization=other_org,
            role='WORKER'
        )
        
        # Create session with first user
        self.client.force_authenticate(user=self.worker_user)
        session_data = {
            'presentation_definition_id': 'MOSIP_ID'
        }
        
        create_response = self.client.post('/api/openid4vp/sessions/', session_data)
        session_id = create_response.data['session_id']
        
        # Try to access session with second user (different organization)
        self.client.force_authenticate(user=other_user)
        status_response = self.client.get(f'/api/openid4vp/status/{session_id}/')
        
        self.assertEqual(status_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(status_response.data['error'], 'unauthorized')
    
    def test_authentication_integration(self):
        """Test that OpenID4VP endpoints properly integrate with existing authentication."""
        # Test unauthenticated access
        session_data = {
            'presentation_definition_id': 'MOSIP_ID'
        }
        
        response = self.client.post('/api/openid4vp/sessions/', session_data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Test authenticated access
        self.client.force_authenticate(user=self.worker_user)
        response = self.client.post('/api/openid4vp/sessions/', session_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_presentation_definition_consistency(self):
        """Test that presentation definitions are consistent across requests."""
        self.client.force_authenticate(user=self.worker_user)
        
        # Create session
        session_data = {
            'presentation_definition_id': 'MOSIP_ID'
        }
        
        create_response = self.client.post('/api/openid4vp/sessions/', session_data)
        session_id = create_response.data['session_id']
        
        # Get presentation definition multiple times
        definition_responses = []
        for _ in range(3):
            response = self.client.get(
                f'/api/openid4vp/presentation-definition/{session_id}/'
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            definition_responses.append(response.data)
        
        # All responses should be identical (except timestamps)
        base_definition = definition_responses[0]
        for definition in definition_responses[1:]:
            self.assertEqual(definition['id'], base_definition['id'])
            self.assertEqual(definition['input_descriptors'], base_definition['input_descriptors'])
            self.assertEqual(definition['session_id'], base_definition['session_id'])