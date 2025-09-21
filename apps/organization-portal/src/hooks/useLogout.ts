// Hook for logout functionality
import { useCallback } from 'react';
import { logoutService, LogoutOptions } from '../services/logoutService';

export const useLogout = () => {
  const logout = useCallback(async (options?: LogoutOptions) => {
    await logoutService.logout(options);
  }, []);

  const logoutAndRedirect = useCallback(async (path: string) => {
    await logoutService.logoutAndRedirect(path);
  }, []);

  const clearData = useCallback(async () => {
    await logoutService.clearData();
  }, []);

  return {
    logout,
    logoutAndRedirect,
    clearData,
  };
};