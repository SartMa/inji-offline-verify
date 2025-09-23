from rest_framework.permissions import BasePermission
from worker.models import OrganizationMember

class IsOrganizationAdmin(BasePermission):
    """
    Allow only users who are ADMIN in the given organization.
    Expects organization_id in request.data (POST) or in query params (GET).
    """
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        org_id = None
        if hasattr(request, 'data') and isinstance(request.data, dict):
            org_id = request.data.get('organization_id')
        if not org_id:
            org_id = request.query_params.get('organization_id')
        if not org_id:
            return False
        return OrganizationMember.objects.filter(
            user=user, organization_id=org_id, role='ADMIN'
        ).exists()


class IsOrganizationAdminFromMembership(BasePermission):
    """
    Allow only users who are ADMIN or OWNER in any organization they belong to.
    This is used for detail views where organization_id is not in the request.
    The view logic will ensure the resource belongs to the user's organization.
    """
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        
        # Check if user is ADMIN or OWNER in any organization
        return OrganizationMember.objects.filter(
            user=user, 
            role__in=['ADMIN', 'OWNER']
        ).exists()