import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import API, { setAccessToken } from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper functions for safe localStorage access
const getStorageItem = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

const setStorageItem = (key: string, value: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

const removeStorageItem = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuth = async () => {
    try {
      // Check if we have a stored token
      const token = getStorageItem('accessToken');
      if (token) {
        setAccessToken(token);
        
        // Verify the token is still valid
        const { data: resp } = await API.get('/api/auth/me');
        setUser(resp.data || resp);
      }
    } catch (error) {
      // Token is invalid, clear it
      removeStorageItem('accessToken');
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data: resp } = await API.post('/api/auth/login', { email, password });
      
      const { token, user: userData } = resp;
      
      if (token && userData) {
        // Store token in localStorage for persistence
        setStorageItem('accessToken', token);
        
        // Set authorization header for all future API calls
        setAccessToken(token);
        
        // Update user state
        setUser(userData);
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || 'Login failed');
    }
  };

  const logout = async () => {
    // Clear local state and tokens
    removeStorageItem('accessToken');
    setAccessToken(null);
    setUser(null);
    
    // Redirect to login
    router.push('/login');
  };

  useEffect(() => {
    // Only check auth on the client side
    if (typeof window !== 'undefined') {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
