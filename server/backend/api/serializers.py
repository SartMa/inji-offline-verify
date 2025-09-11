# server/api/serializers.py
from rest_framework import serializers
from .models import VerificationLog, JsonLdContext
from worker.models import OrganizationMember


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
            'organization',
        ]

    read_only_fields = ['organization']

    def create(self, validated_data):
        request = self.context.get('request')
        org = None
        if request and request.user and request.user.is_authenticated:
            # Pick the first organization membership; later we can support header-based org selection
            membership = OrganizationMember.objects.filter(user=request.user).first()
            if membership:
                org = membership.organization
        validated_data['organization'] = org
        return super().create(validated_data)


class JsonLdContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = JsonLdContext
        fields = ["id", "url", "document", "created_at", "updated_at"]


class ContextListResponseSerializer(serializers.Serializer):
    contexts = JsonLdContextSerializer(many=True)