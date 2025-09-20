# server/worker/views.py
from django.shortcuts import render, get_object_or_404
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.core.paginator import Paginator
from django.db import models
from .serializers import (
    WorkerRegistrationSerializer,
    WorkerLoginSerializer,
    GoogleWorkerLoginSerializer,
    OrganizationMemberSerializer,
)
from .models import OrganizationMember
from organization.models import Organization
from organization.permissions import IsOrganizationAdmin
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
      - organization_id required in request body (aligns with IsOrganizationAdmin)
    Notes:
      - org_name remains supported in serializer for backward-compat, but this endpoint
        enforces organization_id to match permission behavior.
    """
    permission_classes = [IsAuthenticated, IsOrganizationAdmin]

    def post(self, request, *args, **kwargs):
        data = request.data.copy()

        # Require organization_id to comply with IsOrganizationAdmin
        org_id = data.get("organization_id") or data.get("org_id")
        if not org_id:
            return Response({"detail": "organization_id is required"}, status=400)

        # Resolve organization (permission already validated admin rights)
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({"detail": "Organization not found"}, status=404)

        # Pass through organization_id to serializer (org_name optional for BC)
        data["organization_id"] = str(org.id)

        serializer = WorkerRegistrationSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user = request.user
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_organization_users(request, org_id):
    """
    Get all users/members of a specific organization
    Supports filtering by role, search, and pagination
    """
    try:
        # Get the organization
        organization = get_object_or_404(Organization, id=org_id)
        
        # Check if the requesting user has permission to view this org's data
        user_membership = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
            role='ADMIN'
        ).first()
        
        if not user_membership:
            return Response({
                'success': False,
                'error': 'You do not have permission to view this organization\'s members'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get query parameters for filtering and pagination
        role_filter = request.GET.get('role', None)  # 'ADMIN' or 'USER'
        search = request.GET.get('search', None)
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # Build the queryset
        queryset = OrganizationMember.objects.select_related('user').filter(
            organization=organization
        )
        
        # Apply filters
        if role_filter and role_filter in ['ADMIN', 'USER']:
            queryset = queryset.filter(role=role_filter)
        
        if search:
            queryset = queryset.filter(
                models.Q(user__username__icontains=search) |
                models.Q(user__email__icontains=search) |
                models.Q(full_name__icontains=search) |
                models.Q(phone_number__icontains=search)
            )
        
        # Order by creation date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Pagination
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize the data
        serializer = OrganizationMemberSerializer(page_obj, many=True)
        
        # Response data
        response_data = {
            'success': True,
            'organization': {
                'id': str(organization.id),
                'name': getattr(organization, 'name', 'Unknown'),
            },
            'members': serializer.data,
            'pagination': {
                'current_page': page,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
            },
            'stats': {
                'total_members': organization.members.count(),
                'admin_count': organization.members.filter(role='ADMIN').count(),
                'user_count': organization.members.filter(role='USER').count(),
                'active_members': organization.members.filter(user__is_active=True).count(),
            }
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({
            'success': False,
            'error': 'Invalid organization ID format'
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_organization_user_detail(request, org_id, member_id):
    """
    Get detailed information of a specific organization member
    """
    try:
        organization = get_object_or_404(Organization, id=org_id)
        
        # Check permission
        user_membership = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
            role='ADMIN'
        ).first()
        
        if not user_membership:
            return Response({
                'success': False,
                'error': 'You do not have permission to view this organization\'s members'
            }, status=status.HTTP_403_FORBIDDEN)
        
        member = get_object_or_404(
            OrganizationMember.objects.select_related('user'),
            id=member_id,
            organization=organization
        )
        
        serializer = OrganizationMemberSerializer(member)
        
        return Response({
            'success': True,
            'member': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_organization_user(request, org_id, member_id):
    """
    Update organization member details
    """
    try:
        organization = get_object_or_404(Organization, id=org_id)
        
        # Check permission
        user_membership = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
            role='ADMIN'
        ).first()
        
        if not user_membership:
            return Response({
                'success': False,
                'error': 'You do not have permission to modify this organization\'s members'
            }, status=status.HTTP_403_FORBIDDEN)
        
        member = get_object_or_404(
            OrganizationMember.objects.select_related('user'),
            id=member_id,
            organization=organization
        )
        
        serializer = OrganizationMemberSerializer(member, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'member': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_organization_user(request, org_id, member_id):
    """
    Remove a user from organization
    """
    try:
        organization = get_object_or_404(Organization, id=org_id)
        
        # Check permission
        user_membership = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
            role='ADMIN'
        ).first()
        
        if not user_membership:
            return Response({
                'success': False,
                'error': 'You do not have permission to modify this organization\'s members'
            }, status=status.HTTP_403_FORBIDDEN)
        
        member = get_object_or_404(
            OrganizationMember.objects.select_related('user'),
            id=member_id,
            organization=organization
        )
        
        # Prevent self-deletion
        if member.user == request.user:
            return Response({
                'success': False,
                'error': 'You cannot remove yourself from the organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        member.delete()
        
        return Response({
            'success': True,
            'message': 'Member removed successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    Get current authenticated user's information including organization details
    """
    try:
        user = request.user
        
        # Get user's organization membership
        membership = OrganizationMember.objects.select_related('organization').filter(
            user=user
        ).first()
        
        if not membership:
            return Response({
                'success': False,
                'error': 'User is not associated with any organization'
            }, status=status.HTTP_404_NOT_FOUND)
        
        response_data = {
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': membership.full_name,  # Include full_name from membership
                'is_active': user.is_active,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'date_joined': user.date_joined.isoformat(),
            },
            'organization': {
                'id': str(membership.organization.id),
                'name': getattr(membership.organization, 'name', 'Unknown'),
                'role': membership.role,
                'member_id': str(membership.id),
            }
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_organization_logs(request, org_id):
    """
    Get all verification logs for a specific organization
    Supports filtering by user, status, date range, search, and pagination
    """
    try:
        from api.models import VerificationLog
        from api.serializers import VerificationLogSerializer
        
        # Get the organization
        organization = get_object_or_404(Organization, id=org_id)
        
        # Check if the requesting user has permission to view this org's data
        user_membership = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
            role='ADMIN'
        ).first()
        
        if not user_membership:
            return Response({
                'success': False,
                'error': 'You do not have permission to view this organization\'s logs'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get query parameters for filtering and pagination
        user_id = request.GET.get('user_id', None)
        status_filter = request.GET.get('status', None)  # 'SUCCESS' or 'FAILED'
        search = request.GET.get('search', None)
        date_from = request.GET.get('date_from', None)
        date_to = request.GET.get('date_to', None)
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # Build the queryset - select related user info to avoid N+1 queries
        queryset = VerificationLog.objects.filter(organization=organization).select_related('verified_by')
        
        # Apply filters
        if user_id:
            # Filter by specific user - get user from OrganizationMember
            try:
                member = OrganizationMember.objects.get(id=user_id, organization=organization)
                # Filter logs by the specific user who verified them
                queryset = queryset.filter(verified_by=member.user)
            except OrganizationMember.DoesNotExist:
                return Response({
                    'success': False,
                    'error': 'User not found in organization'
                }, status=status.HTTP_404_NOT_FOUND)
        
        if status_filter and status_filter in ['SUCCESS', 'FAILED']:
            queryset = queryset.filter(verification_status=status_filter)
        
        if search:
            queryset = queryset.filter(
                models.Q(vc_hash__icontains=search) |
                models.Q(error_message__icontains=search) |
                models.Q(credential_subject__icontains=search)
            )
        
        if date_from:
            from datetime import datetime
            date_from_obj = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            queryset = queryset.filter(verified_at__gte=date_from_obj)
        
        if date_to:
            from datetime import datetime
            date_to_obj = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            queryset = queryset.filter(verified_at__lte=date_to_obj)
        
        # Order by verification date (newest first)
        queryset = queryset.order_by('-verified_at')
        
        # Pagination
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize the data
        serializer = VerificationLogSerializer(page_obj, many=True)
        
        # Calculate stats based on the filtered queryset (not just organization logs)
        if user_id:
            # Stats for specific user only
            user_member = OrganizationMember.objects.get(id=user_id, organization=organization)
            user_logs_queryset = VerificationLog.objects.filter(organization=organization, verified_by=user_member.user)
            total_logs = user_logs_queryset.count()
            success_count = user_logs_queryset.filter(verification_status='SUCCESS').count()
            failed_count = user_logs_queryset.filter(verification_status='FAILED').count()
        else:
            # Stats for entire organization
            total_logs = organization.verification_logs.count()
            success_count = organization.verification_logs.filter(verification_status='SUCCESS').count()
            failed_count = organization.verification_logs.filter(verification_status='FAILED').count()
        
        # Response data
        response_data = {
            'success': True,
            'organization': {
                'id': str(organization.id),
                'name': getattr(organization, 'name', 'Unknown'),
            },
            'logs': serializer.data,
            'pagination': {
                'current_page': page,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
            },
            'stats': {
                'total_logs': total_logs,
                'success_count': success_count,
                'failed_count': failed_count,
            }
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({
            'success': False,
            'error': 'Invalid organization ID format'
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_organization_logs_stats(request, org_id):
    """
    Get verification logs statistics for a specific organization
    Supports filtering by user_id to get stats for a specific user
    """
    try:
        from api.models import VerificationLog
        from datetime import datetime, timedelta
        
        # Get the organization
        organization = get_object_or_404(Organization, id=org_id)
        
        # Check if the requesting user has permission to view this org's data
        user_membership = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
            role='ADMIN'
        ).first()
        
        if not user_membership:
            return Response({
                'success': False,
                'error': 'You do not have permission to view this organization\'s logs'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get user_id parameter for filtering
        user_id = request.GET.get('user_id', None)
        
        if user_id:
            # Stats for specific user only
            try:
                member = OrganizationMember.objects.get(id=user_id, organization=organization)
                user_logs_queryset = VerificationLog.objects.filter(organization=organization, verified_by=member.user)
                total_logs = user_logs_queryset.count()
                success_count = user_logs_queryset.filter(verification_status='SUCCESS').count()
                failed_count = user_logs_queryset.filter(verification_status='FAILED').count()
                
                # Recent logs (last 24 hours) for this user
                from django.utils import timezone
                last_24h = timezone.now() - timedelta(hours=24)
                recent_logs = user_logs_queryset.filter(verified_at__gte=last_24h).count()
            except OrganizationMember.DoesNotExist:
                return Response({
                    'success': False,
                    'error': 'User not found in organization'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            # Stats for entire organization
            total_logs = organization.verification_logs.count()
            success_count = organization.verification_logs.filter(verification_status='SUCCESS').count()
            failed_count = organization.verification_logs.filter(verification_status='FAILED').count()
            
            # Recent logs (last 24 hours)
            from django.utils import timezone
            last_24h = timezone.now() - timedelta(hours=24)
            recent_logs = organization.verification_logs.filter(verified_at__gte=last_24h).count()
        
        response_data = {
            'success': True,
            'stats': {
                'total_logs': total_logs,
                'success_count': success_count,
                'failed_count': failed_count,
                'recent_logs': recent_logs,
            }
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({
            'success': False,
            'error': 'Invalid organization ID format'
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_log_detail(request, log_id):
    """
    Get detailed information of a specific verification log
    """
    try:
        from api.models import VerificationLog
        from api.serializers import VerificationLogSerializer
        
        log = get_object_or_404(VerificationLog, id=log_id)
        
        # Check if the requesting user has permission to view this log
        if log.organization:
            user_membership = OrganizationMember.objects.filter(
                user=request.user,
                organization=log.organization,
                role='ADMIN'
            ).first()
            
            if not user_membership:
                return Response({
                    'success': False,
                    'error': 'You do not have permission to view this log'
                }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = VerificationLogSerializer(log)
        
        return Response({
            'success': True,
            'log': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def get_tokens_for_user(user):  # add helper if not already defined
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}
