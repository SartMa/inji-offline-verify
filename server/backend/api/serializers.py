# server/api/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken
from .models import VerificationLog, Organization, OrganizationMember

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
    fields = ['id', 'name', 'did', 'created_at']
    read_only_fields = ['id', 'created_at']


class OrganizationRegistrationSerializer(serializers.Serializer):
    org_name = serializers.CharField(max_length=255)
    org_did = serializers.CharField(max_length=255)
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

    def validate_org_did(self, value):
        if Organization.objects.filter(did__iexact=value).exists():
            raise serializers.ValidationError('Organization DID already exists')
        return value

    def create(self, validated_data):
        org = Organization.objects.create(
            name=validated_data['org_name'],
            did=validated_data['org_did']
        )
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