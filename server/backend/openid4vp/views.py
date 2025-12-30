from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import OpenID4VPSession
import json
import logging


class CreateSessionView(APIView):
    """
    Create a new OpenID4VP verification session.
    POST /api/openid4vp/sessions/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Create a new verification session and return session details."""
        from .services import OpenID4VPSessionService
        from .config import OpenID4VPConfig
        from django.conf import settings
        
        # Get request data
        presentation_definition_id = request.data.get('presentation_definition_id')
        expires_in_minutes = request.data.get('expires_in_minutes', 10)
        
        # Validate required fields
        if not presentation_definition_id:
            return Response({
                'error': 'invalid_request',
                'error_description': 'presentation_definition_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate credential type is supported
        if not OpenID4VPConfig.validate_credential_type(presentation_definition_id):
            return Response({
                'error': 'unsupported_credential_type',
                'error_description': f'Credential type {presentation_definition_id} is not supported'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate expires_in_minutes
        try:
            expires_in_minutes = int(expires_in_minutes)
            if expires_in_minutes <= 0 or expires_in_minutes > 60:
                raise ValueError("Invalid expiration time")
        except (ValueError, TypeError):
            return Response({
                'error': 'invalid_request',
                'error_description': 'expires_in_minutes must be a positive integer between 1 and 60'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get user's organization through membership
            from worker.models import OrganizationMember
            user_membership = OrganizationMember.objects.filter(user=request.user).first()
            if not user_membership:
                return Response({
                    'error': 'unauthorized',
                    'error_description': 'User is not associated with any organization'
                }, status=status.HTTP_403_FORBIDDEN)
            
            user_organization = user_membership.organization
            
            # Create session
            session = OpenID4VPSessionService.create_session(
                presentation_definition_id=presentation_definition_id,
                organization=user_organization,
                created_by=request.user,
                expires_in_minutes=expires_in_minutes
            )
            
            # Build authorization request URI
            base_url = getattr(settings, 'OPENID4VP_BASE_URL', request.build_absolute_uri('/'))
            if base_url.endswith('/'):
                base_url = base_url[:-1]
            
            authorization_request_uri = (
                f"{base_url}/api/openid4vp/presentation-definition/{session.session_id}/"
                f"?response_type=vp_token"
                f"&client_id={base_url}"
                f"&presentation_definition_uri={base_url}/api/openid4vp/presentation-definition/{session.session_id}/"
                f"&response_uri={base_url}/api/openid4vp/presentation/{session.session_id}/"
            )
            
            return Response({
                'session_id': str(session.session_id),
                'authorization_request_uri': authorization_request_uri,
                'expires_at': session.expires_at.isoformat(),
                'status': session.status,
                'presentation_definition_id': session.presentation_definition_id
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'error': 'server_error',
                'error_description': f'Failed to create session: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PresentationDefinitionView(APIView):
    """
    Get presentation definition for a session.
    GET /api/openid4vp/presentation-definition/{session_id}/
    """
    permission_classes = []  # Public endpoint for wallet access
    
    def get(self, request, session_id):
        """Return presentation definition for the given session."""
        from .services import OpenID4VPSessionService
        from .presentation_definition_service import PresentationDefinitionService
        from django.utils import timezone
        
        try:
            # Get session
            session = OpenID4VPSessionService.get_session(str(session_id))
            if not session:
                return Response({
                    'error': 'invalid_session',
                    'error_description': 'Session not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if session is expired
            if session.is_expired():
                # Update session status to expired
                OpenID4VPSessionService.update_session_status(
                    str(session_id), 
                    'expired',
                    error_message='Session has expired'
                )
                return Response({
                    'error': 'expired_session',
                    'error_description': 'The verification session has expired'
                }, status=status.HTTP_410_GONE)
            
            # Check if session is not in pending status
            if session.status != 'pending':
                return Response({
                    'error': 'invalid_session',
                    'error_description': f'Session is not active (status: {session.status})'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get organization configuration (if any)
            organization_config = None
            # TODO: In future, this could be retrieved from organization settings
            # organization_config = session.organization.openid4vp_config
            
            # Generate presentation definition
            presentation_definition = PresentationDefinitionService.generate_presentation_definition_for_session(
                credential_type=session.presentation_definition_id,
                organization_config=organization_config,
                session_id=str(session_id)
            )
            
            if not presentation_definition:
                return Response({
                    'error': 'unsupported_presentation_format',
                    'error_description': f'Presentation definition for {session.presentation_definition_id} not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Add session metadata
            presentation_definition['session_id'] = str(session_id)
            presentation_definition['generated_at'] = timezone.now().isoformat()
            presentation_definition['expires_at'] = session.expires_at.isoformat()
            
            return Response(presentation_definition, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'server_error',
                'error_description': f'Failed to retrieve presentation definition: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PresentationSubmissionView(APIView):
    """
    Accept verifiable presentation submission.
    POST /api/openid4vp/presentation/{session_id}/
    """
    permission_classes = []  # Public endpoint for wallet access
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.logger = logging.getLogger(__name__)
    
    def post(self, request, session_id):
        """Accept and process verifiable presentation submission."""
        from .services import OpenID4VPSessionService
        from .presentation_definition_service import PresentationDefinitionService
        from django.utils import timezone
        import json
        
        try:
            # Get session
            session = OpenID4VPSessionService.get_session(str(session_id))
            if not session:
                return Response({
                    'error': 'invalid_session',
                    'error_description': 'Session not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if session is expired
            if session.is_expired():
                OpenID4VPSessionService.update_session_status(
                    str(session_id), 
                    'expired',
                    error_message='Session has expired'
                )
                return Response({
                    'error': 'expired_session',
                    'error_description': 'The verification session has expired'
                }, status=status.HTTP_410_GONE)
            
            # Check if session is not in pending status
            if session.status != 'pending':
                return Response({
                    'error': 'invalid_session',
                    'error_description': f'Session is not active (status: {session.status})'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get presentation data
            presentation_data = request.data.get('vp_token')
            if not presentation_data:
                # Try alternative field names
                presentation_data = request.data.get('presentation') or request.data.get('verifiable_presentation')
            
            if not presentation_data:
                return Response({
                    'error': 'invalid_request',
                    'error_description': 'Missing verifiable presentation data (vp_token, presentation, or verifiable_presentation)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Parse presentation if it's a string
            if isinstance(presentation_data, str):
                try:
                    presentation_data = json.loads(presentation_data)
                except json.JSONDecodeError:
                    return Response({
                        'error': 'invalid_request',
                        'error_description': 'Invalid JSON in presentation data'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate presentation structure
            if not isinstance(presentation_data, dict):
                return Response({
                    'error': 'invalid_request',
                    'error_description': 'Presentation must be a JSON object'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get presentation definition for validation
            organization_config = None  # TODO: Get from organization settings
            presentation_definition = PresentationDefinitionService.get_presentation_definition(
                session.presentation_definition_id,
                organization_config
            )
            
            if not presentation_definition:
                return Response({
                    'error': 'server_error',
                    'error_description': 'Presentation definition not found'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Validate presentation against definition
            validation_result = PresentationDefinitionService.validate_presentation_against_definition(
                presentation_data,
                presentation_definition
            )
            
            if not validation_result['valid']:
                # Update session with validation error
                OpenID4VPSessionService.update_session_status(
                    str(session_id),
                    'error',
                    error_message=f"Presentation validation failed: {'; '.join(validation_result['errors'])}"
                )
                
                # Create verification log entry for failed validation
                from api.services import VerificationLogService
                try:
                    log_verification_result = {
                        'valid': False,
                        'status': 'failed',
                        'error_message': f"Presentation validation failed: {'; '.join(validation_result['errors'])}",
                        'verification_method': 'openid4vp'
                    }
                    
                    VerificationLogService.create_openid4vp_log(
                        session=session,
                        verification_result=log_verification_result,
                        verified_by=session.created_by
                    )
                    
                except Exception as log_error:
                    self.logger.error(f"Failed to create verification log for failed validation: {str(log_error)}")
                
                return Response({
                    'error': 'verification_failed',
                    'error_description': 'Presentation validation failed',
                    'validation_errors': validation_result['errors']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Queue presentation for verification
            # For now, we'll mark it as received and queue it for processing
            # In a production system, this would be sent to a background task queue
            
            verification_result = {
                'status': 'queued',
                'presentation': presentation_data,
                'received_at': timezone.now().isoformat(),
                'validation_passed': True,
                'validation_details': validation_result
            }
            
            # Update session status to indicate presentation received
            OpenID4VPSessionService.update_session_status(
                str(session_id),
                'completed',  # Mark as completed for now
                result=verification_result
            )
            
            # Create verification log entry
            from api.services import VerificationLogService
            try:
                # Create a simplified verification result for logging
                log_verification_result = {
                    'valid': True,  # Since validation passed
                    'status': 'success',
                    'credentials': [presentation_data],  # Store the presentation data
                    'verification_method': 'openid4vp'
                }
                
                # Create the verification log
                VerificationLogService.create_openid4vp_log(
                    session=session,
                    verification_result=log_verification_result,
                    verified_by=session.created_by
                )
                
            except Exception as log_error:
                # Log the error but don't fail the verification
                self.logger.error(f"Failed to create verification log: {str(log_error)}")
            
            return Response({
                'status': 'accepted',
                'message': 'Presentation received and processed',
                'session_id': str(session_id)
            }, status=status.HTTP_202_ACCEPTED)
            
        except Exception as e:
            # Update session with error if possible
            try:
                OpenID4VPSessionService.update_session_status(
                    str(session_id),
                    'error',
                    error_message=f'Presentation submission failed: {str(e)}'
                )
                
                # Create verification log entry for system error
                from api.services import VerificationLogService
                try:
                    log_verification_result = {
                        'valid': False,
                        'status': 'failed',
                        'error_message': f'Presentation submission failed: {str(e)}',
                        'verification_method': 'openid4vp'
                    }
                    
                    VerificationLogService.create_openid4vp_log(
                        session=session,
                        verification_result=log_verification_result,
                        verified_by=session.created_by
                    )
                    
                except Exception as log_error:
                    self.logger.error(f"Failed to create verification log for system error: {str(log_error)}")
                    
            except:
                pass  # Ignore errors in error handling
            
            return Response({
                'error': 'server_error',
                'error_description': f'Failed to process presentation submission: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_verification(self, presentation_data, session, presentation_definition):
        """
        Process verification of the submitted presentation using the OpenID4VPVerificationService.
        """
        from .services import OpenID4VPVerificationService
        import asyncio
        
        try:
            # Use the comprehensive verification service
            verification_service = OpenID4VPVerificationService()
            
            # Run the async verification in a sync context
            # In production, this should be handled by a background task queue
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                verification_result = loop.run_until_complete(
                    verification_service.verify_presentation(
                        presentation_data, session, presentation_definition
                    )
                )
            finally:
                loop.close()
            
            return verification_result
            
        except Exception as e:
            self.logger.error(f"Error in presentation verification: {str(e)}")
            from django.utils import timezone
            
            return {
                'verified': False,
                'error': str(e),
                'session_id': str(session.session_id),
                'verified_at': timezone.now().isoformat(),
                'verification_method': 'openid4vp',
                'organization_id': session.organization.id,
                'verified_by': session.created_by.id,
                'credential_count': 0,
                'error_details': [f"Verification service error: {str(e)}"]
            }


class SessionStatusView(APIView):
    """
    Get verification status for a session.
    GET /api/openid4vp/status/{session_id}/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, session_id):
        """Return current verification status and results."""
        from .services import OpenID4VPSessionService
        from django.utils import timezone
        
        try:
            # Get session
            session = OpenID4VPSessionService.get_session(str(session_id))
            if not session:
                return Response({
                    'error': 'invalid_session',
                    'error_description': 'Session not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if user has access to this session
            # User must be the creator or belong to the same organization
            from worker.models import OrganizationMember
            user_membership = OrganizationMember.objects.filter(user=request.user).first()
            user_organization = user_membership.organization if user_membership else None
            
            if (session.created_by != request.user and 
                (not user_organization or session.organization != user_organization)):
                return Response({
                    'error': 'unauthorized',
                    'error_description': 'Access denied to this session'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Check if session is expired and update status if needed
            if session.is_expired() and session.status == 'pending':
                OpenID4VPSessionService.update_session_status(
                    str(session_id), 
                    'expired',
                    error_message='Session has expired'
                )
                # Refresh session object
                session = OpenID4VPSessionService.get_session(str(session_id))
            
            # Build response based on session status
            response_data = {
                'session_id': str(session.session_id),
                'status': session.status,
                'created_at': session.created_at.isoformat(),
                'expires_at': session.expires_at.isoformat(),
                'presentation_definition_id': session.presentation_definition_id,
                'is_expired': session.is_expired(),
                'created_by': {
                    'id': session.created_by.id,
                    'username': session.created_by.username,
                    'first_name': session.created_by.first_name,
                    'last_name': session.created_by.last_name
                },
                'organization': {
                    'id': session.organization.id,
                    'name': session.organization.name
                }
            }
            
            # Add verification result if available
            if session.verification_result:
                response_data['verification_result'] = session.verification_result
                
                # Add summary information for completed verifications
                if session.status == 'completed' and session.verification_result.get('verified'):
                    result = session.verification_result
                    response_data['verification_summary'] = {
                        'verified': result.get('verified', False),
                        'verified_at': result.get('verified_at'),
                        'credential_count': result.get('credential_count', 0),
                        'verification_method': result.get('verification_method', 'openid4vp'),
                        'credentials_summary': [
                            {
                                'type': cred.get('type', []),
                                'issuer': cred.get('issuer'),
                                'verified': cred.get('verified', False)
                            }
                            for cred in result.get('credentials', [])
                        ]
                    }
            
            # Add error message if available
            if session.error_message:
                response_data['error_message'] = session.error_message
            
            # Add time remaining for pending sessions
            if session.status == 'pending' and not session.is_expired():
                time_remaining = session.expires_at - timezone.now()
                response_data['time_remaining_seconds'] = int(time_remaining.total_seconds())
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'server_error',
                'error_description': f'Failed to retrieve session status: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)