from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from .serializers import (
    VerificationLogSerializer,
    JsonLdContextSerializer,
    ContextListResponseSerializer,
)
from django.db import transaction
from .models import JsonLdContext
from rest_framework.permissions import IsAuthenticated
from worker.models import OrganizationMember

try:
    import requests
except Exception:  # pragma: no cover
    requests = None


class SyncVerificationLogsView(APIView):
    """
    View to handle synchronization of verification logs.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        """Create or update verification logs for the authenticated organization."""
        logs_data = request.data
        if not isinstance(logs_data, list):
            return Response(
                {"error": "Request body must be a list of log objects."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VerificationLogSerializer(
            data=logs_data,
            many=True,
            context={"request": request},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                serializer.save()
            return Response(
                {"status": "success", "synced_count": len(serializer.data)},
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {"error": f"An error occurred during database transaction: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ContextListView(APIView):
    """Return all stored JSON-LD contexts (authenticated)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = JsonLdContext.objects.all().order_by('url')
        serializer = JsonLdContextSerializer(qs, many=True)
        return Response({ 'contexts': serializer.data }, status=status.HTTP_200_OK)


class ContextUpsertView(APIView):
    """Create or update a JSON-LD context (admin only)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Simple admin gate: require is_staff
        if not request.user.is_staff:
            return Response({ 'detail': 'Admin only' }, status=status.HTTP_403_FORBIDDEN)
        serializer = JsonLdContextSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        obj, created = JsonLdContext.objects.update_or_create(
            url=data['url'], defaults={ 'document': data['document'] }
        )
        out = JsonLdContextSerializer(obj).data
        return Response(out, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ContextDefaultsView(APIView):
    """Return only the default required contexts used by the client."""
    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_URLS = [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/v1',
        'https://w3id.org/security/v2',
    ]

    def get(self, request, *args, **kwargs):
        qs = JsonLdContext.objects.filter(url__in=self.DEFAULT_URLS).order_by('url')
        serializer = JsonLdContextSerializer(qs, many=True)
        return Response({ 'contexts': serializer.data }, status=status.HTTP_200_OK)


class ContextRefreshFromSourceView(APIView):
    """Admin-only: fetch exact context JSON from source URLs and store in DB."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
        urls = request.data.get('urls') or [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/security/v1',
            'https://w3id.org/security/v2',
        ]
        timeout = 15
        updated = []
        failed = []
        for url in urls:
            try:
                resp = requests.get(url, timeout=timeout, headers={'Accept': 'application/ld+json, application/json'})
                resp.raise_for_status()
                doc = resp.json()
                obj, _ = JsonLdContext.objects.update_or_create(url=url, defaults={'document': doc})
                updated.append(url)
            except Exception as e:
                failed.append({'url': url, 'error': str(e)})
        return Response({'updated': updated, 'failed': failed}, status=status.HTTP_200_OK)
