"""
Test session reuse prevention functionality.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from organization.models import Organization
from .models import OpenID4VPSession
from .services import OpenID4VPSessionService


class SessionReusePrevention(TestCase):
    """Test cases for session reuse prevention."""
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testworker',
            email='test@example.com',
            password='testpass123'
        )
        
        self.organization = Organization.objects.create(
            name='Test Organization'
        )
    
    def test_can_session_be_used_pending_session(self):
        """Test that pending sessions can be used."""
        session = OpenID4VPSessionService.create_session(
            presentation_definition_id='MOSIP_ID',
            organization=self.organization,
            created_by=self.user,
            expires_in_minutes=10
        )
        
        can_use, reason = OpenID4VPSessionService.can_session_be_used(str(session.session_id))
        self.assertTrue(can_use)
        self.assertEqual(reason, "Session is active and can be used")
    
    def test_can_session_be_used_completed_session(self):
        """Test that completed sessions cannot be reused."""
        session = OpenID4VPSessionService.create_session(
            presentation_definition_id='MOSIP_ID',
            organization=self.organization,
            created_by=self.user,
            expires_in_minutes=10
        )
        
        # Mark session as completed
        OpenID4VPSessionService.update_session_status(
            str(session.session_id),
            'completed',
            result={'verified': True}
        )
        
        can_use, reason = OpenID4VPSessionService.can_session_be_used(str(session.session_id))
        self.assertFalse(can_use)
        self.assertIn("already been completed", reason)
    
    def test_can_session_be_used_error_session(self):
        """Test that error sessions cannot be reused."""
        session = OpenID4VPSessionService.create_session(
            presentation_definition_id='MOSIP_ID',
            organization=self.organization,
            created_by=self.user,
            expires_in_minutes=10
        )
        
        # Mark session as error
        OpenID4VPSessionService.update_session_status(
            str(session.session_id),
            'error',
            error_message='Verification failed'
        )
        
        can_use, reason = OpenID4VPSessionService.can_session_be_used(str(session.session_id))
        self.assertFalse(can_use)
        self.assertIn("error state", reason)
    
    def test_can_session_be_used_expired_session(self):
        """Test that expired sessions cannot be used."""
        # Create session that expires immediately
        session = OpenID4VPSession.objects.create(
            organization=self.organization,
            created_by=self.user,
            presentation_definition_id='MOSIP_ID',
            expires_at=timezone.now() - timedelta(minutes=1)  # Already expired
        )
        
        can_use, reason = OpenID4VPSessionService.can_session_be_used(str(session.session_id))
        self.assertFalse(can_use)
        self.assertIn("expired", reason)
    
    def test_can_session_be_used_nonexistent_session(self):
        """Test that nonexistent sessions cannot be used."""
        import uuid
        fake_session_id = str(uuid.uuid4())
        
        can_use, reason = OpenID4VPSessionService.can_session_be_used(fake_session_id)
        self.assertFalse(can_use)
        self.assertEqual(reason, "Session not found")
    
    def test_update_session_status_prevents_reuse(self):
        """Test that updating session status prevents reuse."""
        session = OpenID4VPSessionService.create_session(
            presentation_definition_id='MOSIP_ID',
            organization=self.organization,
            created_by=self.user,
            expires_in_minutes=10
        )
        
        # First update should succeed
        success = OpenID4VPSessionService.update_session_status(
            str(session.session_id),
            'completed',
            result={'verified': True}
        )
        self.assertTrue(success)
        
        # Trying to change from completed to error should fail
        success = OpenID4VPSessionService.update_session_status(
            str(session.session_id),
            'error',
            error_message='Should not work'
        )
        self.assertFalse(success)
        
        # Session should still be completed
        session.refresh_from_db()
        self.assertEqual(session.status, 'completed')
    
    def test_update_session_status_allows_same_status_update(self):
        """Test that updating with the same status is allowed (for result updates)."""
        session = OpenID4VPSessionService.create_session(
            presentation_definition_id='MOSIP_ID',
            organization=self.organization,
            created_by=self.user,
            expires_in_minutes=10
        )
        
        # Mark as completed
        success = OpenID4VPSessionService.update_session_status(
            str(session.session_id),
            'completed',
            result={'verified': True, 'initial': True}
        )
        self.assertTrue(success)
        
        # Update with same status but different result should succeed
        success = OpenID4VPSessionService.update_session_status(
            str(session.session_id),
            'completed',
            result={'verified': True, 'updated': True}
        )
        self.assertTrue(success)
        
        # Verify the result was updated
        session.refresh_from_db()
        self.assertEqual(session.status, 'completed')
        self.assertTrue(session.verification_result.get('updated'))
    
    def test_session_model_helper_methods(self):
        """Test the helper methods on the OpenID4VPSession model."""
        session = OpenID4VPSessionService.create_session(
            presentation_definition_id='MOSIP_ID',
            organization=self.organization,
            created_by=self.user,
            expires_in_minutes=10
        )
        
        # Test pending session
        self.assertTrue(session.is_active())
        self.assertFalse(session.is_completed())
        self.assertFalse(session.is_final_state())
        self.assertTrue(session.can_be_reused())
        
        # Mark as completed
        session.status = 'completed'
        session.save()
        
        # Test completed session
        self.assertFalse(session.is_active())
        self.assertTrue(session.is_completed())
        self.assertTrue(session.is_final_state())
        self.assertFalse(session.can_be_reused())
        
        # Mark as error
        session.status = 'error'
        session.save()
        
        # Test error session
        self.assertFalse(session.is_active())
        self.assertFalse(session.is_completed())
        self.assertTrue(session.is_final_state())
        self.assertFalse(session.can_be_reused())