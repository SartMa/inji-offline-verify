# server/organization/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

urlpatterns = [
    path('api/', include(router.urls)),
    # Organization auth & registration
    path('api/login/', views.OrganizationLoginView.as_view(), name='organization-login'),
    path('api/register/', views.RegisterOrganizationView.as_view(), name='organization-register'),
    path('api/confirm/', views.ConfirmOrganizationRegistrationView.as_view(), name='organization-confirm'),

    # Contexts
    path('api/contexts/', views.OrganizationContextsView.as_view(), name='organization-contexts'),
    path('api/contexts/upsert/', views.OrganizationContextUpsertView.as_view(), name='organization-contexts-upsert'),

    # Public keys
    path('api/public-keys/', views.OrganizationPublicKeysView.as_view(), name='organization-public-keys'),
    path('api/public-keys/upsert/', views.OrganizationPublicKeyUpsertView.as_view(), name='organization-public-keys-upsert'),
    path('api/public-keys/<path:key_id>/', views.OrganizationPublicKeyDetailView.as_view(), name='organization-public-key-detail'),

    # Status list credential operations
    path('api/status-list-credentials/', views.StatusListCredentialListView.as_view(), name='status-list-credentials'),
    path('api/status-list-credentials/upsert/', views.StatusListCredentialUpsertView.as_view(), name='status-list-credentials-upsert'),
    path('api/status-list-credentials/manifest/', views.StatusListCredentialManifestView.as_view(), name='status-list-credentials-manifest'),
]
