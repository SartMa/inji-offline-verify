# server/api/serializers.py
from rest_framework import serializers
from .models import VerificationLog

class VerificationLogSerializer(serializers.ModelSerializer):
    """
    Serializer for the VerificationLog model. It validates and converts
    incoming JSON data into VerificationLog model instances.
    """
    class Meta:
        model = VerificationLog
        # Define the fields that the API will accept.
        fields = [
            'id',
            'verification_status',
            'verified_at',
            'vc_hash',
            'credential_subject',
            'error_message',
        ]