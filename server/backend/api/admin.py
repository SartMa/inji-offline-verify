from django.contrib import admin
from .models import VerificationLog





@admin.register(VerificationLog)
class VerificationLogAdmin(admin.ModelAdmin):
    list_display = ("verification_status", "verified_at", "organization", "synced_at")
    list_filter = ("verification_status",)
    search_fields = ("vc_hash", "organization__name")