import { useState, useEffect } from 'react';
import { 
  organizationService, 
  OrganizationUsersResponse, 
  GetOrganizationUsersParams,
  OrganizationMember,
  UpdateMemberData 
} from '../services/organizationService';

export const useOrganizationUsers = (params: GetOrganizationUsersParams) => {
  const [data, setData] = useState<OrganizationUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await organizationService.getOrganizationUsers(params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.orgId) {
      fetchUsers();
    }
  }, [params.orgId, params.role, params.search, params.page, params.pageSize]);

  return {
    data,
    loading,
    error,
    refetch: fetchUsers,
  };
};

export const useOrganizationUserDetail = (orgId: string, memberId: string) => {
  const [member, setMember] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMember = async () => {
    if (!orgId || !memberId) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await organizationService.getOrganizationUserDetail(orgId, memberId);
      setMember(result.member);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMember();
  }, [orgId, memberId]);

  return {
    member,
    loading,
    error,
    refetch: fetchMember,
  };
};

export const useOrganizationUserActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUser = async (orgId: string, memberId: string, data: UpdateMemberData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await organizationService.updateOrganizationUser(orgId, memberId, data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (orgId: string, memberId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await organizationService.deleteOrganizationUser(orgId, memberId);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    updateUser,
    deleteUser,
    loading,
    error,
  };
};