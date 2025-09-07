from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from .serializers import (
    VerificationLogSerializer,
    OrganizationRegistrationSerializer,
    LoginSerializer,
    WorkerRegistrationSerializer,
    OrganizationDIDSubmitSerializer,
    PublicKeyListResponseSerializer,
)
from django.db import transaction
from .models import OrganizationMember, OrganizationDID, PublicKey, Organization
import re
from datetime import datetime

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
            org = data['organization']
            user = data['user']
            token = data['token']
            return Response(
                {
                    'organization': {
                        'id': str(org.id),
                        'name': org.name,
                    },
                    'user': {
                        'username': user.username,
                        'email': user.email,
                    },
                    'token': token,
                },
                status=status.HTTP_201_CREATED,
            )
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
    """Register a worker under an organization (admin only)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Verify requesting user is admin of the target org
        serializer = WorkerRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        org = serializer.validated_data['org']
        is_admin = OrganizationMember.objects.filter(
            user=request.user, organization=org, role='ADMIN'
        ).exists()
        if not is_admin:
            return Response({'detail': 'Admin privileges required for this org'}, status=status.HTTP_403_FORBIDDEN)

        data = serializer.save()
        return Response(
            {
                'organization': {'id': str(data['organization'].id), 'name': data['organization'].name},
                'user': {'username': data['user'].username, 'email': data['user'].email},
                'member': {
                    'role': data['member'].role,
                    'full_name': data['member'].full_name,
                    'phone_number': data['member'].phone_number,
                    'gender': data['member'].gender,
                    'dob': data['member'].dob,
                },
                'access': data['access'],
                'refresh': data['refresh'],
            },
            status=status.HTTP_201_CREATED,
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
