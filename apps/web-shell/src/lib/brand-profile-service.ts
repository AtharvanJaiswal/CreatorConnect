import type {
  UpdateBrandProfileInput,
  BrandProfileResponse,
  ProfileVisibility,
} from '@creatorconnect/contracts';

export interface BrandFormData {
  companyName: string;
  industry: string;
  websiteUrl: string;
  companySize: string;
  bio: string;
  visibility: ProfileVisibility;
}

export type BrandFormStatus = 'IDLE' | 'LOADING' | 'READY' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR';

export const DEFAULT_BRAND_FORM_DATA: BrandFormData = {
  companyName: '',
  industry: '',
  websiteUrl: '',
  companySize: '',
  bio: '',
  visibility: 'PUBLIC',
};

export const COMPANY_SIZE_OPTIONS = [
  { value: '', label: 'Select company size (optional)' },
  { value: '1-10', label: '1 - 10 employees (Startup)' },
  { value: '11-50', label: '11 - 50 employees (Small Business)' },
  { value: '51-200', label: '51 - 200 employees (Mid-Market)' },
  { value: '201-500', label: '201 - 500 employees (Commercial)' },
  { value: '501-1000', label: '501 - 1000 employees (Large)' },
  { value: '1000+', label: '1000+ employees (Enterprise)' },
];

export interface BrandFormValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof BrandFormData, string>>;
}

/**
 * Strict HTTPS URL validation complying with HttpsUrlSchema:
 * - Must start with https://
 * - Valid URL structure with https: protocol
 * - No username or password credentials
 * - Maximum length 512 characters
 */
export function isValidHttpsUrl(val: string): boolean {
  if (!val) return true;
  if (typeof val !== 'string') return false;
  if (val.length > 512) return false;
  if (!val.startsWith('https://')) return false;
  try {
    const parsed = new URL(val);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates brand profile form data against contractual domain constraints.
 */
export function validateBrandProfile(data: BrandFormData): BrandFormValidationResult {
  const errors: Partial<Record<keyof BrandFormData, string>> = {};

  const trimmedName = data.companyName.trim();
  if (!trimmedName) {
    errors.companyName = 'Company name is required.';
  } else if (trimmedName.length > 150) {
    errors.companyName = 'Company name cannot exceed 150 characters.';
  }

  const trimmedIndustry = data.industry.trim();
  if (trimmedIndustry.length > 100) {
    errors.industry = 'Industry cannot exceed 100 characters.';
  }

  const trimmedUrl = data.websiteUrl.trim();
  if (trimmedUrl) {
    if (trimmedUrl.length > 512) {
      errors.websiteUrl = 'Website URL cannot exceed 512 characters.';
    } else if (!isValidHttpsUrl(trimmedUrl)) {
      errors.websiteUrl =
        'Website must be a valid secure HTTPS URL (e.g. https://company.com) without credentials.';
    }
  }

  const trimmedSize = data.companySize.trim();
  if (trimmedSize.length > 32) {
    errors.companySize = 'Company size cannot exceed 32 characters.';
  }

  const trimmedBio = data.bio.trim();
  if (trimmedBio.length > 5000) {
    errors.bio = 'Company bio cannot exceed 5000 characters.';
  }

  const validVisibilities: ProfileVisibility[] = ['PUBLIC', 'UNLISTED', 'PRIVATE'];
  if (!validVisibilities.includes(data.visibility)) {
    errors.visibility = 'Invalid visibility option selected.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Normalizes form data for deterministic dirty-state comparison.
 */
export function normalizeBrandFormData(data: BrandFormData): BrandFormData {
  return {
    companyName: data.companyName.trim(),
    industry: data.industry.trim(),
    websiteUrl: data.websiteUrl.trim(),
    companySize: data.companySize.trim(),
    bio: data.bio.trim(),
    visibility: data.visibility,
  };
}

/**
 * Compares current form data with initial form data.
 */
export function isBrandFormDirty(current: BrandFormData, initial: BrandFormData): boolean {
  const normCurrent = normalizeBrandFormData(current);
  const normInitial = normalizeBrandFormData(initial);

  return (
    normCurrent.companyName !== normInitial.companyName ||
    normCurrent.industry !== normInitial.industry ||
    normCurrent.websiteUrl !== normInitial.websiteUrl ||
    normCurrent.companySize !== normInitial.companySize ||
    normCurrent.bio !== normInitial.bio ||
    normCurrent.visibility !== normInitial.visibility
  );
}

/**
 * Prepares the mutation payload for PUT /api/v1/profiles/brand.
 * Strictly excludes client-supplied userId, roles, or ownership fields.
 */
export function prepareUpdateBrandProfilePayload(data: BrandFormData): UpdateBrandProfileInput {
  const payload: UpdateBrandProfileInput = {
    companyName: data.companyName.trim(),
    visibility: data.visibility,
  };

  const trimmedIndustry = data.industry.trim();
  if (trimmedIndustry) {
    payload.industry = trimmedIndustry;
  }

  const trimmedUrl = data.websiteUrl.trim();
  if (trimmedUrl) {
    payload.websiteUrl = trimmedUrl;
  }

  const trimmedSize = data.companySize.trim();
  if (trimmedSize) {
    payload.companySize = trimmedSize;
  }

  const trimmedBio = data.bio.trim();
  if (trimmedBio) {
    payload.bio = trimmedBio;
  }

  return payload;
}

/**
 * Maps server response profile to BrandFormData.
 */
export function mapResponseToFormData(profile: BrandProfileResponse | null): BrandFormData {
  if (!profile) {
    return { ...DEFAULT_BRAND_FORM_DATA };
  }
  return {
    companyName: profile.companyName ?? '',
    industry: profile.industry ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    companySize: profile.companySize ?? '',
    bio: profile.bio ?? '',
    visibility: profile.visibility ?? 'PUBLIC',
  };
}

/**
 * Fetches the authenticated user's aggregated profiles from GET /api/v1/profiles/me
 * and extracts the brand profile.
 */
export async function fetchMeBrandProfile(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BrandProfileResponse | null> {
  const res = await fetchImpl('/api/v1/profiles/me', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let errorDetail = `Failed to load profile (HTTP ${res.status}).`;
    try {
      const prob = await res.json();
      if (prob.detail) errorDetail = prob.detail;
      else if (prob.title) errorDetail = prob.title;
      else if (prob.message) errorDetail = prob.message;
    } catch {
      // non-JSON response body
    }
    throw new Error(errorDetail);
  }

  const data = await res.json();
  return data.brand || null;
}

/**
 * Submits the Brand profile update payload to PUT /api/v1/profiles/brand.
 */
export async function saveBrandProfile(
  token: string,
  payload: UpdateBrandProfileInput,
  fetchImpl: typeof fetch = fetch,
): Promise<BrandProfileResponse> {
  const res = await fetchImpl('/api/v1/profiles/brand', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorDetail = `Failed to save brand profile (HTTP ${res.status}).`;
    try {
      const prob = await res.json();
      if (prob.detail) errorDetail = prob.detail;
      else if (prob.title) errorDetail = prob.title;
      else if (prob.message) errorDetail = prob.message;
    } catch {
      // non-JSON response body
    }
    throw new Error(errorDetail);
  }

  const updated: BrandProfileResponse = await res.json();
  return updated;
}
