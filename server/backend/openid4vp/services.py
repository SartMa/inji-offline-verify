"""
OpenID4VP service classes for session management and verification logic.
"""
from typing import Optional, Dict, Any
from django.utils import timezone
from django.contrib.auth.models import User
from datetime import timedelta
from .models import OpenID4VPSession
from organization.models import Organization


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
    def update_session_status(
        session_id: str, 
        status: str, 
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update session status and verification result.
        
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