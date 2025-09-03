from django.contrib import admin
from django.urls import path, include
from .views import (
    SyncVerificationLogsView as sync_verification_logs_view,
    RegisterOrganizationView,
    LoginView,
    RegisterWorkerView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('sync/', sync_verification_logs_view.as_view(), name='sync_verification_logs'),
    path('auth/register/', RegisterOrganizationView.as_view(), name='register_organization'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/worker/register/', RegisterWorkerView.as_view(), name='register_worker'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]