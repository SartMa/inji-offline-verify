# server/worker/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken
from .models import OrganizationMember
from organization.models import Organization
from organization.serializers import OrganizationSerializer


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


class WorkerLoginSerializer(serializers.Serializer):
    """Login serializer specifically for worker users."""
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

        # Check if user is a member of this organization
        membership = OrganizationMember.objects.filter(user=user, organization=org).first()
        if not membership:
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
            'role': membership.role,
            'member_id': str(membership.id),
            'login_type': 'worker',
        }


class GoogleWorkerLoginSerializer(serializers.Serializer):
    """Google OAuth login serializer specifically for worker users."""
    access_token = serializers.CharField()
    org_name = serializers.CharField()

    def validate(self, attrs):
        access_token = attrs['access_token']
        org_name = attrs['org_name']
        
        try:
            # Verify the Google access token by making a request to Google's API
            import requests as http_requests
            response = http_requests.get(
                f'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={access_token}',
                timeout=10
            )
            
            if response.status_code != 200:
                raise serializers.ValidationError('Invalid Google access token')
            
            token_info = response.json()
            email = token_info.get('email')
            
            if not email:
                raise serializers.ValidationError('Could not retrieve email from Google token')
                
        except Exception as e:
            raise serializers.ValidationError(f'Failed to verify Google token: {str(e)}')
        
        # Check if organization exists
        try:
            org = Organization.objects.get(name__iexact=org_name)
        except Organization.DoesNotExist:
            raise serializers.ValidationError('Organization not found')
        
        # Check if user with this email exists and is a member of the organization
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('No worker account found with this email address. Please contact your admin to register first.')
        
        # Check if user is a member of this organization
        membership = OrganizationMember.objects.filter(user=user, organization=org).first()
        if not membership:
            raise serializers.ValidationError('This email is not registered as a worker for this organization')
        
        # Issue both DRF token (backward compat) and JWT pair
        token, _ = Token.objects.get_or_create(user=user)
        jwt = RefreshToken.for_user(user)
        
        return {
            'token': token.key,
            'access': str(jwt.access_token),
            'refresh': str(jwt),
            'username': user.username,
            'email': user.email,
            'organization': OrganizationSerializer(org).data,
            'is_staff': bool(user.is_staff),
            'role': membership.role,
            'member_id': str(membership.id),
            'login_type': 'worker_google',
        }


class OrganizationMemberSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationMember model with user details"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    last_login = serializers.DateTimeField(source='user.last_login', read_only=True)
    date_joined = serializers.DateTimeField(source='user.date_joined', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = OrganizationMember
        fields = [
            'id', 'user_id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'full_name', 'phone_number', 'gender',
            'gender_display', 'dob', 'created_at', 'is_active', 'last_login',
            'date_joined'
        ]
        read_only_fields = ['id', 'created_at']

    def update(self, instance, validated_data):
        # Update OrganizationMember fields
        instance.role = validated_data.get('role', instance.role)
        instance.full_name = validated_data.get('full_name', instance.full_name)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.gender = validated_data.get('gender', instance.gender)
        instance.dob = validated_data.get('dob', instance.dob)
        instance.save()
        return instance
