'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, UserRole } from '@crm/shared';
import { api } from './apiClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  quickLogin: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await api.get<User>('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post<{ user: User; token: string }>('/auth/login', { email, password });
    if (res.success && res.data) {
      api.setToken(res.data.token);
      setUser(res.data.user);
      routeToRoleHome(res.data.user.role);
      return res.data.user;
    }
    throw new Error(res.message || 'Login failed');
  }

  async function quickLogin(targetRole: UserRole) {
    let email = 'admin@tenderprocure.com';
    if (targetRole === 'TELECALLER') email = 'telecaller1@tenderprocure.com';
    else if (targetRole === 'SALESMAN') email = 'sales1@tenderprocure.com';

    await login(email, 'Password@123');
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      api.setToken(null);
      setUser(null);
      router.push('/login');
    }
  }

  function routeToRoleHome(userRole: UserRole) {
    switch (userRole) {
      case 'SUPER_ADMIN':
        router.push('/admin/dashboard');
        break;
      case 'TELECALLER':
        router.push('/telecaller/today');
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
        quickLogin,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null,
      }}
    >
      {children}
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
