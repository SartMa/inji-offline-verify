from django.contrib import admin
from django.urls import path, include
from .views import (
    SyncVerificationLogsView as sync_verification_logs_view,
    RegisterOrganizationView,
    LoginView,
    RegisterWorkerView,
    SubmitOrganizationDIDView,
    OrganizationPublicKeysView,
    ContextListView,
    ContextUpsertView,
    ContextDefaultsView,
    ContextRefreshFromSourceView,
    EmailLoginCodeRequestView,
    EmailLoginCodeVerifyView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('sync/', sync_verification_logs_view.as_view(), name='sync_verification_logs'),
    path('auth/register/', RegisterOrganizationView.as_view(), name='register_organization'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/worker/register/', RegisterWorkerView.as_view(), name='register_worker'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # DID & Public Key endpoints
    path('org/submit-did/', SubmitOrganizationDIDView.as_view(), name='submit_org_did'),
    path('org/public-keys/', OrganizationPublicKeysView.as_view(), name='organization_public_keys'),
    # JSON-LD Context endpoints
    path('contexts/', ContextListView.as_view(), name='contexts_list'),
    path('contexts/defaults/', ContextDefaultsView.as_view(), name='contexts_defaults'),
    path('contexts/upsert/', ContextUpsertView.as_view(), name='contexts_upsert'),
    path('contexts/refresh/', ContextRefreshFromSourceView.as_view(), name='contexts_refresh'),
    # Email code login & password reset
    path('auth/email/request-code/', EmailLoginCodeRequestView.as_view(), name='email_login_request_code'),
    path('auth/email/verify-code/', EmailLoginCodeVerifyView.as_view(), name='email_login_verify_code'),
    path('auth/password/reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('auth/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
]