import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getAccessToken, clearTokens, clearAllUserData, getCurrentUser, getCachedUserData } from './authService';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  date_joined: string;
}

interface Organization {
  id: string;
  name: string;
  role: string;
  member_id: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  organization: Organization | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserData = async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setOrganization(null);
      setIsAuthenticated(false);
      return;
    }

    try {
      const profileData = await getCurrentUser();
      if (profileData?.success && profileData.user) {
        setUser(profileData.user);
        setOrganization(profileData.organization || null);
        setIsAuthenticated(true);
      } else {
        // If we can't get user data but we're offline, keep the auth state
        if (!navigator.onLine) {
          // Keep existing auth state when offline
          return;
        }
        // If we're online but can't get user data, clear everything
        setUser(null);
        setOrganization(null);
        setIsAuthenticated(false);
        clearTokens();
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      // If we're offline, don't clear auth state
      if (!navigator.onLine) {
        console.log('Offline mode: keeping existing auth state');
        return;
      }
      // Only clear auth state if we're online and there's an error
      setUser(null);
      setOrganization(null);
      setIsAuthenticated(false);
      clearTokens();
    }
  };

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      const token = getAccessToken();
      if (token) {
        // First, try to load cached user data immediately for better UX
        const cachedData = getCachedUserData();
        if (cachedData?.success && cachedData.user) {
          setUser(cachedData.user);
          setOrganization(cachedData.organization || null);
          setIsAuthenticated(true);
        }
        
        // Then try to refresh with fresh data (will use cache if offline)
        await refreshUserData();
      }
      setIsLoading(false);
    };

    checkExistingAuth();
  }, []);

  // Listen for online/offline events to handle connectivity changes
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online - refreshing user data');
      if (isAuthenticated) {
        refreshUserData();
      }
    };

    const handleOffline = () => {
      console.log('Gone offline - using cached data');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated]);

  const signIn = async (_email: string, _password: string): Promise<void> => {
    // After successful login, refresh user data
    await refreshUserData();
    return Promise.resolve();
  };

  const signOut = async (): Promise<void> => {
    // Clear all user data including IndexedDB
    await clearAllUserData();
    setUser(null);
    setOrganization(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    organization,
    signIn,
    signOut,
    isLoading,
    refreshUserData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
