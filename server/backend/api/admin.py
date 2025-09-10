from django.contrib import admin
from .models import JsonLdContext


@admin.register(JsonLdContext)
class JsonLdContextAdmin(admin.ModelAdmin):
	list_display = ("url", "created_at", "updated_at")
	search_fields = ("url",)
from .models import VerificationLog, Organization, OrganizationMember, OrganizationDID, PublicKey

# This line makes your model visible on the admin page
admin.site.register(VerificationLog)

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
	list_display = ("name", "id", "created_at")
	search_fields = ("name",)


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
	list_display = ("user", "organization", "role", "created_at")
	list_filter = ("role",)
	search_fields = ("user__username", "organization__name")


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