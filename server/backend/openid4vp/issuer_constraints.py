"""
Issuer Constraints Configuration for OpenID4VP

This module defines issuer constraints that can be applied to presentation definitions
to restrict which issuers are trusted for specific credential types.

Based on requirement 3.4 - issuer constraints when configured.
"""

# Default trusted issuers for each credential type
# Organizations can override these through configuration
DEFAULT_ISSUER_CONSTRAINTS = {
    "MOSIP_ID": {
        "trusted_issuers": [
            "did:web:mosip.io",
            "did:web:identity.gov.in",
            "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"  # Example key
        ],
        "issuer_metadata_requirements": {
            "credential_issuer": True,
            "authorization_server": False,
            "credential_configurations_supported": True
        }
    },
    
    "HEALTH_INSURANCE": {
        "trusted_issuers": [
            "did:web:health.gov.in",
            "did:web:insurance.authority.gov",
            "did:web:nhia.gov.in"  # National Health Insurance Authority
        ],
        "issuer_metadata_requirements": {
            "credential_issuer": True,
            "authorization_server": False,
            "credential_configurations_supported": True
        }
    },
    
    "LAND_REGISTRY": {
        "trusted_issuers": [
            "did:web:landrecords.gov.in",
            "did:web:revenue.gov.in",
            "did:web:registrar.gov.in"
        ],
        "issuer_metadata_requirements": {
            "credential_issuer": True,
            "authorization_server": False,
            "credential_configurations_supported": True
        }
    }
}

def get_issuer_constraints(credential_type: str, organization_config: dict = None) -> dict:
    """
    Get issuer constraints for a specific credential type.
    
    Args:
        credential_type: The type of credential
        organization_config: Optional organization-specific issuer configuration
        
    Returns:
        dict: Issuer constraints including trusted issuers list
    """
    # Start with default constraints
    constraints = DEFAULT_ISSUER_CONSTRAINTS.get(credential_type, {
        "trusted_issuers": [],
        "issuer_metadata_requirements": {
            "credential_issuer": True,
            "authorization_server": False,
            "credential_configurations_supported": True
        }
    }).copy()
    
    # Override with organization-specific configuration if provided
    if organization_config and credential_type in organization_config:
        org_constraints = organization_config[credential_type]
        
        # Merge trusted issuers (organization config takes precedence)
        if "trusted_issuers" in org_constraints:
            constraints["trusted_issuers"] = org_constraints["trusted_issuers"]
        
        # Merge metadata requirements
        if "issuer_metadata_requirements" in org_constraints:
            constraints["issuer_metadata_requirements"].update(
                org_constraints["issuer_metadata_requirements"]
            )
    
    return constraints

def apply_issuer_constraints_to_presentation_definition(
    presentation_definition: dict, 
    credential_type: str,
    organization_config: dict = None
) -> dict:
    """
    Apply issuer constraints to a presentation definition.
    
    Args:
        presentation_definition: The base presentation definition
        credential_type: The type of credential
        organization_config: Optional organization-specific issuer configuration
        
    Returns:
        dict: Presentation definition with issuer constraints applied
    """
    definition = presentation_definition.copy()
    constraints = get_issuer_constraints(credential_type, organization_config)
    
    # Apply issuer constraints to each input descriptor
    for descriptor in definition.get("input_descriptors", []):
        if "constraints" not in descriptor:
            descriptor["constraints"] = {"fields": []}
        
        # Add issuer constraint field if trusted issuers are configured
        if constraints.get("trusted_issuers"):
            issuer_constraint = {
                "path": ["$.issuer"],
                "filter": {
                    "type": "string",
                    "enum": constraints["trusted_issuers"]
                }
            }
            
            # Check if issuer constraint already exists
            existing_issuer_constraint = None
            for field in descriptor["constraints"]["fields"]:
                if field.get("path") == ["$.issuer"]:
                    existing_issuer_constraint = field
                    break
            
            if existing_issuer_constraint:
                # Update existing constraint
                existing_issuer_constraint["filter"] = issuer_constraint["filter"]
            else:
                # Add new constraint
                descriptor["constraints"]["fields"].append(issuer_constraint)
    
    return definition

def validate_issuer_against_constraints(
    issuer_did: str, 
    credential_type: str,
    organization_config: dict = None
) -> bool:
    """
    Validate if an issuer is trusted for a specific credential type.
    
    Args:
        issuer_did: The DID of the credential issuer
        credential_type: The type of credential
        organization_config: Optional organization-specific issuer configuration
        
    Returns:
        bool: True if the issuer is trusted, False otherwise
    """
    constraints = get_issuer_constraints(credential_type, organization_config)
    trusted_issuers = constraints.get("trusted_issuers", [])
    
    # If no trusted issuers configured, allow any issuer
    if not trusted_issuers:
        return True
    
    return issuer_did in trusted_issuers