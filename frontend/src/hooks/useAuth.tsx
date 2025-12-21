/**
 * useAuth Hook
 * Manages authentication state and operations
 */

'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { api } from '@/lib/api';
import type { User, LoginRequest, RegisterRequest } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  loginWithGoogle: (googleToken: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 * Wrap your app with this to provide authentication context
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetch current user from API
   */
  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.auth.me();
      setUser(userData);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login user
   */
  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      await api.auth.login(credentials);
      // Fetch user profile after successful login
      await refreshUser();
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  /**
   * Login user with Google OAuth token
   */
  const loginWithGoogle = useCallback(async (googleToken: string) => {
    setIsLoading(true);
    try {
      await api.auth.loginWithGoogle(googleToken);
      // Fetch user profile after successful login
      await refreshUser();
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  /**
   * Register new user
   */
  const register = useCallback(async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      await api.auth.register(data);
      // Fetch user profile after successful registration
      await refreshUser();
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  /**
   * Logout user
   */
  const logout = useCallback(() => {
    api.auth.logout();
    setUser(null);
  }, []);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth Hook
 * Access authentication state and operations
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
