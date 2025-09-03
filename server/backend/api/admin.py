from django.contrib import admin
from .models import VerificationLog, Organization, OrganizationMember

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