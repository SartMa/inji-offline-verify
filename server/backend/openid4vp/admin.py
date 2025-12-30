from django.contrib import admin
from .models import OpenID4VPSession


@admin.register(OpenID4VPSession)
class OpenID4VPSessionAdmin(admin.ModelAdmin):
    """Admin interface for OpenID4VP sessions."""
    
    list_display = [
        'session_id', 
        'organization', 
        'created_by', 
        'presentation_definition_id',
        'status', 
        'created_at', 
        'expires_at',
        'is_expired'
    ]
    
    list_filter = [
        'status', 
        'organization', 
        'presentation_definition_id',
        'created_at'
    ]
    
    search_fields = [
        'session_id', 
        'organization__name', 
        'created_by__username',
        'presentation_definition_id'
    ]
    
    readonly_fields = [
        'session_id', 
        'created_at', 
        'is_expired'
    ]
    
    ordering = ['-created_at']
    
    def is_expired(self, obj):
        """Display whether the session is expired."""
        return obj.is_expired()
    is_expired.boolean = True
    is_expired.short_description = 'Expired'