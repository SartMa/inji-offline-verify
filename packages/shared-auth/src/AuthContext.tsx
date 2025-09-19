import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getAccessToken, clearTokens, getCurrentUser } from './authService';

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
  signOut: () => void;
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
        // If we can't get user data, clear everything
        setUser(null);
        setOrganization(null);
        setIsAuthenticated(false);
        clearTokens();
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
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
        await refreshUserData();
      }
      setIsLoading(false);
    };

    checkExistingAuth();
  }, []);

  const signIn = async (email: string, _password: string): Promise<void> => {
    // After successful login, refresh user data
    await refreshUserData();
    return Promise.resolve();
  };

  const signOut = (): void => {
    // Clear tokens from localStorage
    clearTokens();
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
