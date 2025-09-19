from rest_framework.permissions import BasePermission
from worker.models import OrganizationMember


class IsOrganizationAdmin(BasePermission):
    """
    Allows access only to authenticated users who are ADMIN in at least one organization.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return OrganizationMember.objects.filter(user=user, role="ADMIN").exists()
