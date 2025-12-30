"""
Tests for OpenID4VP configuration module.
"""

import unittest
from .config import OpenID4VPConfig, get_presentation_definition_for_type, get_supported_types
from .presentation_definitions import SUPPORTED_CREDENTIAL_TYPES


class TestOpenID4VPConfig(unittest.TestCase):
    """Test cases for OpenID4VP configuration."""
    
    def test_supported_credential_types(self):
        """Test that all expected credential types are supported."""
        expected_types = ['MOSIP_ID', 'HEALTH_INSURANCE', 'LAND_REGISTRY']
        supported_types = get_supported_types()
        
        self.assertEqual(set(expected_types), set(supported_types))
        self.assertEqual(len(expected_types), len(supported_types))
    
    def test_get_presentation_definition_mosip_id(self):
        """Test getting MOSIP_ID presentation definition."""
        definition = get_presentation_definition_for_type('MOSIP_ID')
        
        self.assertEqual(definition['id'], 'mosip-id-verification')
        self.assertEqual(definition['name'], 'MOSIP Identity Credential Verification')
        self.assertIn('input_descriptors', definition)
        self.assertEqual(len(definition['input_descriptors']), 1)
        
        descriptor = definition['input_descriptors'][0]
        self.assertEqual(descriptor['id'], 'mosip_identity_credential')
        self.assertIn('format', descriptor)
        self.assertIn('constraints', descriptor)
    
    def test_get_presentation_definition_health_insurance(self):
        """Test getting HEALTH_INSURANCE presentation definition."""
        definition = get_presentation_definition_for_type('HEALTH_INSURANCE')
        
        self.assertEqual(definition['id'], 'health-insurance-verification')
        self.assertEqual(definition['name'], 'Health Insurance Credential Verification')
        self.assertIn('input_descriptors', definition)
        self.assertEqual(len(definition['input_descriptors']), 1)
        
        descriptor = definition['input_descriptors'][0]
        self.assertEqual(descriptor['id'], 'health_insurance_credential')
        self.assertIn('format', descriptor)
        self.assertIn('constraints', descriptor)
    
    def test_get_presentation_definition_land_registry(self):
        """Test getting LAND_REGISTRY presentation definition."""
        definition = get_presentation_definition_for_type('LAND_REGISTRY')
        
        self.assertEqual(definition['id'], 'land-registry-verification')
        self.assertEqual(definition['name'], 'Land Registry Credential Verification')
        self.assertIn('input_descriptors', definition)
        self.assertEqual(len(definition['input_descriptors']), 1)
        
        descriptor = definition['input_descriptors'][0]
        self.assertEqual(descriptor['id'], 'land_registry_credential')
        self.assertIn('format', descriptor)
        self.assertIn('constraints', descriptor)
    
    def test_unsupported_credential_type(self):
        """Test that unsupported credential types raise KeyError."""
        with self.assertRaises(KeyError):
            get_presentation_definition_for_type('UNSUPPORTED_TYPE')
    
    def test_validate_credential_type(self):
        """Test credential type validation."""
        self.assertTrue(OpenID4VPConfig.validate_credential_type('MOSIP_ID'))
        self.assertTrue(OpenID4VPConfig.validate_credential_type('HEALTH_INSURANCE'))
        self.assertTrue(OpenID4VPConfig.validate_credential_type('LAND_REGISTRY'))
        self.assertFalse(OpenID4VPConfig.validate_credential_type('INVALID_TYPE'))
    
    def test_presentation_definition_structure(self):
        """Test that presentation definitions have required structure."""
        for credential_type in SUPPORTED_CREDENTIAL_TYPES:
            definition = get_presentation_definition_for_type(credential_type)
            
            # Check required top-level fields
            self.assertIn('id', definition)
            self.assertIn('name', definition)
            self.assertIn('purpose', definition)
            self.assertIn('input_descriptors', definition)
            
            # Check input descriptors structure
            self.assertIsInstance(definition['input_descriptors'], list)
            self.assertGreater(len(definition['input_descriptors']), 0)
            
            for descriptor in definition['input_descriptors']:
                self.assertIn('id', descriptor)
                self.assertIn('name', descriptor)
                self.assertIn('purpose', descriptor)
                self.assertIn('format', descriptor)
                self.assertIn('constraints', descriptor)
                
                # Check format structure
                format_obj = descriptor['format']
                self.assertTrue('ldp_vc' in format_obj or 'jwt_vc' in format_obj)
                
                # Check constraints structure
                constraints = descriptor['constraints']
                self.assertIn('fields', constraints)
                self.assertIsInstance(constraints['fields'], list)
    
    def test_issuer_constraints_application(self):
        """Test that issuer constraints can be applied."""
        org_config = {
            'MOSIP_ID': {
                'trusted_issuers': ['did:web:custom.issuer.com']
            }
        }
        
        definition = get_presentation_definition_for_type('MOSIP_ID', org_config)
        
        # Check that issuer constraint was added
        descriptor = definition['input_descriptors'][0]
        fields = descriptor['constraints']['fields']
        
        issuer_field = None
        for field in fields:
            if field.get('path') == ['$.issuer']:
                issuer_field = field
                break
        
        self.assertIsNotNone(issuer_field)
        self.assertEqual(
            issuer_field['filter']['enum'],
            ['did:web:custom.issuer.com']
        )
    
    def test_issuer_validation(self):
        """Test issuer validation functionality."""
        # Test with default constraints
        self.assertTrue(
            OpenID4VPConfig.validate_issuer(
                'did:web:mosip.io',
                'MOSIP_ID'
            )
        )
        
        # Test with custom organization config
        org_config = {
            'MOSIP_ID': {
                'trusted_issuers': ['did:web:custom.issuer.com']
            }
        }
        
        self.assertTrue(
            OpenID4VPConfig.validate_issuer(
                'did:web:custom.issuer.com',
                'MOSIP_ID',
                org_config
            )
        )
        
        self.assertFalse(
            OpenID4VPConfig.validate_issuer(
                'did:web:untrusted.issuer.com',
                'MOSIP_ID',
                org_config
            )
        )


if __name__ == '__main__':
    unittest.main()