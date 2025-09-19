import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Assignment as LogsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useOrganizationUsers, useOrganizationUserActions } from '../hooks/useOrganizationUsers';
import type { OrganizationMember, UpdateMemberData } from '../services/organizationService';

export interface OrganizationUsersTableSimpleProps {
  orgId: string;
}

export const OrganizationUsersTableSimple: React.FC<OrganizationUsersTableSimpleProps> = ({ orgId }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [role, setRole] = useState<'ADMIN' | 'USER' | ''>('');
  const [search, setSearch] = useState('');
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateMemberData>({});

  const { data, loading, error, refetch } = useOrganizationUsers({
    orgId,
    page: page + 1, // API uses 1-based pagination
    pageSize,
    role: role || undefined,
    search: search || undefined,
  });

  const { updateUser, deleteUser, loading: actionLoading, error: actionError } = useOrganizationUserActions();

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0); // Reset to first page when searching
  };

  const handleRoleChange = (event: any) => {
    setRole(event.target.value);
    setPage(0); // Reset to first page when filtering
  };

  const handleEditClick = (member: OrganizationMember) => {
    setEditingMember(member);
    setEditFormData({
      role: member.role,
      full_name: member.full_name || '',
      phone_number: member.phone_number || '',
      gender: member.gender,
      dob: member.dob,
    });
  };

  const handleEditSave = async () => {
    if (!editingMember) return;

    try {
      await updateUser(orgId, editingMember.id, editFormData);
      setEditingMember(null);
      refetch();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleDeleteClick = async (member: OrganizationMember) => {
    if (window.confirm(`Are you sure you want to remove ${member.full_name || member.username} from the organization?`)) {
      try {
        await deleteUser(orgId, member.id);
        refetch();
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  const handleViewLogs = (member: OrganizationMember) => {
    navigate(`/logs/${member.id}`);
  };

  const getRoleColor = (role: string) => {
    return role === 'ADMIN' ? 'primary' : 'default';
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'error';
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading organization members...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">Error: {error}</Alert>
          <Button onClick={refetch} startIcon={<RefreshIcon />} sx={{ mt: 2 }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <Typography>No data available</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Members List
          </Typography>
          
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Search users..."
              value={search}
              onChange={handleSearchChange}
              size="small"
              sx={{ minWidth: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select value={role} onChange={handleRoleChange} label="Role">
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="ADMIN">Admin</MenuItem>
                <MenuItem value="USER">User</MenuItem>
              </Select>
            </FormControl>
            <Button 
              onClick={refetch} 
              startIcon={<RefreshIcon />}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {actionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionError}
            </Alert>
          )}
        </Box>

        {/* Users Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Name
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      (click to view logs)
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Tooltip title="Click to view verification logs" arrow>
                      <Box
                        onClick={() => handleViewLogs(member)}
                        sx={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease-in-out',
                          borderRadius: 1,
                          p: 1,
                          m: -1,
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            transform: 'translateX(4px)',
                          },
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          fontWeight="medium"
                          sx={{ 
                            color: 'primary.main',
                            '&:hover': {
                              textDecoration: 'underline',
                            },
                          }}
                        >
                          {member.full_name || `${member.first_name} ${member.last_name}`.trim() || member.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{member.username}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Chip 
                      label={member.role_display} 
                      color={getRoleColor(member.role)} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{member.phone_number || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={member.is_active ? 'Active' : 'Inactive'} 
                      color={getStatusColor(member.is_active)} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(member.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      onClick={() => handleViewLogs(member)}
                      size="small"
                      color="primary"
                      title="View Verification Logs"
                    >
                      <LogsIcon />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleEditClick(member)}
                      size="small"
                      disabled={actionLoading}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleDeleteClick(member)}
                      size="small"
                      color="error"
                      disabled={actionLoading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={data.pagination.total_count}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(event) => {
            setPageSize(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />

        {/* Edit Dialog */}
        <Dialog open={!!editingMember} onClose={() => setEditingMember(null)}>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={editFormData.role || ''}
                  onChange={(e) => setEditFormData({...editFormData, role: e.target.value as 'ADMIN' | 'USER'})}
                  label="Role"
                >
                  <MenuItem value="ADMIN">Admin</MenuItem>
                  <MenuItem value="USER">User</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                label="Full Name"
                value={editFormData.full_name || ''}
                onChange={(e) => setEditFormData({...editFormData, full_name: e.target.value})}
                fullWidth
              />
              
              <TextField
                label="Phone Number"
                value={editFormData.phone_number || ''}
                onChange={(e) => setEditFormData({...editFormData, phone_number: e.target.value})}
                fullWidth
              />
              
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={editFormData.gender || ''}
                  onChange={(e) => setEditFormData({...editFormData, gender: e.target.value as 'M' | 'F' | 'O'})}
                  label="Gender"
                >
                  <MenuItem value="">Not specified</MenuItem>
                  <MenuItem value="M">Male</MenuItem>
                  <MenuItem value="F">Female</MenuItem>
                  <MenuItem value="O">Other</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                label="Date of Birth"
                type="date"
                value={editFormData.dob || ''}
                onChange={(e) => setEditFormData({...editFormData, dob: e.target.value})}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingMember(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};