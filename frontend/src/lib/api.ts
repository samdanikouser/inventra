import axios, { AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// JWT Interceptor — attach access token to every outgoing request
// ---------------------------------------------------------------------------
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response Interceptor — auto-refresh expired access tokens
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried, attempt a token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = typeof window !== 'undefined'
        ? localStorage.getItem('refresh_token')
        : null;

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}${endpoints.tokenRefresh}`, {
            refresh: refreshToken,
          });
          const { access } = res.data;
          localStorage.setItem('access_token', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch {
          // Refresh also failed — clear tokens and redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------
export const endpoints = {
  items: '/items/',
  itemsExport: '/items/export/',
  categories: '/categories/',
  outlets: '/outlets/',
  transactions: '/transactions/',
  stockTakes: '/stock-takes/',
  stockTakeItems: '/stock-take-items/',
  stocks: '/stocks/',
  suppliers: '/suppliers/',
  snapshots: '/snapshots/',
  users: '/users/',
  me: '/me/',
  token: '/token/',
  tokenRefresh: '/token/refresh/',
};

// ---------------------------------------------------------------------------
// CSV download helper
// ---------------------------------------------------------------------------
export async function downloadCsv(endpoint: string, filename: string) {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Pagination Helper
// ---------------------------------------------------------------------------

/** Shape of a DRF PageNumberPagination response. */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Fetches ALL pages from a paginated DRF endpoint and returns a flat array.
 * Use this in React Query queryFn when you need the complete dataset.
 *
 * Example:
 *   queryFn: () => fetchAllPages<Item>(endpoints.items)
 */
export async function fetchAllPages<T>(endpoint: string, params?: Record<string, any>): Promise<T[]> {
  const allResults: T[] = [];
  let url: string | null = endpoint;

  while (url) {
    const response: AxiosResponse<PaginatedResponse<T>> = await api.get(url, {
      params: url === endpoint ? params : undefined,  // only pass params on first request
    });
    allResults.push(...response.data.results);
    
    // DRF returns the full URL for `next`, but our axios instance has baseURL set,
    // so we need to strip the baseURL prefix if present.
    if (response.data.next) {
      const nextUrl = new URL(response.data.next);
      url = nextUrl.pathname + nextUrl.search;
      // Strip the /api prefix since baseURL already includes it
      if (url.startsWith('/api')) {
        url = url.slice(4);
      }
    } else {
      url = null;
    }
  }

  return allResults;
}
