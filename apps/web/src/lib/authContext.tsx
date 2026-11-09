'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, UserRole } from '@crm/shared';
import { api } from './apiClient';
import { invalidateCache } from './apiCache';
import { ForcePasswordChangeModal } from '@/components/auth/ForcePasswordChangeModal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('crm_user');
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    // If no token exists, resolve immediately without unnecessary failing network call
    const token = api.getToken();
    if (!token) {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('crm_user');
      }
      setLoading(false);
      return;
    }

    try {
      const res = await api.get<User>('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('crm_user', JSON.stringify(res.data));
        }
      } else {
        setUser(null);
        api.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('crm_user');
        }
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      // Only clear user credentials if the server explicitly rejected the token (401/unauthorized)
      if (msg.includes('401') || msg.includes('timed out') || msg.includes('invalid') || msg.includes('expired')) {
        setUser(null);
        api.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('crm_user');
        }
      }
      // On temporary network errors, preserve the existing user session from localStorage
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post<{ user: User; token: string }>('/auth/login', { email, password });
    if (res.success && res.data) {
      invalidateCache();
      api.setToken(res.data.token);
      setUser(res.data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_user', JSON.stringify(res.data.user));
      }
      routeToRoleHome(res.data.user.role);
      return res.data.user;
    }
    throw new Error(res.message || 'Login failed');
  }

  async function logout() {
    // 1. Immediately wipe local session, token, and SWR cache
    api.setToken(null);
    setUser(null);
    invalidateCache();

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('crm_user');
        sessionStorage.clear();
      } catch {}
    }

    // 2. Fire and forget server logout (clear cookies)
    try {
      api.post('/auth/logout').catch(() => {});
    } catch {}

    // 3. Immediately hard-redirect to /login to flush in-memory state and avoid layout glitches
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    } else {
      router.push('/login');
    }
  }

  function routeToRoleHome(userRole: UserRole) {
    switch (userRole) {
      case 'SUPER_ADMIN':
        router.push('/admin/dashboard');
        break;
      case 'TELECALLER':
        router.push('/telecaller/leads');
        break;
      case 'SALESMAN':
        router.push('/salesman/dashboard');
        break;
      default:
        router.push('/login');
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null,
      }}
    >
      {children}
      {user?.mustChangePassword && (
        <ForcePasswordChangeModal
          isOpen={true}
          user={user}
          onSuccess={(updatedUser) => {
            const nextUser = { ...user, ...updatedUser, mustChangePassword: false };
            setUser(nextUser);
            if (typeof window !== 'undefined') {
              localStorage.setItem('crm_user', JSON.stringify(nextUser));
            }
            routeToRoleHome(nextUser.role);
          }}
          onLogout={logout}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
