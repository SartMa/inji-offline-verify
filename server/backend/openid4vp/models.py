import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from organization.models import Organization


class OpenID4VPSession(models.Model):
    """
    Model to manage OpenID4VP verification sessions.
    Each session represents a single verification request with a unique identifier.
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
        ('error', 'Error')
    ]
    
    session_id = models.UUIDField(
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False,
        help_text="Unique session identifier for OpenID4VP verification"
    )
    
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.CASCADE,
        help_text="Organization that initiated the verification"
    )
    
    created_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        help_text="Worker who initiated the verification session"
    )
    
    presentation_definition_id = models.CharField(
        max_length=100,
        help_text="ID of the presentation definition used for this session"
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Current status of the verification session"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the session was created"
    )
    
    expires_at = models.DateTimeField(
        help_text="When the session expires"
    )
    
    verification_result = models.JSONField(
        null=True, 
        blank=True,
        help_text="Verification result data (populated after verification)"
    )
    
    error_message = models.TextField(
        null=True, 
        blank=True,
        help_text="Error message if verification failed"
    )
    
    class Meta:
        db_table = 'openid4vp_sessions'
        indexes = [
            models.Index(fields=['status', 'expires_at']),
            models.Index(fields=['organization', 'created_at']),
        ]
        verbose_name = 'OpenID4VP Session'
        verbose_name_plural = 'OpenID4VP Sessions'
    
    def save(self, *args, **kwargs):
        """Override save to set expiration time if not provided."""
        if not self.expires_at:
            # Default session expiration: 10 minutes from creation
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Check if the session has expired."""
        return timezone.now() > self.expires_at
    
    def is_active(self):
        """Check if the session is active (not expired and status is pending)."""
        return self.status == 'pending' and not self.is_expired()
    
    def __str__(self):
        return f"OpenID4VP Session {self.session_id} - {self.status}"