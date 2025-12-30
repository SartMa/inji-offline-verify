# server/api/models.py
from django.db import models
from datetime import datetime, timezone as dt_timezone
import uuid


class VerificationLog(models.Model):
    """
    Represents a single verifiable credential verification event
    that has been synchronized from a client PWA.
    """
    # Use a UUID for the primary key to avoid collisions if multiple clients
    # generate IDs. The client will generate this ID.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class VerificationStatus(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        EXPIRED = "EXPIRED", "Expired"
        REVOKED = "REVOKED", "Revoked"
        SUSPENDED = "SUSPENDED", "Suspended"

    # The core status of the verification, as per the project brief.[1]
    verification_status = models.CharField(
        max_length=10,
        choices=VerificationStatus.choices,
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
        'organization.Organization',
        on_delete=models.CASCADE,
        related_name="verification_logs",
        null=True,
        blank=True,
    )

    # The user/worker who performed this verification
    verified_by = models.ForeignKey(
        'auth.User',
        on_delete=models.CASCADE,
        related_name="verification_logs",
        null=True,
        blank=True,
        help_text="The user who performed this verification"
    )

    class VerificationMethod(models.TextChoices):
        OFFLINE_QR = "offline_qr", "Offline QR"
        OPENID4VP = "openid4vp", "OpenID4VP"

    # Method used for verification
    verification_method = models.CharField(
        max_length=20,
        choices=VerificationMethod.choices,
        default=VerificationMethod.OFFLINE_QR,
        help_text="Method used for credential verification"
    )

    # Reference to OpenID4VP session if applicable
    openid4vp_session = models.ForeignKey(
        'openid4vp.OpenID4VPSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verification_logs",
        help_text="OpenID4VP session associated with this verification (if applicable)"
    )

    # A server-generated timestamp to track when the record was synced.
    synced_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.verification_status} log at {self.verified_at}"

    class Meta:
        ordering = ['-verified_at']
        verbose_name = "Verification Log"
        verbose_name_plural = "Verification Logs"