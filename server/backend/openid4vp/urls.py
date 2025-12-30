from django.urls import path
from . import views

app_name = 'openid4vp'

urlpatterns = [
    # Session management endpoints
    path('sessions/', views.CreateSessionView.as_view(), name='create_session'),
    
    # OpenID4VP protocol endpoints
    path('presentation-definition/<uuid:session_id>/', 
         views.PresentationDefinitionView.as_view(), 
         name='presentation_definition'),
    
    path('presentation/<uuid:session_id>/', 
         views.PresentationSubmissionView.as_view(), 
         name='presentation_submission'),
    
    path('status/<uuid:session_id>/', 
         views.SessionStatusView.as_view(), 
         name='session_status'),
]