import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from datetime import date

from organization.models import Organization
from worker.models import OrganizationMember


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def org():
    return Organization.objects.create(name="Acme")


@pytest.fixture
def admin_user(org):
    User = get_user_model()
    user = User.objects.create_user(username="admin", email="admin@example.com", password="AdminPass123!", is_staff=True)
    OrganizationMember.objects.create(user=user, organization=org, role="ADMIN")
    return user


@pytest.fixture
def worker_user(org):
    User = get_user_model()
    user = User.objects.create_user(username="worker", email="worker@example.com", password="WorkerPass123!")
    OrganizationMember.objects.create(user=user, organization=org, role="USER")
    return user


@pytest.mark.django_db
def test_worker_register_success(api_client: APIClient, admin_user, org):
    api_client.force_authenticate(user=admin_user)
    url = reverse('worker-register')
    payload = {
        "organization_id": str(org.id),
        "username": "newworker",
        "password": "NewWorker123!",
        "email": "newworker@example.com",
        "full_name": "New Worker",
        "phone_number": "1234567890",
        "gender": "M",
        "dob": date(2000, 1, 1)
    }
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data.get('access') and resp.data.get('refresh')


@pytest.mark.django_db
def test_worker_register_requires_admin(api_client: APIClient, worker_user, org):
    api_client.force_authenticate(user=worker_user)
    url = reverse('worker-register')
    payload = {
        "organization_id": str(org.id),
        "username": "badworker",
        "password": "BadWorker123!",
        "email": "badworker@example.com",
        "full_name": "Bad Worker",
        "phone_number": "1234567890",
        "gender": "M",
        "dob": date(2000, 1, 1)
    }
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_worker_login_success(api_client: APIClient, worker_user, org):
    url = reverse('worker-login')
    payload = {
        "username": worker_user.username,
        "password": "WorkerPass123!",
        "org_name": org.name
    }
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_200_OK
    assert resp.data.get('access') and resp.data.get('refresh')


@pytest.mark.django_db
def test_worker_login_invalid_password(api_client: APIClient, worker_user, org):
    url = reverse('worker-login')
    payload = {
        "username": worker_user.username,
        "password": "WrongPass!",
        "org_name": org.name
    }
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_worker_login_org_not_found(api_client: APIClient, worker_user):
    url = reverse('worker-login')
    payload = {
        "username": worker_user.username,
        "password": "WorkerPass123!",
        "org_name": "MissingOrg"
    }
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_worker_login_not_member_of_org(api_client: APIClient, org):
    User = get_user_model()
    user = User.objects.create_user(username="nomember", email="nomember@example.com", password="NoMember123!")
    other_org = Organization.objects.create(name="OtherOrg")
    OrganizationMember.objects.create(user=user, organization=other_org, role="USER")

    url = reverse('worker-login')
    payload = {
        "username": user.username,
        "password": "NoMember123!",
        "org_name": org.name
    }
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
