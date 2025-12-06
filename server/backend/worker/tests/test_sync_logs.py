import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from organization.models import Organization
from worker.models import OrganizationMember
from django.contrib.auth import get_user_model


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def org():
    return Organization.objects.create(name="LogOrg")


@pytest.fixture
def worker_user(org):
    User = get_user_model()
    user = User.objects.create_user(username="logworker", email="logworker@example.com", password="LogWorker123!")
    OrganizationMember.objects.create(user=user, organization=org, role="USER")
    return user


@pytest.mark.django_db
def test_sync_logs_success(api_client: APIClient, worker_user):
    api_client.force_authenticate(user=worker_user)
    url = reverse('worker-sync')
    payload = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "verification_status": "SUCCESS",
            "verified_at": timezone.now().isoformat(),
            "vc_hash": "abc",
            "credential_subject": {"name": "Alice"}
        }
    ]
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data.get('synced_count') == 1


@pytest.mark.django_db
def test_sync_logs_requires_list(api_client: APIClient, worker_user):
    api_client.force_authenticate(user=worker_user)
    url = reverse('worker-sync')
    resp = api_client.post(url, {"foo": "bar"}, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
