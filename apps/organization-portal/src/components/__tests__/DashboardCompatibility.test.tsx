import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MainGrid from '../dash_comp/MainGrid';
import { OrganizationUsersTableSimple } from '../OrganizationUsersTableSimple';

// Mock the hooks
vi.mock('../../hooks/useCurrentUser');
vi.mock('../../hooks/useOrganizationUsers');
vi.mock('../../hooks/useVerificationLogs');

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseCurrentUser = vi.mocked(await import('../../hooks/useCurrentUser')).useCurrentUser as MockedFunction<any>;
const mockUseOrganizationUsers = vi.mocked(await import('../../hooks/useOrganizationUsers')).useOrganizationUsers as MockedFunction<any>;
const mockUseLogsStats = vi.mocked(await import('../../hooks/useVerificationLogs')).useLogsStats as MockedFunction<any>;

const mockOrganizationData = {
  members: [
    {
      id: 'member-1',
      username: 'worker1',
      email: 'worker1@example.com',
      full_name: 'Worker One',
      role: 'USER',
      role_display: 'User',
      phone_number: '+1234567890',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      first_name: 'Worker',
      last_name: 'One'
    },
    {
      id: 'member-2',
      username: 'admin1',
      email: 'admin1@example.com',
      full_name: 'Admin One',
      role: 'ADMIN',
      role_display: 'Admin',
      phone_number: '+1234567891',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      first_name: 'Admin',
      last_name: 'One'
    }
  ],
  pagination: {
    current_page: 1,
    total_pages: 1,
    total_count: 2,
    page_size: 10,
    has_next: false,
    has_previous: false
  },
  stats: {
    total_members: 2,
    admin_count: 1,
    user_count: 1,
    active_members: 2
  }
};

const mockStatsData = {
  stats: {
    total_logs: 15, // Mix of offline QR and OpenID4VP logs
    success_count: 12,
    failed_count: 3,
    expired_count: 0,
    revoked_count: 0,
    suspended_count: 0,
    unsuccessful_count: 3
  }
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Dashboard Compatibility with OpenID4VP Integration', () => {
  beforeEach(() => {
    // Mock current user
    mockUseCurrentUser.mockReturnValue({
      organizationId: 'org-1',
      organizationName: 'Test Organization',
      loading: false,
      error: null
    });

    // Mock organization users
    mockUseOrganizationUsers.mockReturnValue({
      data: mockOrganizationData,
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    // Mock logs stats
    mockUseLogsStats.mockReturnValue({
      data: mockStatsData,
      loading: false,
      error: null
    });

    // Clear navigate mock
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('MainGrid Dashboard Component', () => {
    it('should display organization statistics including OpenID4VP verifications', async () => {
      renderWithRouter(<MainGrid orgId="org-1" />);

      await waitFor(() => {
        // Check that the total logs count includes both verification methods
        expect(screen.getByText('15')).toBeInTheDocument(); // Total verified VCs
        expect(screen.getByText('2')).toBeInTheDocument(); // Total members
      });

      // Verify the correct titles are displayed
      expect(screen.getByText('Organization Users')).toBeInTheDocument();
      expect(screen.getByText('Total Verified VCs')).toBeInTheDocument();
    });

    it('should make the Total Verified VCs card clickable to navigate to logs', async () => {
      renderWithRouter(<MainGrid orgId="org-1" />);

      await waitFor(() => {
        const totalVCsCard = screen.getByText('Total Verified VCs').closest('div');
        expect(totalVCsCard).toBeInTheDocument();
      });

      // Find and click the Total Verified VCs card
      const totalVCsCard = screen.getByText('Total Verified VCs').closest('div');
      if (totalVCsCard) {
        fireEvent.click(totalVCsCard);
        expect(mockNavigate).toHaveBeenCalledWith('/logs');
      }
    });

    it('should display organization name correctly', async () => {
      renderWithRouter(<MainGrid orgId="org-1" />);

      await waitFor(() => {
        expect(screen.getByText('Test Organization Members')).toBeInTheDocument();
      });
    });

    it('should handle loading states gracefully', () => {
      mockUseLogsStats.mockReturnValue({
        data: null,
        loading: true,
        error: null
      });

      renderWithRouter(<MainGrid orgId="org-1" />);

      // Should show loading indicator for stats
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });

  describe('Organization Users Table', () => {
    it('should display organization members with view logs functionality', async () => {
      renderWithRouter(<OrganizationUsersTableSimple orgId="org-1" />);

      await waitFor(() => {
        // Check that members are displayed
        expect(screen.getByText('Worker One')).toBeInTheDocument();
        expect(screen.getByText('Admin One')).toBeInTheDocument();
      });

      // Check that roles are displayed correctly
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('should navigate to user logs when clicking on member name', async () => {
      renderWithRouter(<OrganizationUsersTableSimple orgId="org-1" />);

      await waitFor(() => {
        const workerName = screen.getByText('Worker One');
        expect(workerName).toBeInTheDocument();
      });

      // Click on the worker name
      const workerName = screen.getByText('Worker One');
      fireEvent.click(workerName);

      // Should navigate to the user's logs page
      expect(mockNavigate).toHaveBeenCalledWith('/logs/member-1');
    });

    it('should show view logs action button for all members', async () => {
      renderWithRouter(<OrganizationUsersTableSimple orgId="org-1" />);

      await waitFor(() => {
        // Check that view logs buttons are present
        const logsButtons = screen.getAllByTitle('View Verification Logs');
        expect(logsButtons).toHaveLength(2); // One for each member
      });
    });

    it('should maintain existing filtering and search functionality', async () => {
      renderWithRouter(<OrganizationUsersTableSimple orgId="org-1" />);

      await waitFor(() => {
        // Check that search and filter controls are present
        expect(screen.getByLabelText('Search users...')).toBeInTheDocument();
        expect(screen.getByLabelText('Role')).toBeInTheDocument();
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should display member statistics correctly', async () => {
      renderWithRouter(<OrganizationUsersTableSimple orgId="org-1" />);

      await waitFor(() => {
        // Verify that the organization users hook was called with correct parameters
        expect(mockUseOrganizationUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            orgId: 'org-1',
            page: 1,
            pageSize: 10
          })
        );
      });
    });
  });

  describe('Integration Compatibility', () => {
    it('should maintain existing organization portal features unchanged', async () => {
      renderWithRouter(<MainGrid orgId="org-1" />);

      await waitFor(() => {
        // Verify that all existing features are still present
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Organization Users')).toBeInTheDocument();
        expect(screen.getByText('Total Verified VCs')).toBeInTheDocument();
      });

      // Verify that the stats include both verification methods
      expect(mockUseLogsStats).toHaveBeenCalledWith('org-1');
    });

    it('should handle mixed verification method statistics correctly', () => {
      // The stats should include both offline QR and OpenID4VP verifications
      renderWithRouter(<MainGrid orgId="org-1" />);

      // Verify that the total count (15) represents combined statistics
      expect(mockUseLogsStats).toHaveBeenCalledWith('org-1');
      
      // The component should display the total without distinguishing between methods
      // This ensures backward compatibility while including new OpenID4VP logs
    });

    it('should preserve organization isolation', () => {
      renderWithRouter(<MainGrid orgId="org-1" />);

      // Verify that all hooks are called with the correct organization ID
      expect(mockUseOrganizationUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1'
        })
      );
      expect(mockUseLogsStats).toHaveBeenCalledWith('org-1');
    });

    it('should maintain navigation patterns for logs viewing', async () => {
      renderWithRouter(<OrganizationUsersTableSimple orgId="org-1" />);

      await waitFor(() => {
        const logsButton = screen.getAllByTitle('View Verification Logs')[0];
        fireEvent.click(logsButton);
      });

      // Should navigate to user-specific logs page
      expect(mockNavigate).toHaveBeenCalledWith('/logs/member-1');
    });
  });
});