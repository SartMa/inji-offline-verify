# server/organization/models.py
from django.db import models
from datetime import datetime, timezone as dt_timezone
import uuid


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


class PendingOrganizationRegistration(models.Model):
    """Holds a pending organization admin registration awaiting email OTP confirmation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_name = models.CharField(max_length=255)
    admin_username = models.CharField(max_length=150)
    admin_email = models.EmailField()
    # Store hashed password (not raw). We'll set it on user creation after OTP verify.
    password_hash = models.CharField(max_length=256)
    otp_code = models.CharField(max_length=12)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["org_name"], name="idx_pending_org_name"),
            models.Index(fields=["admin_username"], name="idx_pending_admin_user"),
            models.Index(fields=["admin_email"], name="idx_pending_admin_email"),
            models.Index(fields=["expires_at"], name="idx_pending_expires"),
        ]

    def is_valid(self):
        now = datetime.now(dt_timezone.utc)
        return self.consumed_at is None and self.expires_at > now

    def mark_consumed(self):
        self.consumed_at = datetime.now(dt_timezone.utc)
        self.save(update_fields=["consumed_at"]) 

    def __str__(self):
        state = 'used' if self.consumed_at else 'pending'
        return f"Pending org {self.org_name} admin {self.admin_username} ({state})"
