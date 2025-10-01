# server/api/serializers.py
from rest_framework import serializers
from .models import VerificationLog
from worker.models import OrganizationMember, EmailLoginCode
from organization.models import Organization
from organization.serializers import OrganizationSerializer
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import datetime, timedelta, timezone as dt_timezone
import random, string
from urllib.parse import urljoin, urlparse
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
    verified_by_info = serializers.SerializerMethodField()
    
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
            'verified_by',
            'verified_by_info',
            'synced_at',
        ]

    read_only_fields = ['organization', 'verified_by', 'verified_by_info', 'synced_at']
    
    def get_verified_by_info(self, obj):
        """Get user information for the person who verified this log"""
        if obj.verified_by:
            try:
                # Get the organization member info to include full_name
                member = OrganizationMember.objects.filter(
                    user=obj.verified_by, 
                    organization=obj.organization
                ).first()
                
                if member:
                    return {
                        'id': str(member.id),
                        'username': obj.verified_by.username,
                        'full_name': member.full_name or f"{obj.verified_by.first_name} {obj.verified_by.last_name}".strip() or obj.verified_by.username,
                        'email': obj.verified_by.email,
                    }
                else:
                    # Fallback if member relationship not found
                    return {
                        'id': str(obj.verified_by.id),
                        'username': obj.verified_by.username,
                        'full_name': f"{obj.verified_by.first_name} {obj.verified_by.last_name}".strip() or obj.verified_by.username,
                        'email': obj.verified_by.email,
                    }
            except Exception:
                return None
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        org = None
        user = None
        if request and request.user and request.user.is_authenticated:
            user = request.user
            # Pick the first organization membership; later we can support header-based org selection
            membership = OrganizationMember.objects.filter(user=request.user).first()
            if membership:
                org = membership.organization
        validated_data['organization'] = org
        validated_data['verified_by'] = user
        return super().create(validated_data)


## Context serializers moved to organization app.


# Shared Authentication Serializers (login serializers are now app-specific)
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
        # Attempt to include first org membership context if exists
        membership = OrganizationMember.objects.filter(user=user).first()
        org_data = OrganizationSerializer(membership.organization).data if membership else None
        return {
            'access': str(jwt.access_token),
            'refresh': str(jwt),
            'username': user.username,
            'organization': org_data,
            'is_staff': bool(user.is_staff),
            'email_login': True,
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    redirect_base = serializers.URLField(required=False, allow_blank=True)
    reset_path = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('User with this email not found')
        return value

    def validate_reset_path(self, value: str) -> str:
        value = (value or '').strip()
        if value and '://' in value:
            raise serializers.ValidationError('reset_path must be a relative path')
        return value

    def create(self, validated_data):
        """Generate password reset token and send email (console backend in dev)."""
        users = User.objects.filter(email__iexact=validated_data['email'])
        payloads = []
        reset_base = self._resolve_reset_base(validated_data)
        reset_path = validated_data.get('reset_path') or '/reset-password'
        if not reset_path.startswith('/'):
            reset_path = '/' + reset_path

        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link_base = self._build_reset_base(reset_base)
            link = self._build_reset_link(link_base, reset_path, uid, token)
            subject = 'Password Reset Request'
            message = f"Use the following link to reset your password: {link}"
            try:
                send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'), [user.email])
            except Exception:
                pass  # Silent fail for now
            payloads.append({'uid': uid, 'token': token})
        # Return first for convenience in testing (avoid exposing multiple)
        return {'status': 'password reset email sent', 'debug': payloads[0] if payloads else None}

    def _build_reset_link(self, base: str, path: str, uid: str, token: str) -> str:
        full_base = base.rstrip('/') + '/'
        target = urljoin(full_base, path.lstrip('/'))
        separator = '&' if '?' in target else '?'
        return f"{target}{separator}uid={uid}&token={token}"

    def _build_reset_base(self, base: str) -> str:
        if base:
            return base
        fallback = getattr(settings, 'FRONTEND_URL', '').strip()
        if fallback:
            return fallback.rstrip('/')
        allowed = self._allowed_origins()
        if allowed:
            return allowed[0]
        return 'http://localhost:5173'

    def _resolve_reset_base(self, validated_data) -> str:
        request = self.context.get('request')
        candidates = []

        explicit = validated_data.get('redirect_base')
        if explicit:
            candidates.append(self._normalize_base(explicit, allow_path=True))

        if request:
            header_candidate = request.headers.get('X-Reset-Origin')
            if header_candidate:
                candidates.append(self._normalize_base(header_candidate))
            origin = request.headers.get('Origin')
            if origin:
                candidates.append(self._normalize_base(origin))
            referer = request.headers.get('Referer')
            if referer:
                candidates.append(self._normalize_base(referer))

        allowed = set(self._origin_only(url) for url in self._allowed_origins())

        for candidate in candidates:
            if candidate and (not allowed or self._origin_only(candidate) in allowed):
                return candidate.rstrip('/')

        return ''

    def _normalize_base(self, value: str | None, allow_path: bool = False) -> str | None:
        if not value:
            return None
        parsed = urlparse(value)
        if not parsed.scheme or not parsed.netloc:
            return None
        path = ''
        if allow_path and parsed.path:
            path = parsed.path if parsed.path.startswith('/') else f"/{parsed.path}"
            path = path.rstrip('/')
        return f"{parsed.scheme}://{parsed.netloc}{path}"

    def _origin_only(self, value: str | None) -> str | None:
        if not value:
            return None
        parsed = urlparse(value)
        if not parsed.scheme or not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}"

    def _allowed_origins(self) -> list[str]:
        raw = getattr(settings, 'PASSWORD_RESET_ALLOWED_ORIGINS', None) or getattr(settings, 'CORS_ALLOWED_ORIGINS', None)
        if not raw:
            return []
        if isinstance(raw, (list, tuple, set)):
            return [item.rstrip('/') for item in raw if isinstance(item, str) and item.strip()]
        if isinstance(raw, str):
            return [item.rstrip('/') for item in raw.split(',') if item.strip()]
        return []


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