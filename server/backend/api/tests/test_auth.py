import pytest
from datetime import timedelta
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.utils import timezone
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from worker.models import EmailLoginCode


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user():
    User = get_user_model()
    return User.objects.create_user(
        username="alice",
        email="alice@example.com",
        password="Secret123!"
    )


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
def test_request_email_login_code_success(api_client: APIClient, user):
    url = reverse('email-request-code')
    resp = api_client.post(url, {"email": user.email}, format='json')

    assert resp.status_code == status.HTTP_201_CREATED
    assert 'code' in resp.data
    code = resp.data['code']
    assert EmailLoginCode.objects.filter(user=user, code=code).exists()


@pytest.mark.django_db
def test_request_email_login_code_invalid_email(api_client: APIClient):
    url = reverse('email-request-code')
    resp = api_client.post(url, {"email": "nobody@example.com"}, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_verify_email_login_code_success(api_client: APIClient, user):
    code = '123456'
    EmailLoginCode.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=5)
    )

    url = reverse('email-verify-code')
    resp = api_client.post(url, {"email": user.email, "code": code}, format='json')

    assert resp.status_code == status.HTTP_200_OK
    assert 'access' in resp.data
    assert 'refresh' in resp.data
    assert resp.data.get('email_login') is True


@pytest.mark.django_db
def test_verify_email_login_code_invalid(api_client: APIClient, user):
    url = reverse('email-verify-code')
    resp = api_client.post(url, {"email": user.email, "code": "000000"}, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
def test_password_reset_request_success(api_client: APIClient, user):
    url = reverse('password-reset-request')
    resp = api_client.post(url, {"email": user.email}, format='json')

    assert resp.status_code == status.HTTP_200_OK
    assert resp.data.get('status') == 'password reset email sent'
    assert resp.data.get('debug') is not None


@pytest.mark.django_db
def test_password_reset_request_unknown_email(api_client: APIClient):
    url = reverse('password-reset-request')
    resp = api_client.post(url, {"email": "missing@example.com"}, format='json')

    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_password_reset_confirm_success(api_client: APIClient, user):
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    url = reverse('password-reset-confirm')
    new_password = 'NewSecret123!'
    resp = api_client.post(
        url,
        {"uid": uid, "token": token, "new_password": new_password},
        format='json'
    )

    assert resp.status_code == status.HTTP_200_OK
    assert resp.data.get('status') == 'password reset successful'

    user.refresh_from_db()
    assert user.check_password(new_password)


@pytest.mark.django_db
def test_password_reset_confirm_invalid_token(api_client: APIClient, user):
    bad_token = 'invalid-token'
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    url = reverse('password-reset-confirm')
    resp = api_client.post(
        url,
        {"uid": uid, "token": bad_token, "new_password": 'Whatever123!'},
        format='json'
    )

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
