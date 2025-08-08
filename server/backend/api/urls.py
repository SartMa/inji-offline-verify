from django.contrib import admin
from django.urls import path, include
from .views import SyncVerificationLogsView as sync_verification_logs_view

urlpatterns = [
    path('sync/', sync_verification_logs_view.as_view(), name='sync_verification_logs'),
]