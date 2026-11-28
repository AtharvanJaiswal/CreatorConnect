/**
 * CreatorConnect — Universal Typed API Client
 * Built for Admin Web Console & Public Platform
 * Features: RFC 7807 Problem Details parsing, Bearer Token injection, Parameter serialization.
 */

export interface ProblemDetails {
  type?: string | undefined;
  title: string;
  status: number;
  detail?: string | undefined;
  instance?: string | undefined;
  errors?: Record<string, string[]> | undefined;
  code?: string | undefined;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly problem: ProblemDetails | undefined;
  public readonly url: string;
  public readonly method: string;

  constructor(
    message: string,
    status: number,
    url: string,
    method: string,
    problem?: ProblemDetails | undefined,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.method = method;
    this.problem = problem;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string | null | undefined;
  params?: Record<string, string | number | boolean | undefined | null> | undefined;
  timeoutMs?: number | undefined;
}

class ApiClient {
  private baseUrl: string;
  private tokenGetter: (() => string | null) | null = null;

  constructor(baseUrl?: string) {
    if (baseUrl !== undefined) {
      this.baseUrl = baseUrl;
    } else if (typeof window !== 'undefined') {
      // In browser contexts, use relative same-origin paths so Next.js rewrites
      // proxy /api/* cleanly without violating CSP connect-src 'self'.
      this.baseUrl = '';
    } else {
      this.baseUrl =
        typeof process !== 'undefined'
          ? process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || ''
          : '';
    }
  }

  public setTokenGetter(getter: () => string | null): void {
    this.tokenGetter = getter;
  }

  private resolveToken(explicitToken?: string | null): string | null {
    if (explicitToken !== undefined) {
      return explicitToken;
    }
    if (this.tokenGetter) {
      return this.tokenGetter();
    }
    if (typeof window !== 'undefined') {
      const testToken =
        (window as { __TEST_ACCESS_TOKEN__?: string }).__TEST_ACCESS_TOKEN__ ||
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem('creatorconnect_test_access_token')
          : null);
      if (testToken) return testToken;
    }
    return null;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const isAbsolute = path.startsWith('http://') || path.startsWith('https://');
    let fullUrl = isAbsolute ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    return fullUrl;
  }

  public async request<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const {
      token: explicitToken,
      params,
      timeoutMs = 30000,
      headers: customHeaders,
      ...customInit
    } = options;
    const url = this.buildUrl(path, params);
    const token = this.resolveToken(explicitToken);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((customHeaders as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const fetchInit: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      ...customInit,
    };

    if (body !== undefined) {
      fetchInit.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchInit);

      if (!response.ok) {
        let problem: ProblemDetails | undefined;
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;

        try {
          const contentType = response.headers.get('content-type');
          if (
            contentType &&
            (contentType.includes('application/json') ||
              contentType.includes('application/problem+json'))
          ) {
            problem = await response.json();
            errorMessage = problem?.detail || problem?.title || errorMessage;
          } else {
            const text = await response.text();
            if (text) errorMessage = text;
          }
        } catch {
          // Failed to parse response body as JSON
        }

        throw new ApiError(errorMessage, response.status, url, method, problem);
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return (await response.json()) as T;
      }

      return (await response.text()) as unknown as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'GET', undefined, options);
  }

  public post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', body, options);
  }

  public put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PUT', body, options);
  }

  public patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PATCH', body, options);
  }

  public delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'DELETE', undefined, options);
  }
}

export const apiClient = new ApiClient();
