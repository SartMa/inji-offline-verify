# server/organization/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Organization, OrganizationDID, PublicKey, PendingOrganizationRegistration, JsonLdContext, StatusListCredential
from worker.models import OrganizationMember
from datetime import datetime, timedelta, timezone as dt_timezone
import random, string
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class OrganizationDIDSubmitSerializer(serializers.Serializer):
    org_id = serializers.UUIDField()
    did = serializers.CharField(max_length=500)

    def validate(self, attrs):
        try:
            org = Organization.objects.get(id=attrs['org_id'])
        except Organization.DoesNotExist:
            raise serializers.ValidationError('Organization not found')

        # Enforce unique per org and globally unique DID
        if OrganizationDID.objects.filter(organization=org, did=attrs['did']).exists():
            raise serializers.ValidationError('DID already submitted for this organization')
        if OrganizationDID.objects.filter(did=attrs['did']).exists():
            # Optional global uniqueness policy
            raise serializers.ValidationError('DID already submitted by another organization')
        attrs['organization'] = org
        return attrs

    def create(self, validated_data):
        org = validated_data['organization']
        did = validated_data['did']
        return OrganizationDID.objects.create(organization=org, did=did, status='SUBMITTED')


class PublicKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicKey
        fields = [
            'id', 'key_id', 'key_type', 'public_key_multibase', 'public_key_hex', 'public_key_jwk',
            'controller', 'purpose', 'created_at', 'expires_at', 'revoked_at', 'revocation_reason', 'is_active'
        ]


class PublicKeyListResponseSerializer(serializers.Serializer):
    organization_id = serializers.UUIDField()
    did = serializers.CharField(required=False, allow_blank=True)
    keys = PublicKeySerializer(many=True)


class OrganizationRegistrationSerializer(serializers.Serializer):
    """Initial registration request that sends an OTP and stores a pending record."""
    org_name = serializers.CharField(max_length=255)
    admin_username = serializers.CharField(max_length=150)
    admin_password = serializers.CharField(write_only=True, min_length=8)
    admin_email = serializers.EmailField()

    def validate(self, attrs):
        if Organization.objects.filter(name__iexact=attrs['org_name']).exists():
            raise serializers.ValidationError({'org_name': 'Organization name already exists'})
        if User.objects.filter(username=attrs['admin_username']).exists():
            raise serializers.ValidationError({'admin_username': 'Username already exists'})
        # Prevent duplicate pending with same email/org/username that is still valid
        existing = PendingOrganizationRegistration.objects.filter(
            org_name__iexact=attrs['org_name'],
            admin_username__iexact=attrs['admin_username'],
            admin_email__iexact=attrs['admin_email'],
            consumed_at__isnull=True,
        ).order_by('-created_at').first()
        if existing and existing.is_valid():
            raise serializers.ValidationError('An OTP has already been sent for this registration. Please check your email or wait until it expires.')
        return attrs

    def create(self, validated_data):
        # Create OTP and pending record
        otp = ''.join(random.choices(string.digits, k=6))
        expires_at = datetime.now(dt_timezone.utc) + timedelta(minutes=10)
        # Hash password using Django hasher (but not creating user yet)
        from django.contrib.auth.hashers import make_password
        pwd_hash = make_password(validated_data['admin_password'])
        pending = PendingOrganizationRegistration.objects.create(
            org_name=validated_data['org_name'],
            admin_username=validated_data['admin_username'],
            admin_email=validated_data['admin_email'],
            password_hash=pwd_hash,
            otp_code=otp,
            expires_at=expires_at,
        )
        # Send email (console backend logs it). In production configure real backend.
        subject = 'Complete Your INJI Offline Verifier Organization Registration'
        message = f"""Welcome to INJI Offline Verifier Platform!

Thank you for registering your organization "{validated_data['org_name']}" with our secure credential verification platform.

Your One-Time Password (OTP) for completing the registration is: {otp}

This OTP will expire in 10 minutes for security purposes.

Next Steps:
1. Return to the registration page
2. Enter this OTP code to verify your email address
3. Complete your organization setup

About INJI Offline Verifier:
Our platform enables trusted, cryptographically-assured credential verification anywhere, anytime—even when the network is unavailable. Perfect for organizations managing field operations where network connectivity is unreliable.

If you did not request this registration, please ignore this email.

For support, please contact our team.

Best regards,
INJI Offline Verifier Team"""
        delivered = False
        try:
            sent = send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'), [pending.admin_email])
            delivered = sent == 1
            if not delivered:
                logger.warning("OTP email send_mail returned %s (expected 1) for %s", sent, pending.admin_email)
        except Exception as e:
            logger.exception("Failed to send OTP email to %s: %s", pending.admin_email, e)
        return {
            'pending_id': str(pending.id),
            'org_name': pending.org_name,
            'admin_username': pending.admin_username,
            'admin_email': pending.admin_email,
            'expires_at': expires_at,
            # For local/dev you might expose OTP; remove in prod.
            'debug_otp': otp if settings.DEBUG else None,
            'email_delivered': delivered,
        }


class OrganizationRegistrationConfirmSerializer(serializers.Serializer):
    pending_id = serializers.UUIDField()
    otp_code = serializers.CharField(max_length=12)

    def validate(self, attrs):
        try:
            pending = PendingOrganizationRegistration.objects.get(id=attrs['pending_id'])
        except PendingOrganizationRegistration.DoesNotExist:
            raise serializers.ValidationError('Invalid or expired registration request')
        if not pending.is_valid():
            raise serializers.ValidationError('Registration request expired')
        # Limit attempts
        if pending.attempts >= 5:
            raise serializers.ValidationError('Too many attempts; request a new OTP')
        if pending.otp_code != attrs['otp_code']:
            pending.attempts += 1
            pending.save(update_fields=['attempts'])
            raise serializers.ValidationError('Invalid OTP')
        attrs['pending'] = pending
        return attrs

    def create(self, validated_data):
        from worker.models import OrganizationMember
        
        pending: PendingOrganizationRegistration = validated_data['pending']
        # Double-check uniqueness again right before creation
        if Organization.objects.filter(name__iexact=pending.org_name).exists():
            raise serializers.ValidationError('Organization already exists')
        if User.objects.filter(username=pending.admin_username).exists():
            raise serializers.ValidationError('Username already exists')
        # Create org & admin user
        org = Organization.objects.create(name=pending.org_name)
        user = User.objects.create(
            username=pending.admin_username,
            password=pending.password_hash,
            email=pending.admin_email,
            is_staff=True,
        )
        OrganizationMember.objects.create(user=user, organization=org, role='ADMIN')
        # Issue JWT pair for immediate login
        jwt = RefreshToken.for_user(user)
        pending.mark_consumed()
        return {
            'organization': org,
            'user': user,
            'access': str(jwt.access_token),
            'refresh': str(jwt),
        }


class OrganizationLoginSerializer(serializers.Serializer):
    """Login serializer specifically for organization admins."""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    org_name = serializers.CharField()

    def validate(self, attrs):
        user = authenticate(username=attrs['username'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials')

        try:
            org = Organization.objects.get(name__iexact=attrs['org_name'])
        except Organization.DoesNotExist:
            raise serializers.ValidationError('Organization not found')

        # Check if user is an admin of this organization
        membership = OrganizationMember.objects.filter(user=user, organization=org).first()
        if not membership:
            raise serializers.ValidationError('User is not a member of this organization')
        
        if membership.role != 'ADMIN':
            raise serializers.ValidationError('Organization login requires admin privileges')

        # Issue JWT pair
        jwt = RefreshToken.for_user(user)
        
        return {
            'access': str(jwt.access_token),
            'refresh': str(jwt),
            'username': user.username,
            'organization': OrganizationSerializer(org).data,
            'is_staff': bool(user.is_staff),
            'role': membership.role,
            'login_type': 'organization_admin',
        }


class JsonLdContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = JsonLdContext
        fields = ['id', 'organization', 'url', 'document', 'created_at', 'updated_at']


class StatusListCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusListCredential
        fields = [
            'id', 'status_list_id', 'issuer', 'purposes', 'version', 'issuance_date',
            'encoded_list_hash', 'full_credential', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'version', 'encoded_list_hash']


class StatusListCredentialUpsertSerializer(serializers.Serializer):
    """Upsert serializer with version bump & hash detection."""
    organization_id = serializers.UUIDField()
    status_list_credential = serializers.JSONField()

    def validate(self, attrs):
        try:
            org = Organization.objects.get(id=attrs['organization_id'])
        except Organization.DoesNotExist:
            raise serializers.ValidationError({'organization_id': 'Organization not found'})

        credential_data = attrs['status_list_credential']
        if not isinstance(credential_data, dict):
            raise serializers.ValidationError({'status_list_credential': 'Must be a JSON object'})

        ctype = credential_data.get('type', [])
        if not isinstance(ctype, list):
            ctype = [ctype]
        if 'BitstringStatusListCredential' not in ctype:
            raise serializers.ValidationError({'status_list_credential': 'Credential must include BitstringStatusListCredential in type'})

        status_list_id = credential_data.get('id')
        if not status_list_id:
            raise serializers.ValidationError({'status_list_credential': 'Missing id'})

        issuer = credential_data.get('issuer')
        if not issuer:
            raise serializers.ValidationError({'status_list_credential': 'Missing issuer'})
        if isinstance(issuer, dict):
            issuer = issuer.get('id', '')

        subj = credential_data.get('credentialSubject', {})
        if not isinstance(subj, dict):
            raise serializers.ValidationError({'status_list_credential': 'credentialSubject must be object'})
        encoded_list = subj.get('encodedList')
        if not encoded_list:
            raise serializers.ValidationError({'status_list_credential': 'credentialSubject.encodedList required'})

        # purposes normalization
        raw_purpose = subj.get('statusPurpose')
        purposes = raw_purpose if isinstance(raw_purpose, list) else [raw_purpose] if raw_purpose else []

        # issuance date optional
        issuance_date = credential_data.get('issuanceDate') or credential_data.get('issuance_date')

        # compute hash
        import hashlib
        encoded_hash = hashlib.sha256(encoded_list.encode('utf-8')).hexdigest()

        attrs.update({
            'organization': org,
            'status_list_id': status_list_id,
            'issuer': issuer,
            'purposes': purposes,
            'encoded_list_hash': encoded_hash,
            'issuance_date': issuance_date,
            'full_credential': credential_data,
        })
        return attrs

    def create(self, validated):
        org = validated['organization']
        status_list_id = validated['status_list_id']
        existing = StatusListCredential.objects.filter(organization=org, status_list_id=status_list_id).first()
        if existing:
            # no change?
            if existing.encoded_list_hash == validated['encoded_list_hash']:
                return existing  # version unchanged
            # bump version
            existing.bump_version(validated['full_credential'])
            existing.issuer = validated['issuer']
            existing.encoded_list_hash = validated['encoded_list_hash']
            existing.save(update_fields=['issuer', 'encoded_list_hash', 'updated_at'])
            return existing
        # create new
        from django.utils.dateparse import parse_datetime
        issuance_dt = None
        if validated.get('issuance_date'):
            issuance_dt = parse_datetime(validated['issuance_date'])
        return StatusListCredential.objects.create(
            organization=org,
            status_list_id=status_list_id,
            issuer=validated['issuer'],
            purposes=validated['purposes'],
            version=1,
            issuance_date=issuance_dt,
            encoded_list_hash=validated['encoded_list_hash'],
            full_credential=validated['full_credential']
        )


class StatusListCredentialListResponseSerializer(serializers.Serializer):
    organization_id = serializers.UUIDField()
    status_list_credentials = StatusListCredentialSerializer(many=True)
