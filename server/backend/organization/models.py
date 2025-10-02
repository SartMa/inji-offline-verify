# server/organization/models.py
from django.db import models
import hashlib
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
    key_id = models.CharField(max_length=500)
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
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "key_id"],
                name="uniq_publickey_org_keyid",
            )
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


class JsonLdContext(models.Model):
    """
    JSON-LD Context scoped to an Organization.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="contexts"
    )
    url = models.URLField(max_length=500)
    document = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization"], name="idx_ctx_org"),
            models.Index(fields=["url"], name="idx_ctx_url"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "url"], name="uniq_ctx_org_url"
            )
        ]
        verbose_name = "JSON-LD Context"
        verbose_name_plural = "JSON-LD Contexts"

    def __str__(self):
        return f"{self.organization_id} :: {self.url}"


class StatusListCredential(models.Model):
    """Current (latest) version of a BitstringStatusList credential for an org.
    One row per (organization, status_list_id) stable identifier.
    Purpose(s) can include multiple values (revocation, suspension, refresh, message, etc.).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="status_list_credentials")
    status_list_id = models.CharField(max_length=1000, help_text="Stable StatusList credential identifier (credential.id)")
    issuer = models.CharField(max_length=500, help_text="Issuer DID")
    purposes = models.JSONField(default=list, help_text="One or more status purposes (list of strings)")
    version = models.PositiveIntegerField(default=1)
    issuance_date = models.DateTimeField(null=True, blank=True)
    encoded_list_hash = models.CharField(max_length=128, help_text="SHA256 hash of credentialSubject.encodedList for change detection", blank=True)
    full_credential = models.JSONField(help_text="Complete StatusList credential JSON document (latest)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization"], name="idx_statuslist_org"),
            models.Index(fields=["status_list_id"], name="idx_statuslist_id"),
            models.Index(fields=["issuer"], name="idx_statuslist_issuer"),
            models.Index(fields=["updated_at"], name="idx_statuslist_updated"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["organization", "status_list_id"], name="uniq_statuslist_org_id")
        ]
        verbose_name = "StatusList Credential"
        verbose_name_plural = "StatusList Credentials"

    def __str__(self):
        return f"{self.status_list_id} (v{self.version} purposes={','.join(self.purposes or [])})"

    @staticmethod
    def _extract_purposes(credential: dict):
        subj = credential.get('credentialSubject', {}) if isinstance(credential, dict) else {}
        raw = subj.get('statusPurpose')
        if raw is None:
            return []
        return raw if isinstance(raw, list) else [raw]

    @staticmethod
    def _compute_encoded_list_hash(credential: dict) -> str:
        try:
            subj = credential.get('credentialSubject', {})
            encoded_list = subj.get('encodedList')
            if not encoded_list:
                return ''
            return hashlib.sha256(encoded_list.encode('utf-8')).hexdigest()
        except Exception:
            return ''

    def bump_version(self, new_credential: dict):
        """Persist current row to history then update this row to new version."""
        StatusListCredentialHistory.objects.create(
            status_list_current=self,
            organization=self.organization,
            status_list_id=self.status_list_id,
            issuer=self.issuer,
            purposes=self.purposes,
            version=self.version,
            issuance_date=self.issuance_date,
            encoded_list_hash=self.encoded_list_hash,
            full_credential=self.full_credential,
        )
        self.version += 1
        self.full_credential = new_credential
        self.purposes = self._extract_purposes(new_credential)
        # Update issuance date if present
        new_issuance = new_credential.get('issuanceDate') or new_credential.get('issuance_date')
        if new_issuance:
            try:
                # Store as raw string parsed by DRF serializers later if needed
                from django.utils.dateparse import parse_datetime
                parsed = parse_datetime(new_issuance)
                if parsed:
                    self.issuance_date = parsed
            except Exception:
                pass
        self.encoded_list_hash = self._compute_encoded_list_hash(new_credential)
        self.save()


class StatusListCredentialHistory(models.Model):
    """Immutable snapshot of previous versions for audit & timestamp queries."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status_list_current = models.ForeignKey(StatusListCredential, on_delete=models.CASCADE, related_name='history_entries')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    status_list_id = models.CharField(max_length=1000)
    issuer = models.CharField(max_length=500, blank=True, default="")
    purposes = models.JSONField(default=list)
    version = models.PositiveIntegerField()
    issuance_date = models.DateTimeField(null=True, blank=True)
    encoded_list_hash = models.CharField(max_length=128, blank=True)
    full_credential = models.JSONField()
    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization"], name="idx_statuslisthist_org"),
            models.Index(fields=["status_list_id"], name="idx_statuslisthist_id"),
            models.Index(fields=["version"], name="idx_statuslisthist_version"),
            models.Index(fields=["archived_at"], name="idx_statuslisthist_archived"),
        ]
        unique_together = [("status_list_current", "version")]

    def __str__(self):
        return f"{self.status_list_id} v{self.version} (archived)"


