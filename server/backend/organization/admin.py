from django.contrib import admin
from .models import (
    Organization,
    OrganizationDID,
    PublicKey,
    PendingOrganizationRegistration,
    JsonLdContext,
    StatusListCredential,
    StatusListCredentialHistory,
)

@admin.register(JsonLdContext)
class JsonLdContextAdmin(admin.ModelAdmin):
    list_display = ("url", "created_at", "updated_at")
    search_fields = ("url",)

    
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


@admin.register(StatusListCredential)
class StatusListCredentialAdmin(admin.ModelAdmin):
    list_display = ("status_list_id", "organization", "issuer", "purposes_display", "version", "encoded_list_hash_short", "updated_at")
    list_filter = ("organization", "issuer")
    search_fields = ("status_list_id", "issuer", "organization__name")
    readonly_fields = ("version", "encoded_list_hash", "issuance_date", "created_at", "updated_at")

    def purposes_display(self, obj):
        return ", ".join(obj.purposes or [])
    purposes_display.short_description = "Purposes"

    def encoded_list_hash_short(self, obj):
        return (obj.encoded_list_hash[:12] + "…") if obj.encoded_list_hash else ""
    encoded_list_hash_short.short_description = "Hash"


@admin.register(StatusListCredentialHistory)
class StatusListCredentialHistoryAdmin(admin.ModelAdmin):
    list_display = ("status_list_id", "organization", "version", "archived_at", "issuance_date")
    search_fields = ("status_list_id", "organization__name")
    readonly_fields = ("status_list_current", "organization", "status_list_id", "issuer", "purposes", "version", "issuance_date", "encoded_list_hash", "full_credential", "archived_at")
