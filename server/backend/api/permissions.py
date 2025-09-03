from rest_framework.permissions import BasePermission
from .models import OrganizationMember


class IsInOrganization(BasePermission):
    """Checks that the authenticated user belongs to any organization.
    Can be extended to check specific organization context.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return OrganizationMember.objects.filter(user=user).exists()
