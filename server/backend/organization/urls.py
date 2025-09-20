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
    # path('api/submit-did/', views.SubmitOrganizationDIDView.as_view(), name='organization-submit-did'),
    # path('api/public-keys/', views.OrganizationPublicKeysView.as_view(), name='organization-public-keys'),
    path('api/contexts/upsert/', views.OrganizationContextUpsertView.as_view(), name='organization-contexts-upsert'),
    path('api/public-keys/upsert/', views.OrganizationPublicKeyUpsertView.as_view(), name='organization-public-keys-upsert'),
]
