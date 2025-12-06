import pytest
from datetime import timedelta
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import status
from rest_framework.test import APIClient
from django.test import override_settings
from django.contrib.auth.tokens import default_token_generator

from worker.models import EmailLoginCode


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user():
    User = get_user_model()
    return User.objects.create_user(
        username="bob",
        email="bob@example.com",
        password="Secret123!"
    )


@pytest.mark.django_db
def test_verify_email_login_code_expired(api_client: APIClient, user):
    expired_code = EmailLoginCode.objects.create(
        user=user,
        code="999999",
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    url = reverse('email-verify-code')
    resp = api_client.post(url, {"email": user.email, "code": expired_code.code}, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_verify_email_login_code_consumed(api_client: APIClient, user):
    consumed_code = EmailLoginCode.objects.create(
        user=user,
        code="111111",
        expires_at=timezone.now() + timedelta(minutes=5),
        consumed_at=timezone.now()
    )
    url = reverse('email-verify-code')
    resp = api_client.post(url, {"email": user.email, "code": consumed_code.code}, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_password_reset_request_rejects_absolute_reset_path(api_client: APIClient, user):
    url = reverse('password-reset-request')
    payload = {"email": user.email, "reset_path": "http://evil.com/reset"}
    resp = api_client.post(url, payload, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_password_reset_confirm_invalid_uid(api_client: APIClient, user):
    bad_uid = "not-base64"
    token = default_token_generator.make_token(user)
    url = reverse('password-reset-confirm')
    resp = api_client.post(
        url,
        {"uid": bad_uid, "token": token, "new_password": "Another123!"},
        format='json'
    )

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
