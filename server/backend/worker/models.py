# server/worker/models.py
from django.db import models
from django.contrib.auth import get_user_model
from datetime import datetime, timezone as dt_timezone
import uuid

User = get_user_model()


class OrganizationMember(models.Model):
    """
    Membership of a Django User in an Organization with a role.
    """
    ROLE_CHOICES = [
        ("ADMIN", "Admin"),
        ("USER", "User"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey('organization.Organization', on_delete=models.CASCADE, related_name="members")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="ADMIN")
    # Worker profile fields
    full_name = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=32, blank=True, null=True)
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, null=True)
    dob = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "organization")
        verbose_name = "Organization Member"
        verbose_name_plural = "Organization Members"

    def __str__(self):
        return f"{self.user} @ {self.organization} ({self.role})"


class EmailLoginCode(models.Model):
    """One-time email-based login code for passwordless worker login."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_login_codes')
    code = models.CharField(max_length=12)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'code'], name='idx_emailcode_user_code'),
            models.Index(fields=['expires_at'], name='idx_emailcode_expires'),
        ]

    def is_valid(self):
        now = datetime.now(dt_timezone.utc)
        return self.consumed_at is None and self.expires_at > now

    def __str__(self):
        return f"Code for {self.user} (@ {'used' if self.consumed_at else 'active'})"
