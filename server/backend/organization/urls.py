# server/organization/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Add organization-specific API endpoints here
# router.register('organizations', views.OrganizationViewSet)
# router.register('dids', views.OrganizationDIDViewSet)
# router.register('public-keys', views.PublicKeyViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    # Organization-specific endpoints
    path('api/login/', views.OrganizationLoginView.as_view(), name='organization-login'),
    path('api/register/', views.RegisterOrganizationView.as_view(), name='organization-register'),
    path('api/confirm/', views.ConfirmOrganizationRegistrationView.as_view(), name='organization-confirm'),
    path('api/contexts/', views.OrganizationContextsView.as_view(), name='organization-contexts'),
    path('api/contexts/upsert/', views.OrganizationContextUpsertView.as_view(), name='organization-contexts-upsert'),
    path('api/public-keys/', views.OrganizationPublicKeysView.as_view(), name='organization-public-keys'),
    path('api/public-keys/upsert/', views.OrganizationPublicKeyUpsertView.as_view(), name='organization-public-keys-upsert'),
    path('api/public-keys/<path:key_id>/', views.OrganizationPublicKeyDetailView.as_view(), name='organization-public-key-detail'),
    path('api/public-keys/upsert/', views.OrganizationPublicKeyUpsertView.as_view(), name='organization-public-keys-upsert'),
    # StatusList credentials endpoints
    path('api/status-list-credentials/', views.OrganizationStatusListCredentialsView.as_view(), name='organization-status-list-credentials'),
    path('api/status-list-credentials/upsert/', views.OrganizationStatusListCredentialUpsertView.as_view(), name='organization-status-list-credentials-upsert'),
    path('api/status-list-credentials/<path:status_list_id>/', views.OrganizationStatusListCredentialDetailView.as_view(), name='organization-status-list-credential-detail'),
]
