"""
OpenID4VP Presentation Definition Configurations

This module contains the presentation definitions for different credential types
supported by the Inji Offline Verify Platform. Each definition specifies what
credentials are being requested and their required format and constraints.

Based on OpenID4VP specification and requirements 3.1, 3.2, 3.3.
"""

# Presentation definitions for supported credential types
PRESENTATION_DEFINITIONS = {
    "MOSIP_ID": {
        "id": "mosip-id-verification",
        "name": "MOSIP Identity Credential Verification",
        "purpose": "Request MOSIP identity credential for verification",
        "input_descriptors": [
            {
                "id": "mosip_identity_credential",
                "name": "MOSIP Identity Credential",
                "purpose": "Verify identity using MOSIP-issued credential",
                "format": {
                    "ldp_vc": {
                        "proof_type": [
                            "Ed25519Signature2020",
                            "Ed25519Signature2018",
                            "RsaSignature2018"
                        ]
                    },
                    "jwt_vc": {
                        "alg": ["EdDSA", "RS256", "ES256K"]
                    }
                },
                "constraints": {
                    "fields": [
                        {
                            "path": ["$.type"],
                            "filter": {
                                "type": "array",
                                "contains": {
                                    "const": "MOSIPIdentityCredential"
                                }
                            }
                        },
                        {
                            "path": ["$.credentialSubject.id"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.fullName"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.dateOfBirth"],
                            "filter": {
                                "type": "string",
                                "format": "date"
                            }
                        }
                    ]
                }
            }
        ]
    },
    
    "HEALTH_INSURANCE": {
        "id": "health-insurance-verification",
        "name": "Health Insurance Credential Verification",
        "purpose": "Request health insurance credential for verification",
        "input_descriptors": [
            {
                "id": "health_insurance_credential",
                "name": "Health Insurance Credential",
                "purpose": "Verify health insurance coverage",
                "format": {
                    "ldp_vc": {
                        "proof_type": [
                            "Ed25519Signature2020",
                            "Ed25519Signature2018",
                            "RsaSignature2018"
                        ]
                    },
                    "jwt_vc": {
                        "alg": ["EdDSA", "RS256", "ES256K"]
                    }
                },
                "constraints": {
                    "fields": [
                        {
                            "path": ["$.type"],
                            "filter": {
                                "type": "array",
                                "contains": {
                                    "const": "HealthInsuranceCredential"
                                }
                            }
                        },
                        {
                            "path": ["$.credentialSubject.id"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.policyNumber"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.insuranceProvider"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.coverageAmount"],
                            "filter": {
                                "type": "number",
                                "minimum": 0
                            }
                        },
                        {
                            "path": ["$.credentialSubject.validFrom"],
                            "filter": {
                                "type": "string",
                                "format": "date"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.validUntil"],
                            "filter": {
                                "type": "string",
                                "format": "date"
                            }
                        }
                    ]
                }
            }
        ]
    },
    
    "LAND_REGISTRY": {
        "id": "land-registry-verification",
        "name": "Land Registry Credential Verification", 
        "purpose": "Request land registry credential for property ownership verification",
        "input_descriptors": [
            {
                "id": "land_registry_credential",
                "name": "Land Registry Credential",
                "purpose": "Verify property ownership through land registry",
                "format": {
                    "ldp_vc": {
                        "proof_type": [
                            "Ed25519Signature2020",
                            "Ed25519Signature2018",
                            "RsaSignature2018"
                        ]
                    },
                    "jwt_vc": {
                        "alg": ["EdDSA", "RS256", "ES256K"]
                    }
                },
                "constraints": {
                    "fields": [
                        {
                            "path": ["$.type"],
                            "filter": {
                                "type": "array",
                                "contains": {
                                    "const": "LandRegistryCredential"
                                }
                            }
                        },
                        {
                            "path": ["$.credentialSubject.id"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.propertyId"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.ownerName"],
                            "filter": {
                                "type": "string"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.propertyAddress"],
                            "filter": {
                                "type": "object",
                                "properties": {
                                    "street": {"type": "string"},
                                    "city": {"type": "string"},
                                    "state": {"type": "string"},
                                    "postalCode": {"type": "string"},
                                    "country": {"type": "string"}
                                },
                                "required": ["street", "city", "state", "country"]
                            }
                        },
                        {
                            "path": ["$.credentialSubject.propertyArea"],
                            "filter": {
                                "type": "object",
                                "properties": {
                                    "value": {"type": "number", "minimum": 0},
                                    "unit": {"type": "string", "enum": ["sqft", "sqm", "acres", "hectares"]}
                                },
                                "required": ["value", "unit"]
                            }
                        },
                        {
                            "path": ["$.credentialSubject.registrationDate"],
                            "filter": {
                                "type": "string",
                                "format": "date"
                            }
                        },
                        {
                            "path": ["$.credentialSubject.registryAuthority"],
                            "filter": {
                                "type": "string"
                            }
                        }
                    ]
                }
            }
        ]
    }
}

# Supported credential types for validation
SUPPORTED_CREDENTIAL_TYPES = list(PRESENTATION_DEFINITIONS.keys())

def get_presentation_definition(credential_type: str) -> dict:
    """
    Get presentation definition for a specific credential type.
    
    Args:
        credential_type: The type of credential (MOSIP_ID, HEALTH_INSURANCE, LAND_REGISTRY)
        
    Returns:
        dict: The presentation definition for the specified credential type
        
    Raises:
        KeyError: If the credential type is not supported
    """
    if credential_type not in PRESENTATION_DEFINITIONS:
        raise KeyError(f"Unsupported credential type: {credential_type}. "
                      f"Supported types: {', '.join(SUPPORTED_CREDENTIAL_TYPES)}")
    
    return PRESENTATION_DEFINITIONS[credential_type]

def get_all_presentation_definitions() -> dict:
    """
    Get all available presentation definitions.
    
    Returns:
        dict: All presentation definitions keyed by credential type
    """
    return PRESENTATION_DEFINITIONS.copy()

def is_supported_credential_type(credential_type: str) -> bool:
    """
    Check if a credential type is supported.
    
    Args:
        credential_type: The credential type to check
        
    Returns:
        bool: True if the credential type is supported, False otherwise
    """
    return credential_type in SUPPORTED_CREDENTIAL_TYPES