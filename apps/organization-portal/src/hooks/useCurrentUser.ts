import { useState, useEffect } from 'react';
import { userService, CurrentUserResponse } from '../services/userService';

export const useCurrentUser = () => {
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await userService.getCurrentUser();
      setUser(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  return {
    user,
    loading,
    error,
    refetch: fetchCurrentUser,
    organizationId: user?.organization?.id || userService.getCurrentOrganizationId(),
    organizationName: user?.organization?.name || userService.getCurrentOrganizationName(),
    userRole: user?.organization?.role || userService.getCurrentUserRole(),
  };
};