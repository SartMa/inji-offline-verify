"""
Presentation Definition Service for OpenID4VP integration.
Manages presentation definitions and validation logic.
"""
from typing import Dict, Any, Optional, List
import json
import copy
from .presentation_definitions import (
    get_presentation_definition, 
    get_all_presentation_definitions,
    is_supported_credential_type,
    SUPPORTED_CREDENTIAL_TYPES
)
from .issuer_constraints import (
    apply_issuer_constraints_to_presentation_definition,
    get_issuer_constraints,
    validate_issuer_against_constraints
)


class PresentationDefinitionService:
    """
    Service class for managing presentation definitions.
    Handles generation and validation of presentation definitions for OpenID4VP.
    
    This service integrates with the presentation definitions and issuer constraints
    modules to provide a complete presentation definition management solution.
    """
    
    
    @classmethod
    def get_presentation_definition(
        cls, 
        credential_type: str, 
        organization_config: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get a presentation definition by credential type with optional issuer constraints.
        
        Args:
            credential_type: Type of credential (MOSIP_ID, HEALTH_INSURANCE, LAND_REGISTRY)
            organization_config: Optional organization-specific issuer configuration
            
        Returns:
            Dict containing the presentation definition with issuer constraints applied,
            or None if credential type is not supported
        """
        if not is_supported_credential_type(credential_type):
            return None
        
        # Get base presentation definition
        base_definition = get_presentation_definition(credential_type)
        
        # Apply issuer constraints if configured
        if organization_config:
            return apply_issuer_constraints_to_presentation_definition(
                base_definition, 
                credential_type, 
                organization_config
            )
        
        return base_definition
    
    @classmethod
    def get_available_credential_types(cls) -> List[str]:
        """
        Get a list of available credential types.
        
        Returns:
            List of supported credential type identifiers
        """
        return SUPPORTED_CREDENTIAL_TYPES.copy()
    
    @classmethod
    def get_all_presentation_definitions(
        cls, 
        organization_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get all available presentation definitions with optional issuer constraints.
        
        Args:
            organization_config: Optional organization-specific issuer configuration
            
        Returns:
            Dict mapping credential types to their presentation definitions
        """
        all_definitions = get_all_presentation_definitions()
        
        if organization_config:
            # Apply issuer constraints to all definitions
            constrained_definitions = {}
            for credential_type, definition in all_definitions.items():
                constrained_definitions[credential_type] = apply_issuer_constraints_to_presentation_definition(
                    definition, 
                    credential_type, 
                    organization_config
                )
            return constrained_definitions
        
        return all_definitions
    
    @classmethod
    def generate_presentation_definition_for_session(
        cls,
        credential_type: str,
        organization_config: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a presentation definition for a specific verification session.
        
        Args:
            credential_type: Type of credential to request
            organization_config: Optional organization-specific issuer configuration
            session_id: Optional session ID to include in the definition
            
        Returns:
            Dict containing the complete presentation definition for the session
        """
        definition = cls.get_presentation_definition(credential_type, organization_config)
        
        if not definition:
            return None
        
        # Create a copy to avoid modifying the original
        session_definition = copy.deepcopy(definition)
        
        # Add session-specific metadata if session_id is provided
        if session_id:
            session_definition["session_id"] = session_id
            session_definition["generated_at"] = json.dumps({
                "timestamp": "{{current_timestamp}}",  # Will be replaced by calling code
                "session": session_id
            })
        
        return session_definition
    
    @classmethod
    def validate_presentation_against_definition(
        cls, 
        presentation: Dict[str, Any], 
        definition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate that a presentation matches the requested definition.
        
        Args:
            presentation: The submitted verifiable presentation
            definition: The presentation definition to validate against
            
        Returns:
            Dict containing validation result with 'valid' boolean and 'errors' list
        """
        validation_result = {
            "valid": True,
            "errors": []
        }
        
        # Basic structure validation
        if not isinstance(presentation, dict):
            validation_result["valid"] = False
            validation_result["errors"].append("Presentation must be a JSON object")
            return validation_result
        
        # Check if presentation has verifiableCredential array
        if "verifiableCredential" not in presentation:
            validation_result["valid"] = False
            validation_result["errors"].append("Presentation must contain 'verifiableCredential' array")
            return validation_result
        
        credentials = presentation.get("verifiableCredential", [])
        if not isinstance(credentials, list):
            validation_result["valid"] = False
            validation_result["errors"].append("'verifiableCredential' must be an array")
            return validation_result
        
        # Validate against each input descriptor
        input_descriptors = definition.get("input_descriptors", [])
        
        for descriptor in input_descriptors:
            descriptor_id = descriptor.get("id", "unknown")
            descriptor_satisfied = False
            
            # Check if any credential satisfies this descriptor
            for credential in credentials:
                if cls._validate_credential_against_descriptor(credential, descriptor):
                    descriptor_satisfied = True
                    break
            
            if not descriptor_satisfied:
                validation_result["valid"] = False
                validation_result["errors"].append(
                    f"No credential found that satisfies input descriptor '{descriptor_id}'"
                )
        
        return validation_result
    
    @classmethod
    def _validate_credential_against_descriptor(
        cls, 
        credential: Dict[str, Any], 
        descriptor: Dict[str, Any]
    ) -> bool:
        """
        Validate a single credential against an input descriptor.
        
        Args:
            credential: The verifiable credential to validate
            descriptor: The input descriptor to validate against
            
        Returns:
            bool: True if credential satisfies the descriptor, False otherwise
        """
        # Validate format requirements
        format_requirements = descriptor.get("format", {})
        if format_requirements and not cls._validate_credential_format(credential, format_requirements):
            return False
        
        # Validate field constraints
        constraints = descriptor.get("constraints", {})
        fields = constraints.get("fields", [])
        
        for field_constraint in fields:
            if not cls._validate_field_constraint(credential, field_constraint):
                return False
        
        return True
    
    @classmethod
    def _validate_credential_format(
        cls, 
        credential: Dict[str, Any], 
        format_requirements: Dict[str, Any]
    ) -> bool:
        """
        Validate credential format requirements.
        
        Args:
            credential: The verifiable credential
            format_requirements: Format requirements from input descriptor
            
        Returns:
            bool: True if format is valid, False otherwise
        """
        # For LDP VCs, check proof type
        if "ldp_vc" in format_requirements:
            ldp_requirements = format_requirements["ldp_vc"]
            required_proof_types = ldp_requirements.get("proof_type", [])
            
            if required_proof_types:
                credential_proof = credential.get("proof", {})
                credential_proof_type = credential_proof.get("type")
                
                if credential_proof_type not in required_proof_types:
                    return False
        
        # For JWT VCs, check algorithm (simplified validation)
        if "jwt_vc" in format_requirements:
            # JWT VC validation would require JWT parsing
            # This is a placeholder for future implementation
            pass
        
        return True
    
    @classmethod
    def _validate_field_constraint(
        cls, 
        credential: Dict[str, Any], 
        field_constraint: Dict[str, Any]
    ) -> bool:
        """
        Validate a field constraint against a credential.
        
        Args:
            credential: The verifiable credential
            field_constraint: The field constraint to validate
            
        Returns:
            bool: True if constraint is satisfied, False otherwise
        """
        path = field_constraint.get("path", [])
        filter_spec = field_constraint.get("filter", {})
        
        # Extract value from credential using JSONPath-like path
        try:
            value = cls._extract_value_by_path(credential, path)
            return cls._validate_value_against_filter(value, filter_spec)
        except (KeyError, TypeError, IndexError):
            return False
    
    @classmethod
    def _extract_value_by_path(cls, obj: Any, path: List[str]) -> Any:
        """
        Extract value from object using JSONPath-like path.
        
        Args:
            obj: The object to extract from
            path: List of path components (simplified JSONPath)
            
        Returns:
            The extracted value
            
        Raises:
            KeyError, TypeError, IndexError: If path cannot be resolved
        """
        current = obj
        
        for component in path:
            # Handle JSONPath syntax
            if component.startswith("$."):
                # Remove $. prefix and split by dots for nested paths
                component = component[2:]
                if "." in component:
                    # Handle nested paths like "credentialSubject.id"
                    nested_parts = component.split(".")
                    for part in nested_parts:
                        if isinstance(current, dict):
                            current = current[part]
                        else:
                            raise KeyError(f"Cannot resolve path component '{part}' in '{component}'")
                else:
                    # Simple path like "type"
                    if isinstance(current, dict):
                        current = current[component]
                    else:
                        raise KeyError(f"Cannot resolve path component '{component}'")
            elif component == "$":
                # Root reference, continue with current object
                continue
            else:
                # Direct key access
                if isinstance(current, dict):
                    current = current[component]
                elif isinstance(current, list) and component.isdigit():
                    current = current[int(component)]
                else:
                    raise KeyError(f"Cannot resolve path component '{component}'")
        
        return current
    
    @classmethod
    def _validate_value_against_filter(cls, value: Any, filter_spec: Dict[str, Any]) -> bool:
        """
        Validate a value against a filter specification.
        
        Args:
            value: The value to validate
            filter_spec: The filter specification
            
        Returns:
            bool: True if value matches filter, False otherwise
        """
        filter_type = filter_spec.get("type")
        
        # Type validation
        if filter_type == "string" and not isinstance(value, str):
            return False
        elif filter_type == "number" and not isinstance(value, (int, float)):
            return False
        elif filter_type == "array" and not isinstance(value, list):
            return False
        elif filter_type == "object" and not isinstance(value, dict):
            return False
        
        # Enum validation
        if "enum" in filter_spec:
            return value in filter_spec["enum"]
        
        # Contains validation (for arrays)
        if "contains" in filter_spec and isinstance(value, list):
            contains_spec = filter_spec["contains"]
            if "const" in contains_spec:
                return contains_spec["const"] in value
        
        # Const validation
        if "const" in filter_spec:
            return value == filter_spec["const"]
        
        # Minimum validation (for numbers)
        if "minimum" in filter_spec and isinstance(value, (int, float)):
            return value >= filter_spec["minimum"]
        
        # Format validation (basic)
        if "format" in filter_spec:
            format_type = filter_spec["format"]
            if format_type == "date" and isinstance(value, str):
                # Basic date format validation (YYYY-MM-DD)
                try:
                    from datetime import datetime
                    datetime.strptime(value, "%Y-%m-%d")
                    return True
                except ValueError:
                    return False
        
        return True
    
    @classmethod
    def validate_issuer_constraints(
        cls,
        credential: Dict[str, Any],
        credential_type: str,
        organization_config: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Validate issuer constraints for a credential.
        
        Args:
            credential: The verifiable credential to validate
            credential_type: The type of credential
            organization_config: Optional organization-specific issuer configuration
            
        Returns:
            bool: True if issuer is trusted, False otherwise
        """
        issuer = credential.get("issuer")
        if not issuer:
            return False
        
        # Handle issuer as object (extract id) or string
        if isinstance(issuer, dict):
            issuer_did = issuer.get("id", issuer.get("issuer"))
        else:
            issuer_did = issuer
        
        if not issuer_did:
            return False
        
        return validate_issuer_against_constraints(
            issuer_did, 
            credential_type, 
            organization_config
        )
    
    @classmethod
    def add_issuer_constraints(
        cls, 
        definition: Dict[str, Any], 
        trusted_issuers: List[str]
    ) -> Dict[str, Any]:
        """
        Add issuer constraints to a presentation definition.
        
        Args:
            definition: Base presentation definition
            trusted_issuers: List of trusted issuer DIDs
            
        Returns:
            Dict: Modified presentation definition with issuer constraints
        """
        if not trusted_issuers:
            return definition
        
        # Create a copy to avoid modifying the original
        modified_definition = copy.deepcopy(definition)
        
        # Add issuer constraints to each input descriptor
        for descriptor in modified_definition.get("input_descriptors", []):
            if "constraints" not in descriptor:
                descriptor["constraints"] = {"fields": []}
            
            # Add issuer constraint
            issuer_constraint = {
                "path": ["$.issuer"],
                "filter": {
                    "type": "string",
                    "enum": trusted_issuers
                }
            }
            
            descriptor["constraints"]["fields"].append(issuer_constraint)
        
        return modified_definition
    
    @classmethod
    def get_issuer_constraints_for_credential_type(
        cls,
        credential_type: str,
        organization_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get issuer constraints for a specific credential type.
        
        Args:
            credential_type: The type of credential
            organization_config: Optional organization-specific issuer configuration
            
        Returns:
            Dict containing issuer constraints
        """
        return get_issuer_constraints(credential_type, organization_config)
    
    @classmethod
    def is_supported_credential_type(cls, credential_type: str) -> bool:
        """
        Check if a credential type is supported.
        
        Args:
            credential_type: The credential type to check
            
        Returns:
            bool: True if supported, False otherwise
        """
        return is_supported_credential_type(credential_type)