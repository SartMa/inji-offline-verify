from django.contrib import admin
from django.urls import path, include
from .views import (
    EmailLoginCodeRequestView,
    EmailLoginCodeVerifyView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # # JSON-LD Context endpoints (core functionality)
    # path('contexts/', ContextListView.as_view(), name='contexts_list'),
    # path('contexts/defaults/', ContextDefaultsView.as_view(), name='contexts_defaults'),
    # path('contexts/upsert/', ContextUpsertView.as_view(), name='contexts_upsert'),
    # path('contexts/refresh/', ContextRefreshFromSourceView.as_view(), name='contexts_refresh'),
    
    # Shared Authentication endpoints (used by both organization and worker frontends)
    # Note: Login endpoints are now app-specific (/organization/api/login/ and /worker/api/login/)
    

    path('auth/email/request-code/', EmailLoginCodeRequestView.as_view(), name='email-request-code'),
    path('auth/email/verify-code/', EmailLoginCodeVerifyView.as_view(), name='email-verify-code'),
    
    # Password reset endpoints
    path('auth/password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # JWT token refresh
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]