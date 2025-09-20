# server/api/serializers.py
from rest_framework import serializers
from .models import VerificationLog, JsonLdContext
from worker.models import OrganizationMember, EmailLoginCode
from organization.models import Organization
from organization.serializers import OrganizationSerializer
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
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


class JsonLdContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = JsonLdContext
        fields = ["id", "url", "document", "created_at", "updated_at"]


class ContextListResponseSerializer(serializers.Serializer):
    contexts = JsonLdContextSerializer(many=True)


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