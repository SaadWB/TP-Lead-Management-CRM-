import { ApiResponse } from '@crm/shared';

function getApiBase(): string {
  // Explicit override via environment variable (e.g. if pointing to a separate dedicated backend)
  if (
    process.env.NEXT_PUBLIC_API_URL &&
    process.env.NEXT_PUBLIC_API_URL !== 'http://localhost:5000' &&
    process.env.NEXT_PUBLIC_API_URL !== 'http://127.0.0.1:5000'
  ) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // Same-origin relative URL (handled natively by Next.js API routes on both localhost and Vercel)
  return '';
}

class ApiClient {
  private refreshPromise: Promise<string | null> | null = null;

  public getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  public setToken(token: string | null): void {
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  private async tryRefreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          this.setToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('crm_user');
          }
          return null;
        }

        const data: ApiResponse<{ token: string; refreshToken?: string }> = await res.json();
        if (data.success && data.data?.token) {
          this.setToken(data.data.token);
          return data.data.token;
        }

        this.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('crm_user');
        }
        return null;
      } catch {
        this.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('crm_user');
        }
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const apiBase = getApiBase();
    const url = `${apiBase}/api/v1${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok) {
        const isAuthRoute =
          cleanEndpoint.includes('/auth/login') ||
          cleanEndpoint.includes('/auth/refresh') ||
          cleanEndpoint.includes('/auth/logout');

        // Transparent auto-refresh on 401 for active user sessions
        if (response.status === 401 && !isAuthRoute && !isRetry) {
          const newToken = await this.tryRefreshToken();
          if (newToken) {
            return this.request<T>(endpoint, options, true);
          }
        }

        if (response.status === 401 && typeof window !== 'undefined') {
          this.setToken(null);
          localStorage.removeItem('crm_user');
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err: any) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, String(val));
        }
      });
      const qs = query.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
