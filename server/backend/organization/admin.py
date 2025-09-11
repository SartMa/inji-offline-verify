from django.contrib import admin
from .models import Organization, OrganizationDID, PublicKey, PendingOrganizationRegistration


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "id", "created_at")
    search_fields = ("name",)


@admin.register(OrganizationDID)
class OrganizationDIDAdmin(admin.ModelAdmin):
    list_display = ("did", "organization", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("did", "organization__name")


@admin.register(PublicKey)
class PublicKeyAdmin(admin.ModelAdmin):
    list_display = ("key_id", "organization", "controller", "key_type", "is_active")
    list_filter = ("is_active", "key_type")
    search_fields = ("key_id", "controller", "organization__name")


@admin.register(PendingOrganizationRegistration)
class PendingOrganizationRegistrationAdmin(admin.ModelAdmin):
    list_display = ("org_name", "admin_username", "admin_email", "created_at", "consumed_at")
    list_filter = ("consumed_at",)
    search_fields = ("org_name", "admin_username", "admin_email")
