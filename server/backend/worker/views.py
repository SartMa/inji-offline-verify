# server/worker/views.py
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from .serializers import (
    WorkerRegistrationSerializer,
    WorkerLoginSerializer,
    GoogleWorkerLoginSerializer,
)
from .models import OrganizationMember
from organization.models import Organization
from api.permissions import IsOrganizationAdmin
from api.serializers import VerificationLogSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction


class WorkerLoginView(APIView):
    """Login endpoint specifically for worker users."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = WorkerLoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GoogleWorkerLoginView(APIView):
    """Google OAuth login endpoint specifically for worker users."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = GoogleWorkerLoginSerializer(data=request.data)
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


class SyncVerificationLogsView(APIView):
    """
    View to handle synchronization of verification logs from worker devices.
    Moved from API app since this is worker-specific functionality.
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


def get_tokens_for_user(user):  # add helper if not already defined
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}
