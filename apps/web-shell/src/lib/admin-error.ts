import { ApiError } from './api-client';

export interface AdminErrorState {
  status: number | null;
  code?: string | undefined;
  title: string;
  detail: string;
  isUnauthorized: boolean;
  isForbidden: boolean;
}

/**
 * Converts API or runtime exceptions into explicit, honest admin console error states
 * so pages render real diagnostics instead of fabricating fallback mock data.
 */
export function parseAdminApiError(
  err: unknown,
  fallbackDetail = 'Failed to load administrative records from backend API.',
): AdminErrorState {
  if (err instanceof ApiError) {
    const isUnauthorized = err.status === 401;
    const isForbidden = err.status === 403;
    const title = isUnauthorized
      ? 'Authentication Required'
      : isForbidden
        ? 'Access Denied (Insufficient Permissions)'
        : err.problem?.title || `Backend Request Failed (HTTP ${err.status})`;

    return {
      status: err.status,
      code: err.problem?.code,
      title,
      detail: err.problem?.detail || err.message || fallbackDetail,
      isUnauthorized,
      isForbidden,
    };
  }

  if (err instanceof Error) {
    return {
      status: null,
      title: 'Backend Request Error',
      detail: err.message || fallbackDetail,
      isUnauthorized: false,
      isForbidden: false,
    };
  }

  return {
    status: null,
    title: 'Backend Request Error',
    detail: fallbackDetail,
    isUnauthorized: false,
    isForbidden: false,
  };
}
