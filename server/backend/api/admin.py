from django.contrib import admin
from .models import VerificationLog

# This line makes your model visible on the admin page
admin.site.register(VerificationLog)