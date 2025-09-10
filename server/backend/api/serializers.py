# server/api/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken
from .models import VerificationLog, Organization, OrganizationMember, OrganizationDID, PublicKey, JsonLdContext
from .models import EmailLoginCode
from datetime import datetime, timedelta, timezone as dt_timezone
import random, string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings

class VerificationLogSerializer(serializers.ModelSerializer):
    """
    Serializer for the VerificationLog model. It validates and converts
    incoming JSON data into VerificationLog model instances.
    """
    class Meta:
        model = VerificationLog
        # Define the fields that the API will accept.
        fields = [
            'id',
            'verification_status',
            'verified_at',
            'vc_hash',
            'credential_subject',
            'error_message',
            'organization',
        ]

    read_only_fields = ['organization']

    def create(self, validated_data):
        request = self.context.get('request')
        org = None
        if request and request.user and request.user.is_authenticated:
            # Pick the first organization membership; later we can support header-based org selection
            membership = OrganizationMember.objects.filter(user=request.user).first()
            if membership:
                org = membership.organization
        validated_data['organization'] = org
        return super().create(validated_data)


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


class JsonLdContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = JsonLdContext
        fields = ["id", "url", "document", "created_at", "updated_at"]


class ContextListResponseSerializer(serializers.Serializer):
    contexts = JsonLdContextSerializer(many=True)


class OrganizationRegistrationSerializer(serializers.Serializer):
    org_name = serializers.CharField(max_length=255)
    admin_username = serializers.CharField(max_length=150)
    admin_password = serializers.CharField(write_only=True, min_length=8)
    admin_email = serializers.EmailField(required=False, allow_blank=True)

    def validate_admin_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists')
        return value

    def validate_org_name(self, value):
        if Organization.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError('Organization name already exists')
        return value

    def create(self, validated_data):
        org = Organization.objects.create(name=validated_data['org_name'])
        user = User.objects.create_user(
            username=validated_data['admin_username'],
            password=validated_data['admin_password'],
            email=validated_data.get('admin_email', ''),
            is_staff=True,
        )
        OrganizationMember.objects.create(user=user, organization=org, role='ADMIN')
        token, _ = Token.objects.get_or_create(user=user)
        return {
            'organization': org,
            'user': user,
            'token': token.key,
        }


class LoginSerializer(serializers.Serializer):
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

        if not OrganizationMember.objects.filter(user=user, organization=org).exists():
            raise serializers.ValidationError('User is not a member of this organization')

        # Issue both DRF token (backward compat) and JWT pair
        token, _ = Token.objects.get_or_create(user=user)
        jwt = RefreshToken.for_user(user)
        return {
            'token': token.key,
            'access': str(jwt.access_token),
            'refresh': str(jwt),
            'username': user.username,
            'organization': OrganizationSerializer(org).data,
            'is_staff': bool(user.is_staff),
        }


class WorkerRegistrationSerializer(serializers.Serializer):
    org_name = serializers.CharField()
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField()
    full_name = serializers.CharField()
    phone_number = serializers.CharField()
    gender = serializers.ChoiceField(choices=[('M','Male'),('F','Female'),('O','Other')])
    dob = serializers.DateField()

    def validate(self, attrs):
        try:
            org = Organization.objects.get(name__iexact=attrs['org_name'])
        except Organization.DoesNotExist:
            raise serializers.ValidationError('Organization not found')
        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError('Username already exists')
        attrs['org'] = org
        return attrs

    def create(self, validated_data):
        org = validated_data.pop('org')
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data['email'],
            is_staff=False,
        )
        member = OrganizationMember.objects.create(
            user=user,
            organization=org,
            role='USER',
            full_name=validated_data['full_name'],
            phone_number=validated_data['phone_number'],
            gender=validated_data['gender'],
            dob=validated_data['dob'],
        )
        jwt = RefreshToken.for_user(user)
        return {
            'user': user,
            'organization': org,
            'member': member,
            'access': str(jwt.access_token),
            'refresh': str(jwt),
        }


class EmailLoginCodeRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('User with this email not found')
        return value

    def create(self, validated_data):
        user = User.objects.filter(email__iexact=validated_data['email']).first()
        code = ''.join(random.choices(string.digits, k=6))
        expires_at = datetime.now(dt_timezone.utc) + timedelta(minutes=10)
        EmailLoginCode.objects.create(user=user, code=code, expires_at=expires_at)
        # Real implementation would email the code. For now we return it for testing.
        return {'email': user.email, 'code': code, 'expires_at': expires_at}


class EmailLoginCodeVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=12)

    def validate(self, attrs):
        user = User.objects.filter(email__iexact=attrs['email']).first()
        if not user:
            raise serializers.ValidationError('Invalid code or email')
        record = EmailLoginCode.objects.filter(user=user, code=attrs['code']).order_by('-created_at').first()
        if not record or not record.is_valid():
            raise serializers.ValidationError('Invalid or expired code')
        attrs['user'] = user
        attrs['record'] = record
        return attrs

    def create(self, validated_data):
        record: EmailLoginCode = validated_data['record']
        record.consumed_at = datetime.now(dt_timezone.utc)
        record.save(update_fields=['consumed_at'])
        user = validated_data['user']
        jwt = RefreshToken.for_user(user)
        token, _ = Token.objects.get_or_create(user=user)
        # Attempt to include first org membership context if exists
        membership = OrganizationMember.objects.filter(user=user).first()
        org_data = OrganizationSerializer(membership.organization).data if membership else None
        return {
            'token': token.key,
            'access': str(jwt.access_token),
            'refresh': str(jwt),
            'username': user.username,
            'organization': org_data,
            'is_staff': bool(user.is_staff),
            'email_login': True,
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('User with this email not found')
        return value

    def create(self, validated_data):
        """Generate password reset token and send email (console backend in dev)."""
        users = User.objects.filter(email__iexact=validated_data['email'])
        payloads = []
        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_link_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            link = f"{reset_link_base}/reset-password?uid={uid}&token={token}"
            subject = 'Password Reset Request'
            message = f"Use the following link to reset your password: {link}"
            try:
                send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'), [user.email])
            except Exception:
                pass  # Silent fail for now
            payloads.append({'uid': uid, 'token': token})
        # Return first for convenience in testing (avoid exposing multiple)
        return {'status': 'password reset email sent', 'debug': payloads[0] if payloads else None}


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        try:
            uid_int = urlsafe_base64_decode(attrs['uid']).decode()
            user = User.objects.get(pk=uid_int)
        except Exception:
            raise serializers.ValidationError('Invalid uid or token')
        if not default_token_generator.check_token(user, attrs['token']):
            raise serializers.ValidationError('Invalid or expired token')
        attrs['user'] = user
        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        user.set_password(validated_data['new_password'])
        user.save(update_fields=['password'])
        return {'status': 'password reset successful'}