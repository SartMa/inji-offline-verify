import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAccessToken, clearTokens } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state for token check

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

  const signIn = (email, password) => {
    // Add your authentication logic here
    // This should be called after successful API login
    setUser({ email });
    setIsAuthenticated(true);
    return Promise.resolve();
  };

  const signOut = () => {
    // Clear tokens from localStorage
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    isAuthenticated,
    user,
    signIn,
    signOut,
    isLoading // Expose loading state
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
