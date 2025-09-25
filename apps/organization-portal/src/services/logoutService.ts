// Logout service to handle complete logout functionality
import { clearAllUserData } from '@inji-offline-verify/shared-auth';

export interface LogoutOptions {
  redirect?: boolean;
  redirectPath?: string;
}

export class LogoutService {
  /**
   * Performs complete logout by clearing all cached data
   */
  static async logout(options: LogoutOptions = {}) {
    const { redirect = true, redirectPath = '/signin' } = options;

    try {
      // Clear all user data including tokens and IndexedDB
      await clearAllUserData();

      // Clear organization data from localStorage (additional cleanup)
      localStorage.removeItem('organizationId');
      localStorage.removeItem('organizationName');
      localStorage.removeItem('userRole');

      // Clear session storage as well
      sessionStorage.clear();

      // Optional: Clear cookies if any
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });

      console.log('Logout completed successfully - all data cleared');

      // Redirect if requested
      if (redirect && typeof window !== 'undefined') {
        window.location.href = redirectPath;
      }

    } catch (error) {
      console.error('Error during logout:', error);
      
      // Even if there's an error, still try to redirect
      if (redirect && typeof window !== 'undefined') {
        window.location.href = redirectPath;
      }
    }
  }

  /**
   * Quick logout without redirect
   */
  static async clearData() {
    await this.logout({ redirect: false });
  }

  /**
   * Logout and redirect to specific path
   */
  static async logoutAndRedirect(path: string) {
    await this.logout({ redirect: true, redirectPath: path });
  }
}

export const logoutService = LogoutService;