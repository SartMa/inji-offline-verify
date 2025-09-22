from django.contrib import admin
from .models import Organization, OrganizationDID, PublicKey, PendingOrganizationRegistration, JsonLdContext, RevokedVC

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


@admin.register(RevokedVC)
class RevokedVCAdmin(admin.ModelAdmin):
    list_display = ("vc_id", "organization", "issuer", "subject", "revoked_at")
    list_filter = ("revoked_at", "organization")
    search_fields = ("vc_id", "issuer", "subject", "organization__name")
    readonly_fields = ("revoked_at", "created_at", "updated_at")
