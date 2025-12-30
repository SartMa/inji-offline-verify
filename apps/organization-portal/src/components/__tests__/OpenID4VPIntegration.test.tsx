import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MainGrid from '../dash_comp/MainGrid';
import VerificationLogsTable from '../VerificationLogsTable';
import { VerificationLog } from '../../services/logsService';

// Mock the hooks
vi.mock('../../hooks/useCurrentUser');
vi.mock('../../hooks/useOrganizationUsers');
vi.mock('../../hooks/useVerificationLogs');

const mockUseCurrentUser = vi.mocked(await import('../../hooks/useCurrentUser')).useCurrentUser as MockedFunction<any>;
const mockUseOrganizationUsers = vi.mocked(await import('../../hooks/useOrganizationUsers')).useOrganizationUsers as MockedFunction<any>;
const mockUseLogs = vi.mocked(await import('../../hooks/useVerificationLogs')).useLogs as MockedFunction<any>;
const mockUseLogsStats = vi.mocked(await import('../../hooks/useVerificationLogs')).useLogsStats as MockedFunction<any>;

// Mock data with both verification methods
const mockMixedLogs: VerificationLog[] = [
  {
    id: '1',
    verification_status: 'SUCCESS',
    verified_at: '2024-01-01T10:00:00Z',
    vc_hash: 'abc123',
    credential_subject: { name: 'John Doe' },
    organization: 'org-1',
    verified_by: 'user-1',
    verified_by_info: {
      id: 'user-1',
      username: 'worker1',
      full_name: 'Worker One',
      email: 'worker1@example.com'
    },
    verification_method: 'offline_qr',
    synced_at: '2024-01-01T10:01:00Z'
  },
  {
    id: '2',
    verification_status: 'SUCCESS',
    verified_at: '2024-01-01T11:00:00Z',
    vc_hash: 'xyz789',
    credential_subject: { name: 'Jane Smith' },
    organization: 'org-1',
    verified_by: 'user-2',
    verified_by_info: {
      id: 'user-2',
      username: 'worker2',
      full_name: 'Worker Two',
      email: 'worker2@example.com'
    },
    verification_method: 'openid4vp',
    openid4vp_session: 'session-123',
    synced_at: '2024-01-01T11:01:00Z'
  },
  {
    id: '3',
    verification_status: 'FAILED',
    verified_at: '2024-01-01T12:00:00Z',
    vc_hash: 'def456',
    credential_subject: { name: 'Bob Johnson' },
    organization: 'org-1',
    verified_by: 'user-1',
    verified_by_info: {
      id: 'user-1',
      username: 'worker1',
      full_name: 'Worker One',
      email: 'worker1@example.com'
    },
    verification_method: 'openid4vp',
    openid4vp_session: 'session-456',
    error_message: 'Invalid signature',
    synced_at: '2024-01-01T12:01:00Z'
  }
];

const mockStatsData = {
  stats: {
    total_logs: 3,
    success_count: 2,
    failed_count: 1,
    expired_count: 0,
    revoked_count: 0,
    suspended_count: 0,
    unsuccessful_count: 1
  }
};

const mockLogsResponse = {
  logs: mockMixedLogs,
  pagination: {
    current_page: 1,
    total_pages: 1,
    total_count: 3,
    page_size: 20,
    has_next: false,
    has_previous: false
  },
  stats: mockStatsData.stats
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('OpenID4VP Dashboard Integration', () => {
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
      data: {
        stats: {
          total_members: 5
        }
      },
      loading: false
    });

    // Mock logs stats
    mockUseLogsStats.mockReturnValue({
      data: mockStatsData,
      loading: false
    });

    // Mock logs data
    mockUseLogs.mockReturnValue({
      data: mockLogsResponse,
      loading: false,
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display combined statistics including both offline QR and OpenID4VP verifications', async () => {
    renderWithRouter(<MainGrid orgId="org-1" />);

    await waitFor(() => {
      // Check that the total logs count includes both verification methods
      expect(screen.getByText('3')).toBeInTheDocument(); // Total verified VCs
      expect(screen.getByText('5')).toBeInTheDocument(); // Total members
    });

    // Verify the stats hook was called with the correct org ID
    expect(mockUseLogsStats).toHaveBeenCalledWith('org-1');
  });

  it('should display both offline QR and OpenID4VP logs in the verification table', () => {
    renderWithRouter(<VerificationLogsTable orgId="org-1" />);

    // Check that both verification methods are displayed
    expect(screen.getByText('Offline QR')).toBeInTheDocument();
    expect(screen.getByText('OpenID4VP')).toBeInTheDocument();

    // Check that all logs are displayed
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();

    // Check that success and failed statuses are shown
    expect(screen.getAllByText('Success')).toHaveLength(2);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should maintain organization isolation for OpenID4VP logs', () => {
    renderWithRouter(<VerificationLogsTable orgId="org-1" />);

    // Verify that the logs hook was called with the correct organization ID
    expect(mockUseLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1'
      })
    );
  });

  it('should show method filter in verification logs table', async () => {
    renderWithRouter(<VerificationLogsTable orgId="org-1" />);

    // Click filter toggle button
    const filterButton = screen.getByRole('button', { name: /toggle filters/i });
    expect(filterButton).toBeInTheDocument();
  });

  it('should display proper statistics breakdown', () => {
    renderWithRouter(<VerificationLogsTable orgId="org-1" />);

    // Check that statistics are displayed correctly
    expect(screen.getByText('Total: 3')).toBeInTheDocument();
    expect(screen.getByText('Success: 2')).toBeInTheDocument();
    expect(screen.getByText('Failed: 1')).toBeInTheDocument();
  });

  it('should handle mixed verification methods in the same organization', () => {
    renderWithRouter(<VerificationLogsTable orgId="org-1" />);

    // Verify that logs from both methods are shown for the same organization
    const offlineQRChips = screen.getAllByText('Offline QR');
    const openID4VPChips = screen.getAllByText('OpenID4VP');

    expect(offlineQRChips).toHaveLength(1);
    expect(openID4VPChips).toHaveLength(2);

    // Verify that both successful and failed OpenID4VP logs are shown
    const successChips = screen.getAllByText('Success');
    const failedChips = screen.getAllByText('Failed');

    expect(successChips).toHaveLength(2); // One offline QR success, one OpenID4VP success
    expect(failedChips).toHaveLength(1); // One OpenID4VP failure
  });
});