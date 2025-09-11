# server/worker/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Add worker-specific API endpoints here
# router.register('members', views.OrganizationMemberViewSet)
# router.register('email-codes', views.EmailLoginCodeViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    # Worker-specific endpoints
    path('api/login/', views.LoginView.as_view(), name='worker-login'),
    path('api/register/', views.RegisterWorkerView.as_view(), name='worker-register'),
    path('api/email-login/request/', views.EmailLoginCodeRequestView.as_view(), name='email-login-request'),
    path('api/email-login/verify/', views.EmailLoginCodeVerifyView.as_view(), name='email-login-verify'),
    path('api/password-reset/request/', views.PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('api/password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
]
