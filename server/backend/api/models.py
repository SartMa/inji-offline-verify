# server/api/models.py
from django.db import models
from django.contrib.auth import get_user_model
from datetime import datetime, timezone as dt_timezone
import uuid

User = get_user_model()

class JsonLdContext(models.Model):
    """
    Stores JSON-LD context documents keyed by URL for offline clients to cache.
    Contexts are global (not per-organization) and versioned by updated timestamp.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    url = models.URLField(max_length=500, unique=True)
    document = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["url"], name="idx_ctx_url"),
        ]
        verbose_name = "JSON-LD Context"
        verbose_name_plural = "JSON-LD Contexts"

    def __str__(self):
        return self.url

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
    indexes = []


class OrganizationDID(models.Model):
    """
    A DID submitted by an organization. Separate from Organization model by design.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="dids"
    )
    did = models.CharField(max_length=500, unique=True)
    STATUS_CHOICES = [
        ("SUBMITTED", "Submitted"),
        ("RESOLVED", "Resolved"),
        ("REVOKED", "Revoked"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="SUBMITTED")
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["did"], name="idx_orgdid_did"),
            models.Index(fields=["organization"], name="idx_orgdid_org"),
            models.Index(fields=["status"], name="idx_orgdid_status"),
        ]
        unique_together = ("organization", "did")

    def __str__(self):
        return f"{self.did} ({self.status})"

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


class PublicKey(models.Model):
    """
    Stores resolved public keys for organizations' DIDs.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="public_keys", null=True, blank=True
    )
    key_id = models.CharField(max_length=500, unique=True)
    key_type = models.CharField(max_length=100)
    public_key_multibase = models.TextField()
    public_key_hex = models.TextField(null=True, blank=True)
    public_key_jwk = models.JSONField(null=True, blank=True)
    controller = models.CharField(max_length=500)
    purpose = models.CharField(max_length=100, default="assertion")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=255, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization"], name="idx_pk_org"),
            models.Index(fields=["key_id"], name="idx_pk_keyid"),
            models.Index(fields=["controller"], name="idx_pk_controller"),
            models.Index(fields=["is_active", "revoked_at", "expires_at"], name="idx_pk_active"),
        ]

    def __str__(self):
        return f"{self.key_id} ({self.key_type})"


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