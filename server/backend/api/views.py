from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from .serializers import (
    JsonLdContextSerializer,
    ContextListResponseSerializer,
    EmailLoginCodeRequestSerializer,
    EmailLoginCodeVerifySerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from django.db import transaction
from .models import JsonLdContext
from rest_framework.permissions import IsAuthenticated
from worker.models import OrganizationMember

try:
    import requests
except Exception:  # pragma: no cover
    requests = None


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


# Shared Authentication Views (login endpoints are now app-specific)
class EmailLoginCodeRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = EmailLoginCodeRequestSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            # In production, don't return code. Provided here for test convenience.
            return Response({'email': data['email'], 'code': data['code'], 'expires_at': data['expires_at']}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmailLoginCodeVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = EmailLoginCodeVerifySerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
