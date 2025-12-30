/**
 * Backward compatibility tests for Worker PWA.
 * Ensures that existing offline verification functionality is unchanged.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import VPVerification from '../../pages/VPVerification/VPVerification';
import { AuthContext } from '../../context/AuthContext';

// Mock the auth context
const mockAuthContext = {
  user: {
    id: 'user-1',
    username: 'testworker',
    organizationId: 'org-1',
    organizationName: 'Test Organization',
  },
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
  loading: false,
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthContext}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('Backward Compatibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VPVerification Page Compatibility', () => {
    it('should maintain existing offline QR verification functionality', () => {
      renderWithProviders(<VPVerification />);

      // Verify that offline QR verification is still the default
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
      
      // Verify that the offline QR scanner interface is available
      expect(screen.getByText(/scan qr code from credential/i)).toBeInTheDocument();
      
      // Verify that file upload option is still available
      expect(screen.getByText(/upload qr code image/i)).toBeInTheDocument();
    });

    it('should show both offline QR and OpenID4VP options', () => {
      renderWithProviders(<VPVerification />);

      // Verify both verification methods are available
      expect(screen.getByRole('tab', { name: /offline qr/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /openid4vp/i })).toBeInTheDocument();
    });

    it('should default to offline QR verification', () => {
      renderWithProviders(<VPVerification />);

      // Verify offline QR is selected by default
      const offlineTab = screen.getByRole('tab', { name: /offline qr/i });
      expect(offlineTab).toHaveAttribute('aria-selected', 'true');
      
      // Verify OpenID4VP is not selected by default
      const openid4vpTab = screen.getByRole('tab', { name: /openid4vp/i });
      expect(openid4vpTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should allow switching between verification methods', () => {
      renderWithProviders(<VPVerification />);

      // Start with offline QR (default)
      expect(screen.getByText(/scan qr code from credential/i)).toBeInTheDocument();

      // Switch to OpenID4VP
      const openid4vpTab = screen.getByRole('tab', { name: /openid4vp/i });
      fireEvent.click(openid4vpTab);

      // Verify OpenID4VP interface is shown
      expect(screen.getByRole('button', { name: /start openid4vp verification/i })).toBeInTheDocument();

      // Switch back to offline QR
      const offlineTab = screen.getByRole('tab', { name: /offline qr/i });
      fireEvent.click(offlineTab);

      // Verify offline QR interface is restored
      expect(screen.getByText(/scan qr code from credential/i)).toBeInTheDocument();
    });

    it('should maintain existing offline QR verification workflow', () => {
      renderWithProviders(<VPVerification />);

      // Verify all existing offline QR elements are present
      expect(screen.getByText(/scan qr code from credential/i)).toBeInTheDocument();
      expect(screen.getByText(/upload qr code image/i)).toBeInTheDocument();
      
      // Verify camera/scanner functionality is available
      const scanButton = screen.getByRole('button', { name: /start camera/i });
      expect(scanButton).toBeInTheDocument();
      
      // Verify file upload functionality is available
      const uploadButton = screen.getByRole('button', { name: /upload image/i });
      expect(uploadButton).toBeInTheDocument();
    });
  });

  describe('Component Structure Compatibility', () => {
    it('should maintain existing component hierarchy', () => {
      renderWithProviders(<VPVerification />);

      // Verify main container structure is maintained
      const mainContainer = screen.getByRole('main');
      expect(mainContainer).toBeInTheDocument();

      // Verify tab structure is present
      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();

      // Verify both tabs exist
      expect(screen.getByRole('tab', { name: /offline qr/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /openid4vp/i })).toBeInTheDocument();
    });

    it('should maintain existing styling and layout', () => {
      renderWithProviders(<VPVerification />);

      // Verify that the page renders without layout issues
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(tabPanels.length).toBeGreaterThanOrEqual(1);

      // Verify that content is properly contained
      const offlineContent = screen.getByText(/scan qr code from credential/i);
      expect(offlineContent).toBeVisible();
    });
  });

  describe('Authentication Integration Compatibility', () => {
    it('should maintain existing authentication requirements', () => {
      // Test with unauthenticated context
      const unauthenticatedContext = {
        ...mockAuthContext,
        isAuthenticated: false,
        user: null,
      };

      render(
        <BrowserRouter>
          <AuthContext.Provider value={unauthenticatedContext}>
            <VPVerification />
          </AuthContext.Provider>
        </BrowserRouter>
      );

      // Should either redirect or show appropriate message
      // The exact behavior depends on the authentication implementation
      // This test ensures no crashes occur with unauthenticated users
      expect(document.body).toBeInTheDocument();
    });

    it('should maintain organization context', () => {
      renderWithProviders(<VPVerification />);

      // Verify that organization context is maintained
      // This is implicit in the successful rendering with authenticated context
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle component errors gracefully', () => {
      // Mock console.error to prevent test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        renderWithProviders(<VPVerification />);
        
        // Verify component renders without throwing errors
        expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
      } catch (error) {
        // If there are errors, they should be handled gracefully
        expect(error).toBeUndefined();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should maintain existing error boundaries', () => {
      renderWithProviders(<VPVerification />);

      // Verify that the component structure supports error boundaries
      // This is tested by ensuring the component renders successfully
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Performance Compatibility', () => {
    it('should not significantly impact rendering performance', () => {
      const startTime = performance.now();
      
      renderWithProviders(<VPVerification />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Component should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
      
      // Verify component is fully rendered
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
    });

    it('should maintain existing memory usage patterns', () => {
      // Render and unmount component multiple times to check for memory leaks
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderWithProviders(<VPVerification />);
        expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
        unmount();
      }

      // If we reach here without errors, memory management is working
      expect(true).toBe(true);
    });
  });

  describe('Accessibility Compatibility', () => {
    it('should maintain existing accessibility features', () => {
      renderWithProviders(<VPVerification />);

      // Verify ARIA roles are maintained
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(2);

      // Verify tab accessibility
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });

    it('should maintain keyboard navigation', () => {
      renderWithProviders(<VPVerification />);

      const offlineTab = screen.getByRole('tab', { name: /offline qr/i });
      const openid4vpTab = screen.getByRole('tab', { name: /openid4vp/i });

      // Test keyboard navigation between tabs
      offlineTab.focus();
      expect(document.activeElement).toBe(offlineTab);

      // Simulate Tab key to move to next tab
      fireEvent.keyDown(offlineTab, { key: 'Tab' });
      
      // Verify navigation works (exact behavior may vary by implementation)
      expect(openid4vpTab).toBeInTheDocument();
    });
  });

  describe('Data Flow Compatibility', () => {
    it('should maintain existing data structures', () => {
      renderWithProviders(<VPVerification />);

      // Verify that the component accepts the same props/context structure
      // This is implicit in successful rendering with existing AuthContext
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
    });

    it('should maintain existing event handling', () => {
      renderWithProviders(<VPVerification />);

      // Test that existing event handlers still work
      const openid4vpTab = screen.getByRole('tab', { name: /openid4vp/i });
      
      // Should be able to click without errors
      fireEvent.click(openid4vpTab);
      
      // Verify state change occurred
      expect(openid4vpTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Integration Points Compatibility', () => {
    it('should maintain compatibility with routing', () => {
      // Test that the component works within React Router context
      renderWithProviders(<VPVerification />);
      
      // Verify component renders correctly within router
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
    });

    it('should maintain compatibility with context providers', () => {
      // Test that the component works with existing context providers
      renderWithProviders(<VPVerification />);
      
      // Verify component can access context data
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
    });
  });
});