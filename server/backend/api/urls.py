from django.contrib import admin
from django.urls import path, include
from .views import (
    SyncVerificationLogsView as sync_verification_logs_view,
    ContextListView,
    ContextUpsertView,
    ContextDefaultsView,
    ContextRefreshFromSourceView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Core verification functionality
    path('sync/', sync_verification_logs_view.as_view(), name='sync_verification_logs'),
    
    # JSON-LD Context endpoints (core functionality)
    path('contexts/', ContextListView.as_view(), name='contexts_list'),
    path('contexts/defaults/', ContextDefaultsView.as_view(), name='contexts_defaults'),
    path('contexts/upsert/', ContextUpsertView.as_view(), name='contexts_upsert'),
    path('contexts/refresh/', ContextRefreshFromSourceView.as_view(), name='contexts_refresh'),
    
    # JWT refresh token endpoint
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]