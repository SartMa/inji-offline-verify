from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from .serializers import (
    VerificationLogSerializer,
    OrganizationRegistrationSerializer,
    LoginSerializer,
    WorkerRegistrationSerializer,
)
from django.db import transaction
from .models import OrganizationMember
# Create your views here.


class SyncVerificationLogsView(APIView):
    """
    View to handle synchronization of verification logs.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        """Create or update verification logs for the authenticated organization."""
        logs_data = request.data
        if not isinstance(logs_data, list):
            return Response(
                {"error": "Request body must be a list of log objects."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VerificationLogSerializer(
            data=logs_data,
            many=True,
            context={"request": request},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                serializer.save()
            return Response(
                {"status": "success", "synced_count": len(serializer.data)},
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {"error": f"An error occurred during database transaction: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RegisterOrganizationView(APIView):
    """Register a new organization with an admin user and return auth token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = OrganizationRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            org = data['organization']
            user = data['user']
            token = data['token']
            return Response(
                {
                    'organization': {
                        'id': str(org.id),
                        'name': org.name,
                    },
                    'user': {
                        'username': user.username,
                        'email': user.email,
                    },
                    'token': token,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """Login existing user and return auth token and org context."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterWorkerView(APIView):
    """Register a worker under an organization (admin only)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Verify requesting user is admin of the target org
        serializer = WorkerRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        org = serializer.validated_data['org']
        is_admin = OrganizationMember.objects.filter(
            user=request.user, organization=org, role='ADMIN'
        ).exists()
        if not is_admin:
            return Response({'detail': 'Admin privileges required for this org'}, status=status.HTTP_403_FORBIDDEN)

        data = serializer.save()
        return Response(
            {
                'organization': {'id': str(data['organization'].id), 'name': data['organization'].name},
                'user': {'username': data['user'].username, 'email': data['user'].email},
                'member': {
                    'role': data['member'].role,
                    'full_name': data['member'].full_name,
                    'phone_number': data['member'].phone_number,
                    'gender': data['member'].gender,
                    'dob': data['member'].dob,
                },
                'access': data['access'],
                'refresh': data['refresh'],
            },
            status=status.HTTP_201_CREATED,
        )
