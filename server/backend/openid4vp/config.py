"""
OpenID4VP Configuration Module

This module provides a unified interface for accessing presentation definitions
and applying issuer constraints. It serves as the main configuration entry point
for the OpenID4VP integration.

Requirements: 3.1, 3.2, 3.3
"""

from .presentation_definitions import (
    PRESENTATION_DEFINITIONS,
    SUPPORTED_CREDENTIAL_TYPES,
    get_presentation_definition,
    get_all_presentation_definitions,
    is_supported_credential_type
)
from .issuer_constraints import (
    DEFAULT_ISSUER_CONSTRAINTS,
    get_issuer_constraints,
    apply_issuer_constraints_to_presentation_definition,
    validate_issuer_against_constraints
)

class OpenID4VPConfig:
    """
    Configuration manager for OpenID4VP presentation definitions and constraints.
    """
    
    @staticmethod
    def get_configured_presentation_definition(
        credential_type: str,
        organization_config: dict = None
    ) -> dict:
        """
        Get a fully configured presentation definition with issuer constraints applied.
        
        Args:
            credential_type: The type of credential (MOSIP_ID, HEALTH_INSURANCE, LAND_REGISTRY)
            organization_config: Optional organization-specific configuration
            
        Returns:
            dict: Complete presentation definition with constraints
            
        Raises:
            KeyError: If the credential type is not supported
        """
        # Get base presentation definition
        base_definition = get_presentation_definition(credential_type)
        
        # Apply issuer constraints if configured
        configured_definition = apply_issuer_constraints_to_presentation_definition(
            base_definition,
            credential_type,
            organization_config
        )
        
        return configured_definition
    
    @staticmethod
    def get_supported_credential_types() -> list:
        """
        Get list of supported credential types.
        
        Returns:
            list: List of supported credential type strings
        """
        return SUPPORTED_CREDENTIAL_TYPES.copy()
    
    @staticmethod
    def validate_credential_type(credential_type: str) -> bool:
        """
        Validate if a credential type is supported.
        
        Args:
            credential_type: The credential type to validate
            
        Returns:
            bool: True if supported, False otherwise
        """
        return is_supported_credential_type(credential_type)
    
    @staticmethod
    def get_issuer_validation_config(
        credential_type: str,
        organization_config: dict = None
    ) -> dict:
        """
        Get issuer validation configuration for a credential type.
        
        Args:
            credential_type: The type of credential
            organization_config: Optional organization-specific configuration
            
        Returns:
            dict: Issuer validation configuration
        """
        return get_issuer_constraints(credential_type, organization_config)
    
    @staticmethod
    def validate_issuer(
        issuer_did: str,
        credential_type: str,
        organization_config: dict = None
    ) -> bool:
        """
        Validate if an issuer is trusted for a credential type.
        
        Args:
            issuer_did: The DID of the issuer
            credential_type: The type of credential
            organization_config: Optional organization-specific configuration
            
        Returns:
            bool: True if issuer is trusted, False otherwise
        """
        return validate_issuer_against_constraints(
            issuer_did,
            credential_type,
            organization_config
        )

# Convenience functions for direct access
def get_presentation_definition_for_type(
    credential_type: str,
    organization_config: dict = None
) -> dict:
    """
    Convenience function to get a configured presentation definition.
    
    Args:
        credential_type: The type of credential
        organization_config: Optional organization-specific configuration
        
    Returns:
        dict: Configured presentation definition
    """
    return OpenID4VPConfig.get_configured_presentation_definition(
        credential_type,
        organization_config
    )

def get_supported_types() -> list:
    """
    Convenience function to get supported credential types.
    
    Returns:
        list: List of supported credential types
    """
    return OpenID4VPConfig.get_supported_credential_types()

# Export main configuration class and convenience functions
__all__ = [
    'OpenID4VPConfig',
    'get_presentation_definition_for_type',
    'get_supported_types',
    'SUPPORTED_CREDENTIAL_TYPES'
]