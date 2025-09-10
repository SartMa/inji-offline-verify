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
]