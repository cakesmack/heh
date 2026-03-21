/**
 * useAuth Hook
 * Manages authentication state and operations
 */

'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
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
  bookmarkedIds: string[];
  toggleBookmarkedId: (id: string, isBookmarked: boolean) => void;
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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetch current user from API
   */
  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.auth.me();
      setUser(userData);
      
      // Fetch bookmarked event IDs in bulk
      if (userData) {
        try {
          const ids = await api.bookmarks.getMyIds();
          setBookmarkedIds(ids);
        } catch (bookmarkError) {
          console.error('Failed to fetch bookmark IDs:', bookmarkError);
        }
      } else {
        setBookmarkedIds([]);
      }
    } catch (error) {
      setUser(null);
      setBookmarkedIds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Optimistically toggle a bookmarked ID in local state
   */
  const toggleBookmarkedId = useCallback((id: string, isBookmarked: boolean) => {
    setBookmarkedIds(prev => {
      if (isBookmarked) {
        if (!prev.includes(id)) return [...prev, id];
      } else {
        return prev.filter(item => item !== id);
      }
      return prev;
    });
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
  const logout = useCallback(async () => {
    // Navigate home first to avoid protected route redirects (404s)
    await router.push('/');
    // Then clear auth state
    api.auth.logout();
    setUser(null);
    toast.success('Logged out successfully. See you soon!');
  }, [router]);

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
    bookmarkedIds,
    toggleBookmarkedId,
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
