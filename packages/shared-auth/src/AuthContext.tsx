import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getAccessToken, clearTokens } from './authService';

interface User {
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkExistingAuth = () => {
      const token = getAccessToken();
      if (token) {
        // If we have a token, consider user authenticated
        setIsAuthenticated(true);
        // You could also decode the token to get user info if needed
        setUser({ email: 'authenticated_user' }); // Placeholder user
      }
      setIsLoading(false);
    };

    checkExistingAuth();
  }, []);

  const signIn = async (email: string, _password: string): Promise<void> => {
    // This should be called after successful API login
    setUser({ email });
    setIsAuthenticated(true);
    return Promise.resolve();
  };

  const signOut = (): void => {
    // Clear tokens from localStorage
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    signIn,
    signOut,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
