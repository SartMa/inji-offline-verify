# server/api/models.py
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()

class Organization(models.Model):
    """
    Tenant/Organization that owns verification data and users.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]

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
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="members")
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

class VerificationLog(models.Model):
    """
    Represents a single verifiable credential verification event
    that has been synchronized from a client PWA.
    """
    # Use a UUID for the primary key to avoid collisions if multiple clients
    # generate IDs. The client will generate this ID.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # The core status of the verification, as per the project brief.[1]
    verification_status = models.CharField(
        max_length=10,
        choices=[
            ("SUCCESS", "Success"),
            ("FAILED", "Failed"),
        ]
    )

    # Timestamp from the client indicating when the verification occurred.
    verified_at = models.DateTimeField()

    # A cryptographic hash of the VC, useful for uniqueness checks or analysis.
    vc_hash = models.CharField(max_length=256, blank=True, null=True)

    # A flexible field to store the claims (e.g., name, date of birth)
    # extracted from the VC payload. JSONField is ideal for this.
    credential_subject = models.JSONField(blank=True, null=True)

    # If verification failed, this field can store the reason.
    error_message = models.TextField(blank=True, null=True)

    # Owning organization (set from authenticated user/org context)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="verification_logs",
        null=True,
        blank=True,
    )

    # A server-generated timestamp to track when the record was synced.
    synced_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.verification_status} log at {self.verified_at}"

    class Meta:
        ordering = ['-verified_at']
        verbose_name = "Verification Log"
        verbose_name_plural = "Verification Logs"