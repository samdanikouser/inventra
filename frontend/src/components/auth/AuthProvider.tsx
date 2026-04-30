'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api, { endpoints } from '@/lib/api';
import { CurrentUser, UserRole } from '@/types/inventory';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CurrentUser | null;
  role: UserRole;
  isManager: boolean;
  isSupervisor: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const defaultCtx: AuthContextType = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  role: 'STAFF',
  isManager: false,
  isSupervisor: false,
  refresh: async () => {},
  logout: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultCtx);

export const useAuth = () => useContext(AuthContext);

const PUBLIC_PATHS = ['/login'];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<CurrentUser>(endpoints.me);
      setUser(data);
      return data;
    } catch (err) {
      // 401 or network error -> log out
      setUser(null);
      return null;
    }
  }, []);

  // On mount and on path change, validate the token & fetch user.
  useEffect(() => {
    const init = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) {
        setUser(null);
        setIsLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) router.push('/login');
        return;
      }
      const me = await fetchMe();
      setIsLoading(false);
      if (!me && !PUBLIC_PATHS.includes(pathname)) {
        router.push('/login');
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    router.push('/login');
  };

  const value: AuthContextType = {
    isAuthenticated: !!user,
    isLoading,
    user,
    role: user?.role ?? 'STAFF',
    isManager: !!user?.is_manager,
    isSupervisor: !!user?.is_supervisor,
    refresh: async () => {
      await fetchMe();
    },
    logout,
  };

  if (isLoading && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-pulse text-[#9CA3AF] text-xs font-bold uppercase tracking-widest">
          Verifying session…
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook for components that need to know whether the current user has
 * permission to view/edit a specific feature.
 */
export const useCanAccess = (page: string): boolean => {
  const { role } = useAuth();
  if (role === 'MANAGER') return true;
  if (role === 'SUPERVISOR') {
    return !['write-offs', 'suppliers', 'reports', 'reorder', 'audit'].includes(page);
  }
  if (role === 'STAFF') {
    return ['dashboard', 'inventory', 'breakage', 'barcodes', 'transfers', 'purchases'].includes(page);
  }
  return false;
};
