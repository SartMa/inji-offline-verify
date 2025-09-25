# server/worker/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Add worker-specific API endpoints here
# router.register('members', views.OrganizationMemberViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    # Worker-specific endpoints
    path('api/login/', views.WorkerLoginView.as_view(), name='worker-login'),
    path('api/google-login/', views.GoogleWorkerLoginView.as_view(), name='worker-google-login'),
    path('api/register/', views.RegisterWorkerView.as_view(), name='worker-register'),
    path('api/sync/', views.SyncVerificationLogsView.as_view(), name='worker-sync'),
    
    # User information endpoints
    path('api/me/', views.get_current_user, name='current-user'),
    
    # Organization member management endpoints
    path('api/organizations/<uuid:org_id>/users/', views.get_organization_users, name='organization-users'),
    path('api/organizations/<uuid:org_id>/users/<uuid:member_id>/', views.get_organization_user_detail, name='organization-user-detail'),
    path('api/organizations/<uuid:org_id>/users/<uuid:member_id>/update/', views.update_organization_user, name='organization-user-update'),
    path('api/organizations/<uuid:org_id>/users/<uuid:member_id>/delete/', views.delete_organization_user, name='organization-user-delete'),
    
    # Verification logs endpoints
    path('api/organizations/<uuid:org_id>/logs/', views.get_organization_logs, name='organization-logs'),
    path('api/organizations/<uuid:org_id>/logs/stats/', views.get_organization_logs_stats, name='organization-logs-stats'),
    path('api/logs/<uuid:log_id>/', views.get_log_detail, name='log-detail'),
    path('api/historical-logs/', views.get_worker_historical_logs, name='worker-historical-logs'),
]
