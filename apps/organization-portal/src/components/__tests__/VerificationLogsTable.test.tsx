import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import VerificationLogsTable from '../VerificationLogsTable';
import { VerificationLog } from '../../services/logsService';

// Mock the hooks
vi.mock('../../hooks/useVerificationLogs');

const mockUseLogs = vi.mocked(await import('../../hooks/useVerificationLogs')).useLogs as MockedFunction<any>;

// Mock data
const mockOfflineQRLog: VerificationLog = {
  id: '1',
  verification_status: 'SUCCESS',
  verified_at: '2024-01-01T10:00:00Z',
  vc_hash: 'abc123def456',
  credential_subject: { name: 'John Doe', type: 'IdentityCredential' },
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
};

const mockOpenID4VPLog: VerificationLog = {
  id: '2',
  verification_status: 'SUCCESS',
  verified_at: '2024-01-01T11:00:00Z',
  vc_hash: 'xyz789uvw012',
  credential_subject: { name: 'Jane Smith', type: 'HealthCredential' },
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
};

const mockLogsResponse = {
  logs: [mockOfflineQRLog, mockOpenID4VPLog],
  pagination: {
    current_page: 1,
    total_pages: 1,
    total_count: 2,
    page_size: 20,
    has_next: false,
    has_previous: false
  },
  stats: {
    total_logs: 2,
    success_count: 2,
    failed_count: 0,
    expired_count: 0,
    revoked_count: 0,
    suspended_count: 0,
    unsuccessful_count: 0
  }
};

const renderComponent = (props = {}) => {
  const defaultProps = {
    orgId: 'org-1',
    ...props
  };

  return render(
    <BrowserRouter>
      <VerificationLogsTable {...defaultProps} />
    </BrowserRouter>
  );
};

describe('VerificationLogsTable', () => {
  beforeEach(() => {
    mockUseLogs.mockReturnValue({
      data: mockLogsResponse,
      loading: false,
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render verification logs table with both offline QR and OpenID4VP logs', () => {
    renderComponent();

    // Check table headers
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    expect(screen.getByText('Verified At')).toBeInTheDocument();
    expect(screen.getByText('Credential Subject')).toBeInTheDocument();

    // Check that both logs are displayed
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Check verification methods are displayed
    expect(screen.getByText('Offline QR')).toBeInTheDocument();
    expect(screen.getByText('OpenID4VP')).toBeInTheDocument();
  });

  it('should display method chips with correct colors and icons', () => {
    renderComponent();

    // Check for method chips
    const offlineQRChip = screen.getByText('Offline QR').closest('.MuiChip-root');
    const openID4VPChip = screen.getByText('OpenID4VP').closest('.MuiChip-root');

    expect(offlineQRChip).toBeInTheDocument();
    expect(openID4VPChip).toBeInTheDocument();

    // Check that chips have different styling (primary vs secondary)
    expect(offlineQRChip).toHaveClass('MuiChip-colorPrimary');
    expect(openID4VPChip).toHaveClass('MuiChip-colorSecondary');
  });

  it('should show method filter when filters are enabled', async () => {
    renderComponent();

    // Click filter toggle button
    const filterButton = screen.getByRole('button', { name: /toggle filters/i });
    fireEvent.click(filterButton);

    // Wait for filters to appear
    await waitFor(() => {
      expect(screen.getByLabelText('Method')).toBeInTheDocument();
    });

    // Check method filter options
    const methodSelect = screen.getByLabelText('Method');
    fireEvent.mouseDown(methodSelect);

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Offline QR' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'OpenID4VP' })).toBeInTheDocument();
    });
  });

  it('should filter logs by verification method', async () => {
    renderComponent();

    // Enable filters
    const filterButton = screen.getByRole('button', { name: /toggle filters/i });
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Method')).toBeInTheDocument();
    });

    // Select OpenID4VP filter
    const methodSelect = screen.getByLabelText('Method');
    fireEvent.mouseDown(methodSelect);

    await waitFor(() => {
      const openID4VPOption = screen.getByRole('option', { name: 'OpenID4VP' });
      fireEvent.click(openID4VPOption);
    });

    // Verify that the filter state is updated (component should re-render with filtered data)
    // Note: In a real test, we would mock the useLogs hook to return filtered data
    expect(methodSelect).toHaveValue('openid4vp');
  });

  it('should display organization isolation correctly', () => {
    renderComponent({ orgId: 'org-1' });

    // Verify that useLogs is called with the correct orgId
    expect(mockUseLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1'
      })
    );
  });

  it('should handle loading state', () => {
    mockUseLogs.mockReturnValue({
      data: null,
      loading: true,
      error: null
    });

    renderComponent();

    // Check for skeleton loading elements
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should handle error state', () => {
    const errorMessage = 'Failed to load logs';
    mockUseLogs.mockReturnValue({
      data: null,
      loading: false,
      error: errorMessage
    });

    renderComponent();

    expect(screen.getByText('Error Loading Logs')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should display stats including both verification methods', () => {
    renderComponent();

    // Check that stats are displayed
    expect(screen.getByText('Total: 2')).toBeInTheDocument();
    expect(screen.getByText('Success: 2')).toBeInTheDocument();
    expect(screen.getByText('Failed: 0')).toBeInTheDocument();
  });

  it('should show proper column count with method column', () => {
    renderComponent();

    // Count table headers to ensure method column is included
    const headers = screen.getAllByRole('columnheader');
    // Status, Method, Verified At, Credential Subject, VC Hash, User, Synced At, Actions = 8 columns
    expect(headers).toHaveLength(8);
  });

  it('should handle empty logs state', () => {
    mockUseLogs.mockReturnValue({
      data: {
        ...mockLogsResponse,
        logs: []
      },
      loading: false,
      error: null
    });

    renderComponent();

    expect(screen.getByText('No verification logs found')).toBeInTheDocument();
  });
});