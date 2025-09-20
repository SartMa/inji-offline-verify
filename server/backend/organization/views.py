# server/organization/views.py
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from django.db import transaction
from .models import Organization, OrganizationDID, PublicKey
from .permissions import IsOrganizationAdmin
from api.serializers import JsonLdContextSerializer
from api.models import JsonLdContext

from .serializers import (
    OrganizationRegistrationSerializer,
    OrganizationRegistrationConfirmSerializer,
    OrganizationDIDSubmitSerializer,
    PublicKeyListResponseSerializer,
    OrganizationSerializer,
    OrganizationLoginSerializer,
)
from worker.models import OrganizationMember
from rest_framework.permissions import IsAuthenticated
import re
from datetime import datetime
from django.core.exceptions import ValidationError
import json


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
            return Response({
                'organization': {'id': str(org.id), 'name': org.name},
                'user': {'username': user.username, 'email': user.email},
                'access': data.get('access'),
                'refresh': data.get('refresh'),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# class SubmitOrganizationDIDView(APIView):
#     """Endpoint for org admin to submit a DID; triggers resolution and key storage."""
#     permission_classes = [permissions.IsAuthenticated]

#     def post(self, request, *args, **kwargs):
#         serializer = OrganizationDIDSubmitSerializer(data=request.data)
#         if not serializer.is_valid():
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

#         org: Organization = serializer.validated_data['organization']
#         # Ensure requester is admin for that org
#         is_admin = OrganizationMember.objects.filter(user=request.user, organization=org, role='ADMIN').exists()
#         if not is_admin:
#             return Response({'detail': 'Admin privileges required for this org'}, status=status.HTTP_403_FORBIDDEN)

#         org_did: OrganizationDID = serializer.save()

#         # Resolve keys (best-effort)
#         try:
#             resolved_keys = resolve_did_keys(org_did.did)
#             with transaction.atomic():
#                 for k in resolved_keys:
#                     PublicKey.objects.update_or_create(
#                         key_id=k['key_id'],
#                         defaults={
#                             'organization': org,
#                             'key_type': k.get('key_type', ''),
#                             'public_key_multibase': k.get('public_key_multibase', ''),
#                             'public_key_hex': k.get('public_key_hex'),
#                             'public_key_jwk': k.get('public_key_jwk'),
#                             'controller': k.get('controller', ''),
#                             'purpose': k.get('purpose', 'assertion'),
#                             'expires_at': k.get('expires_at'),
#                             'revoked_at': k.get('revoked_at'),
#                             'revocation_reason': k.get('revocation_reason'),
#                             'is_active': k.get('is_active', True),
#                         }
#                     )
#                 org_did.status = 'RESOLVED'
#                 org_did.save(update_fields=['status'])
#         except Exception as e:
#             # Keep DID as submitted; client can retry resolve later
#             return Response({
#                 'id': str(org_did.id),
#                 'organization_id': str(org.id),
#                 'did': org_did.did,
#                 'status': org_did.status,
#                 'message': f'DID stored but resolution failed: {e}'
#             }, status=status.HTTP_202_ACCEPTED)

#         return Response({
#             'id': str(org_did.id),
#             'organization_id': str(org.id),
#             'did': org_did.did,
#             'status': org_did.status,
#         }, status=status.HTTP_201_CREATED)


# class OrganizationPublicKeysView(APIView):
#     """Return active public keys for the given organization or DID."""
#     permission_classes = [permissions.IsAuthenticated]

#     def get(self, request, *args, **kwargs):
#         org_id = request.query_params.get('organization_id')
#         did = request.query_params.get('did')

#         org = None
#         if org_id:
#             try:
#                 org = Organization.objects.get(id=org_id)
#             except Organization.DoesNotExist:
#                 return Response({'detail': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

#         qs = PublicKey.objects.filter(is_active=True)
#         if org:
#             qs = qs.filter(organization=org)
#         if did:
#             qs = qs.filter(controller=did)

#         keys = list(qs.values(
#             'id', 'key_id', 'key_type', 'public_key_multibase', 'public_key_hex', 'public_key_jwk',
#             'controller', 'purpose', 'created_at', 'expires_at', 'revoked_at', 'revocation_reason', 'is_active'
#         ))
#         payload = {
#             'organization_id': str(org.id) if org else None,
#             'did': did,
#             'keys': keys,
#         }
#         return Response(payload, status=status.HTTP_200_OK)


class OrganizationLoginView(APIView):
    """Login endpoint specifically for organization admins."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = OrganizationLoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrganizationContextUpsertView(APIView):
    """
    Upsert a JSON-LD context document for an organization.
    Handles duplicates gracefully and validates JSON documents properly.
    """
    permission_classes = [permissions.IsAuthenticated, IsOrganizationAdmin]

    def post(self, request, *args, **kwargs):
        data = request.data or {}
        org_id = data.get('organization_id')
        url = data.get('url')
        document = data.get('document')

        # Validate required fields
        if not org_id:
            return Response({'detail': 'organization_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not url:
            return Response({'detail': 'url is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not document:
            return Response({'detail': 'document is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate that document is a valid JSON object
        if not isinstance(document, dict):
            try:
                if isinstance(document, str):
                    document = json.loads(document)
                if not isinstance(document, dict):
                    return Response({'detail': 'document must be a valid JSON object'}, status=status.HTTP_400_BAD_REQUEST)
            except (json.JSONDecodeError, TypeError):
                return Response({'detail': 'document must be a valid JSON object'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate URL format
        if not url.startswith(('http://', 'https://')):
            return Response({'detail': 'url must be a valid HTTP/HTTPS URL'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Check if context already exists
            existing_context = JsonLdContext.objects.filter(url=url).first()
            
            if existing_context:
                # Update existing context if document differs
                if existing_context.document != document:
                    existing_context.document = document
                    existing_context.save(update_fields=['document'])
                    created = False
                else:
                    # Document is identical, no update needed
                    created = False
                
                obj = existing_context
            else:
                # Create new context
                obj = JsonLdContext.objects.create(url=url, document=document)
                created = True

            # Return the context data
            out = JsonLdContextSerializer(obj).data
            return Response(out, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'detail': f'Failed to upsert context: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrganizationPublicKeyUpsertView(APIView):
    """
    Upsert an issuer public key under an organization.
    Requires organization_id in body and ADMIN membership in that org.
    Body (minimum):
      - organization_id: UUID
      - key_id: string (verification method or DID#fragment)
      - controller: string DID (without fragment)
      - key_type: string (e.g., Ed25519VerificationKey2020)
      - public_key_multibase/public_key_hex/public_key_jwk: optional
      - purpose: default 'assertion'
      - is_active: default True
    """
    permission_classes = [permissions.IsAuthenticated, IsOrganizationAdmin]

    def post(self, request, *args, **kwargs):
        data = request.data or {}
        org_id = data.get('organization_id')
        key_id = data.get('key_id')
        controller = data.get('controller')
        key_type = data.get('key_type') or 'Ed25519VerificationKey2020'
        public_key_multibase = data.get('public_key_multibase') or ''
        public_key_hex = data.get('public_key_hex')
        public_key_jwk = data.get('public_key_jwk')
        purpose = data.get('purpose') or 'assertion'
        is_active = bool(data.get('is_active', True))

        if not org_id:
            return Response({'detail': 'organization_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not key_id or not controller:
            return Response({'detail': 'key_id and controller are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                pk_obj, created = PublicKey.objects.update_or_create(
                    key_id=key_id,
                    defaults={
                        'organization': org,
                        'key_type': key_type,
                        'public_key_multibase': public_key_multibase,
                        'public_key_hex': public_key_hex,
                        'public_key_jwk': public_key_jwk,
                        'controller': controller,
                        'purpose': purpose,
                        'is_active': is_active,
                    }
                )

            payload = {
                'id': str(pk_obj.id),
                'organization_id': str(org.id),
                'key_id': pk_obj.key_id,
                'key_type': pk_obj.key_type,
                'public_key_multibase': pk_obj.public_key_multibase,
                'public_key_hex': pk_obj.public_key_hex,
                'controller': pk_obj.controller,
                'purpose': pk_obj.purpose,
                'is_active': pk_obj.is_active,
                'created': created,
            }
            return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'detail': f'Failed to upsert public key: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrganizationPublicKeysView(APIView):
    """Return active public keys for a given organization_id."""
    permission_classes = [permissions.IsAuthenticated, IsOrganizationAdmin]

    def get(self, request, *args, **kwargs):
        org_id = request.query_params.get('organization_id')
        if not org_id:
            return Response({'detail': 'organization_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        qs = PublicKey.objects.filter(organization=org, is_active=True)
        keys = list(qs.values(
            'id', 'key_id', 'key_type', 'public_key_multibase', 'public_key_hex', 'public_key_jwk',
            'controller', 'purpose', 'created_at', 'expires_at', 'revoked_at', 'revocation_reason', 'is_active'
        ))
        return Response({'organization_id': str(org.id), 'keys': keys}, status=status.HTTP_200_OK)


# # --- DID resolution helpers (minimal, can be replaced by robust resolver) ---
# did_web_pattern = re.compile(r"^did:web:([a-zA-Z0-9.-]+)(?::(.+))?$")


# def resolve_did_keys(did: str):
#     """Resolve DID to verification keys. Supports did:web minimally.
#     Returns list of dicts with keys: key_id, key_type, public_key_multibase/hex/jwk, controller, purpose, ...
#     """
#     if did.startswith('did:web:'):
#         if not requests:
#             raise RuntimeError('requests not available for resolution')
#         m = did_web_pattern.match(did)
#         if not m:
#             raise ValueError('Invalid did:web format')
#         domain, path = m.groups()
#         did_cfg_url = f"https://{domain}/.well-known/did.json" if not path else f"https://{domain}/{path.replace(':', '/')}/did.json"
#         resp = requests.get(did_cfg_url, timeout=10)
#         resp.raise_for_status()
#         doc = resp.json()
#         vm = doc.get('verificationMethod', [])
#         assertion = set(ref if isinstance(ref, str) else ref.get('id') for ref in doc.get('assertionMethod', []) )
#         keys = []
#         for mth in vm:
#             kid = mth.get('id')
#             if not kid:
#                 continue
#             entry = {
#                 'key_id': kid,
#                 'key_type': mth.get('type', ''),
#                 'public_key_multibase': mth.get('publicKeyMultibase', ''),
#                 'public_key_hex': mth.get('publicKeyHex'),
#                 'public_key_jwk': mth.get('publicKeyJwk'),
#                 'controller': mth.get('controller', did),
#                 'purpose': 'assertion' if kid in assertion else 'authentication',
#                 'is_active': True,
#             }
#             keys.append(entry)
#         return keys
#     elif did.startswith('did:key:'):
#         # Basic parsing for did:key: multibase. Full support would parse method-specific identifier.
#         return [{
#             'key_id': did + '#key-1',
#             'key_type': 'Ed25519VerificationKey2020',
#             'public_key_multibase': did.split('did:key:')[-1],
#             'controller': did,
#             'purpose': 'assertion',
#             'is_active': True,
#         }]
#     else:
#         raise ValueError('Unsupported DID method')
