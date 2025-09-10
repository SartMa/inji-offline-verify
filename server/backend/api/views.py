from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from .serializers import (
    VerificationLogSerializer,
    OrganizationRegistrationSerializer,
    OrganizationRegistrationConfirmSerializer,
    LoginSerializer,
    WorkerRegistrationSerializer,
    OrganizationDIDSubmitSerializer,
    PublicKeyListResponseSerializer,
    JsonLdContextSerializer,
    ContextListResponseSerializer,
    EmailLoginCodeRequestSerializer,
    EmailLoginCodeVerifySerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from django.db import transaction
from .models import Organization, OrganizationMember, OrganizationDID, PublicKey, JsonLdContext
from .permissions import IsOrganizationAdmin
from rest_framework.permissions import IsAuthenticated
import re
from datetime import datetime
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken  # add if not present

try:
    import requests
except Exception:  # pragma: no cover
    requests = None
# Create your views here.


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


class RegisterOrganizationView(APIView):
    """Register a new organization with an admin user and return auth token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = OrganizationRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            return Response(data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ConfirmOrganizationRegistrationView(APIView):
    """Confirm OTP for organization registration and finalize creation."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = OrganizationRegistrationConfirmSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.save()
            org = data['organization']
            user = data['user']
            token = data['token']
            return Response({
                'organization': {'id': str(org.id), 'name': org.name},
                'user': {'username': user.username, 'email': user.email},
                'token': token,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """Login existing user and return auth token and org context."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterWorkerView(APIView):
    """
    Registers a worker.
    Requirements:
      - Authenticated user
      - User is ADMIN of the target organization
      - org_name required only if the admin belongs to multiple organizations
    NOTE: org_id has been removed. Use org_name.
    """
    permission_classes = [IsAuthenticated, IsOrganizationAdmin]

    def post(self, request, *args, **kwargs):
        user = request.user
        admin_qs = OrganizationMember.objects.filter(user=user, role="ADMIN").select_related("organization")
        if not admin_qs.exists():
            return Response({"detail": "Not authorized"}, status=403)

        data = request.data.copy()

        # Reject deprecated org_id usage
        if "org_id" in data:
            return Response({"detail": "org_id is no longer supported. Use org_name."}, status=400)

        org_name = data.get("org_name")
        if org_name:
            org = next((m.organization for m in admin_qs if m.organization.name == org_name), None)
            if not org:
                return Response({"detail": "You are not admin of provided org_name"}, status=403)
        else:
            if admin_qs.count() == 1:
                org = admin_qs.first().organization
            else:
                return Response({"detail": "Multiple admin organizations. Provide org_name."}, status=400)

        # Enforce (prevent spoofing)
        data["org_name"] = org.name

        serializer = WorkerRegistrationSerializer(data=data, context={"organization": org})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        save_result = serializer.save(organization=org, created_by=user)

        # Robust handling of various return shapes
        worker_user = None
        membership = None
        if isinstance(save_result, tuple):
            if len(save_result) == 2:
                worker_user, membership = save_result
            elif len(save_result) >= 1:
                worker_user = save_result[0]
                membership = save_result[1] if len(save_result) > 1 else None
            else:
                return Response({"detail": "Serializer returned empty tuple"}, status=500)
        elif isinstance(save_result, dict):
            worker_user = (
                save_result.get("user")
                or save_result.get("worker_user")
                or save_result.get("worker")
                or save_result.get("account")
            )
            membership = save_result.get("member") or save_result.get("membership")
        else:
            # Single object (assume user)
            worker_user = save_result

        if worker_user is None:
            return Response({"detail": "Could not determine created user from serializer.save()"}, status=500)

        tokens = get_tokens_for_user(worker_user)

        return Response(
            {
                "organization": {"id": str(org.id), "name": org.name},
                "user": {
                    "id": worker_user.id,
                    "username": worker_user.username,
                    "email": worker_user.email,
                },
                "member": {
                    "id": getattr(membership, "id", None),
                    "role": getattr(membership, "role", None),
                },
                "access": tokens["access"],
                "refresh": tokens["refresh"],
            },
            status=201,
        )


class SubmitOrganizationDIDView(APIView):
    """Endpoint for org admin to submit a DID; triggers resolution and key storage."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = OrganizationDIDSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        org: Organization = serializer.validated_data['organization']
        # Ensure requester is admin for that org
        is_admin = OrganizationMember.objects.filter(user=request.user, organization=org, role='ADMIN').exists()
        if not is_admin:
            return Response({'detail': 'Admin privileges required for this org'}, status=status.HTTP_403_FORBIDDEN)

        org_did: OrganizationDID = serializer.save()

        # Resolve keys (best-effort)
        try:
            resolved_keys = resolve_did_keys(org_did.did)
            with transaction.atomic():
                for k in resolved_keys:
                    PublicKey.objects.update_or_create(
                        key_id=k['key_id'],
                        defaults={
                            'organization': org,
                            'key_type': k.get('key_type', ''),
                            'public_key_multibase': k.get('public_key_multibase', ''),
                            'public_key_hex': k.get('public_key_hex'),
                            'public_key_jwk': k.get('public_key_jwk'),
                            'controller': k.get('controller', ''),
                            'purpose': k.get('purpose', 'assertion'),
                            'expires_at': k.get('expires_at'),
                            'revoked_at': k.get('revoked_at'),
                            'revocation_reason': k.get('revocation_reason'),
                            'is_active': k.get('is_active', True),
                        }
                    )
                org_did.status = 'RESOLVED'
                org_did.save(update_fields=['status'])
        except Exception as e:
            # Keep DID as submitted; client can retry resolve later
            return Response({
                'id': str(org_did.id),
                'organization_id': str(org.id),
                'did': org_did.did,
                'status': org_did.status,
                'message': f'DID stored but resolution failed: {e}'
            }, status=status.HTTP_202_ACCEPTED)

        return Response({
            'id': str(org_did.id),
            'organization_id': str(org.id),
            'did': org_did.did,
            'status': org_did.status,
        }, status=status.HTTP_201_CREATED)


class OrganizationPublicKeysView(APIView):
    """Return active public keys for the given organization or DID."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        org_id = request.query_params.get('organization_id')
        did = request.query_params.get('did')

        org = None
        if org_id:
            try:
                org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response({'detail': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        qs = PublicKey.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        if did:
            qs = qs.filter(controller=did)

        keys = list(qs.values(
            'id', 'key_id', 'key_type', 'public_key_multibase', 'public_key_hex', 'public_key_jwk',
            'controller', 'purpose', 'created_at', 'expires_at', 'revoked_at', 'revocation_reason', 'is_active'
        ))
        payload = {
            'organization_id': str(org.id) if org else None,
            'did': did,
            'keys': keys,
        }
        return Response(payload, status=status.HTTP_200_OK)


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


# --- DID resolution helpers (minimal, can be replaced by robust resolver) ---
did_web_pattern = re.compile(r"^did:web:([a-zA-Z0-9.-]+)(?::(.+))?$")


def resolve_did_keys(did: str):
    """Resolve DID to verification keys. Supports did:web minimally.
    Returns list of dicts with keys: key_id, key_type, public_key_multibase/hex/jwk, controller, purpose, ...
    """
    if did.startswith('did:web:'):
        if not requests:
            raise RuntimeError('requests not available for resolution')
        m = did_web_pattern.match(did)
        if not m:
            raise ValueError('Invalid did:web format')
        domain, path = m.groups()
        did_cfg_url = f"https://{domain}/.well-known/did.json" if not path else f"https://{domain}/{path.replace(':', '/')}/did.json"
        resp = requests.get(did_cfg_url, timeout=10)
        resp.raise_for_status()
        doc = resp.json()
        vm = doc.get('verificationMethod', [])
        assertion = set(ref if isinstance(ref, str) else ref.get('id') for ref in doc.get('assertionMethod', []) )
        keys = []
        for mth in vm:
            kid = mth.get('id')
            if not kid:
                continue
            entry = {
                'key_id': kid,
                'key_type': mth.get('type', ''),
                'public_key_multibase': mth.get('publicKeyMultibase', ''),
                'public_key_hex': mth.get('publicKeyHex'),
                'public_key_jwk': mth.get('publicKeyJwk'),
                'controller': mth.get('controller', did),
                'purpose': 'assertion' if kid in assertion else 'authentication',
                'is_active': True,
            }
            keys.append(entry)
        return keys
    elif did.startswith('did:key:'):
        # Basic parsing for did:key: multibase. Full support would parse method-specific identifier.
        return [{
            'key_id': did + '#key-1',
            'key_type': 'Ed25519VerificationKey2020',
            'public_key_multibase': did.split('did:key:')[-1],
            'controller': did,
            'purpose': 'assertion',
            'is_active': True,
        }]
    else:
        raise ValueError('Unsupported DID method')


def get_tokens_for_user(user):  # add helper if not already defined
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}
