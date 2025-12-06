import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from django.test import override_settings

from organization.models import Organization, PendingOrganizationRegistration
from worker.models import OrganizationMember


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_organization_register_and_confirm_and_login(api_client: APIClient):
    # Register
    register_url = reverse('organization-register')
    payload = {
        "org_name": "OrgOne",
        "admin_username": "orgadmin",
        "admin_password": "OrgAdmin123!",
        "admin_email": "admin@orgone.com",
    }
    reg_resp = api_client.post(register_url, payload, format='json')
    assert reg_resp.status_code == status.HTTP_201_CREATED
    pending_id = reg_resp.data['pending_id']
    otp = reg_resp.data['debug_otp']

    # Confirm
    confirm_url = reverse('organization-confirm')
    confirm_resp = api_client.post(confirm_url, {"pending_id": pending_id, "otp_code": otp}, format='json')
    assert confirm_resp.status_code == status.HTTP_201_CREATED
    org_id = confirm_resp.data['organization']['id']

    # Login
    login_url = reverse('organization-login')
    login_payload = {
        "username": payload['admin_username'],
        "password": payload['admin_password'],
        "org_name": payload['org_name'],
    }
    login_resp = api_client.post(login_url, login_payload, format='json')
    assert login_resp.status_code == status.HTTP_200_OK
    assert login_resp.data.get('access') and login_resp.data.get('refresh')
    assert login_resp.data.get('organization', {}).get('id') == org_id


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_organization_confirm_invalid_otp(api_client: APIClient):
    register_url = reverse('organization-register')
    payload = {
        "org_name": "OrgTwo",
        "admin_username": "orgadmin2",
        "admin_password": "OrgAdmin234!",
        "admin_email": "admin2@orgtwo.com",
    }
    reg_resp = api_client.post(register_url, payload, format='json')
    assert reg_resp.status_code == status.HTTP_201_CREATED
    pending_id = reg_resp.data['pending_id']

    confirm_url = reverse('organization-confirm')
    confirm_resp = api_client.post(confirm_url, {"pending_id": pending_id, "otp_code": "000000"}, format='json')
    assert confirm_resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_organization_login_requires_admin_role(api_client: APIClient):
    User = get_user_model()
    org = Organization.objects.create(name="RoleOrg")
    user = User.objects.create_user(username="useronly", password="UserOnly123!", email="useronly@example.com")
    OrganizationMember.objects.create(user=user, organization=org, role='USER')

    login_url = reverse('organization-login')
    payload = {
        "username": user.username,
        "password": "UserOnly123!",
        "org_name": org.name,
    }
    resp = api_client.post(login_url, payload, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
