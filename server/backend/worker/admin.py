from django.contrib import admin
from .models import OrganizationMember, EmailLoginCode


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "organization__name")


@admin.register(EmailLoginCode)
class EmailLoginCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "code", "created_at", "expires_at", "consumed_at")
    list_filter = ("consumed_at",)
    search_fields = ("user__username", "user__email")
