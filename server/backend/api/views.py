from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.views import APIView
from .serializers import (
    EmailLoginCodeRequestSerializer,
    EmailLoginCodeVerifySerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from worker.models import OrganizationMember

#     def post(self, request, *args, **kwargs):
#         """Store a new public key from VC upload."""
#         data = request.data
        
#         # Extract data from the request
#         did = data.get('did')
#         verification_method = data.get('verification_method')
#         key_type = data.get('key_type')
#         algorithm = data.get('algorithm')
#         public_key_jwk = data.get('public_key_jwk')
#         public_key_pem = data.get('public_key_pem')
#         public_key_bytes = data.get('public_key_bytes')
#         issuer_did = data.get('issuer_did')
#         credential_id = data.get('credential_id')

#         # Validate required fields
#         if not did:
#             return Response({'error': 'DID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
#         if not key_type:
#             return Response({'error': 'Key type is required'}, status=status.HTTP_400_BAD_REQUEST)

#         # Convert public_key_bytes from array to hex string if provided
#         public_key_hex = None
#         if public_key_bytes and isinstance(public_key_bytes, list):
#             public_key_hex = ''.join(f'{b:02x}' for b in public_key_bytes)
        
#         # Convert jwk to multibase format if available (simplified for now)
#         public_key_multibase = ""
#         if public_key_jwk and isinstance(public_key_jwk, dict):
#             # This is a simplified conversion - you might need more sophisticated logic
#             x = public_key_jwk.get('x', '')
#             if x:
#                 public_key_multibase = f"z{x}"  # Simplified multibase encoding

#         try:
#             # Use update_or_create to handle duplicates
#             public_key, created = PublicKey.objects.update_or_create(
#                 key_id=verification_method or did,
#                 defaults={
#                     'key_type': key_type,
#                     'public_key_multibase': public_key_multibase,
#                     'public_key_hex': public_key_hex,
#                     'public_key_jwk': public_key_jwk,
#                     'controller': did,
#                     'purpose': 'assertion',
#                     'is_active': True,
#                     # Don't set organization for now since this is from VC upload
#                 }
#             )
            
#             action = "created" if created else "updated"
#             return Response({
#                 'success': True,
#                 'action': action,
#                 'key_id': public_key.key_id,
#                 'did': did,
#                 'key_type': key_type,
#                 'algorithm': algorithm,
#                 'credential_id': credential_id,
#                 'issuer_did': issuer_did
#             }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
#         except Exception as e:
#             return Response({
#                 'error': f'Failed to store public key: {str(e)}'
#             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#         return Response(payload, status=status.HTTP_200_OK)


# class ContextListView(APIView):
#     """Return all stored JSON-LD contexts (authenticated)."""
#     permission_classes = [permissions.IsAuthenticated]

#     def get(self, request, *args, **kwargs):
#         qs = JsonLdContext.objects.all().order_by('url')
#         serializer = JsonLdContextSerializer(qs, many=True)
#         return Response({ 'contexts': serializer.data }, status=status.HTTP_200_OK)

# # ...existing code...
# # Allow non-staff context upsert during development (Worker PWA acting as org UI)
# ALLOW_CONTEXT_UPSERT_FOR_AUTHENTICATED = True
# # ...existing code...
# class ContextUpsertView(APIView):
#     """Create or update a JSON-LD context (admin or org admin, or temporary dev override)."""
#     permission_classes = [permissions.IsAuthenticated]

#     def post(self, request, *args, **kwargs):
#         user = request.user

#         # Temporary dev override: allow any authenticated user if enabled in settings
#         allow_any_auth = getattr(settings, 'ALLOW_CONTEXT_UPSERT_FOR_AUTHENTICATED', settings.DEBUG)

#         # Organization admin check (optional; contexts are global, but this lets org admins manage)
#         is_org_admin = OrganizationMember.objects.filter(user=user, role='ADMIN').exists()

#         if not (allow_any_auth or user.is_staff or is_org_admin):
#             return Response({'detail': 'Forbidden: requires staff or org admin'}, status=status.HTTP_403_FORBIDDEN)
#         serializer = JsonLdContextSerializer(data=request.data)
#         if not serializer.is_valid():
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#         data = serializer.validated_data
#         obj, created = JsonLdContext.objects.update_or_create(
#             url=data['url'], defaults={ 'document': data['document'] }
#         )
#         out = JsonLdContextSerializer(obj).data
#         return Response(out, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


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
        serializer = PasswordResetRequestSerializer(data=request.data, context={'request': request})
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
