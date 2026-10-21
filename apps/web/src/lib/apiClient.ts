import { ApiResponse } from '@crm/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class ApiClient {
  private getToken(): string | null {
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

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
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
    const url = `${API_BASE}/api/v1${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok) {
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
