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
]
