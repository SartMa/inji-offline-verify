# server/worker/views.py
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from .serializers import (
    LoginSerializer,
    WorkerRegistrationSerializer,
    EmailLoginCodeRequestSerializer,
    EmailLoginCodeVerifySerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .models import OrganizationMember
from organization.models import Organization
from api.permissions import IsOrganizationAdmin
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken


class LoginView(APIView):
    """Login existing user and return auth token and org context."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterWorkerView(APIView):
    """
    Registers a worker.
    Requirements:
      - Authenticated user
      - User is ADMIN of the target organization
      - org_name required only if the admin belongs to multiple organizations
    NOTE: org_id has been removed. Use org_name.
    """
    permission_classes = [IsAuthenticated, IsOrganizationAdmin]

    def post(self, request, *args, **kwargs):
        user = request.user
        admin_qs = OrganizationMember.objects.filter(user=user, role="ADMIN").select_related("organization")
        if not admin_qs.exists():
            return Response({"detail": "Not authorized"}, status=403)

        data = request.data.copy()

        # Reject deprecated org_id usage
        if "org_id" in data:
            return Response({"detail": "org_id is no longer supported. Use org_name."}, status=400)

        org_name = data.get("org_name")
        if org_name:
            org = next((m.organization for m in admin_qs if m.organization.name == org_name), None)
            if not org:
                return Response({"detail": "You are not admin of provided org_name"}, status=403)
        else:
            if admin_qs.count() == 1:
                org = admin_qs.first().organization
            else:
                return Response({"detail": "Multiple admin organizations. Provide org_name."}, status=400)

        # Enforce (prevent spoofing)
        data["org_name"] = org.name

        serializer = WorkerRegistrationSerializer(data=data, context={"organization": org})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        save_result = serializer.save(organization=org, created_by=user)

        # Robust handling of various return shapes
        worker_user = None
        membership = None
        if isinstance(save_result, tuple):
            if len(save_result) == 2:
                worker_user, membership = save_result
            elif len(save_result) >= 1:
                worker_user = save_result[0]
                membership = save_result[1] if len(save_result) > 1 else None
            else:
                return Response({"detail": "Serializer returned empty tuple"}, status=500)
        elif isinstance(save_result, dict):
            worker_user = (
                save_result.get("user")
                or save_result.get("worker_user")
                or save_result.get("worker")
                or save_result.get("account")
            )
            membership = save_result.get("member") or save_result.get("membership")
        else:
            # Single object (assume user)
            worker_user = save_result

        if worker_user is None:
            return Response({"detail": "Could not determine created user from serializer.save()"}, status=500)

        tokens = get_tokens_for_user(worker_user)

        return Response(
            {
                "organization": {"id": str(org.id), "name": org.name},
                "user": {
                    "id": worker_user.id,
                    "username": worker_user.username,
                    "email": worker_user.email,
                },
                "member": {
                    "id": getattr(membership, "id", None),
                    "role": getattr(membership, "role", None),
                },
                "access": tokens["access"],
                "refresh": tokens["refresh"],
            },
            status=201,
        )


class EmailLoginCodeRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = EmailLoginCodeRequestSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            # In production, don't return code. Provided here for test convenience.
            return Response({'email': data['email'], 'code': data['code'], 'expires_at': data['expires_at']}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmailLoginCodeVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = EmailLoginCodeVerifySerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def get_tokens_for_user(user):  # add helper if not already defined
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}
