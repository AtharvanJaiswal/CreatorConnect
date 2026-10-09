import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_BRAND_FORM_DATA,
  validateBrandProfile,
  isValidHttpsUrl,
  isBrandFormDirty,
  normalizeBrandFormData,
  prepareUpdateBrandProfilePayload,
  mapResponseToFormData,
  fetchMeBrandProfile,
  saveBrandProfile,
  type BrandFormData,
} from './brand-profile-service.js';
import type { BrandProfileResponse } from '@creatorconnect/contracts';

describe('Brand Profile Service & Validation Layer', () => {
  describe('Form Defaults & Initialization', () => {
    it('provides valid default initial form values', () => {
      expect(DEFAULT_BRAND_FORM_DATA.companyName).toBe('');
      expect(DEFAULT_BRAND_FORM_DATA.industry).toBe('');
      expect(DEFAULT_BRAND_FORM_DATA.websiteUrl).toBe('');
      expect(DEFAULT_BRAND_FORM_DATA.companySize).toBe('');
      expect(DEFAULT_BRAND_FORM_DATA.bio).toBe('');
      expect(DEFAULT_BRAND_FORM_DATA.visibility).toBe('PUBLIC');
    });

    it('populates form fields correctly from server response', () => {
      const mockProfile: BrandProfileResponse = {
        id: '01a11f04-95da-7d5b-9c89-047387056ea2',
        userId: '01a11f04-9540-786b-aeeb-8fbcf8e406e2',
        companyName: 'Acme Media Labs',
        industry: 'Audio Production',
        websiteUrl: 'https://acmemedia.example.com',
        companySize: '51-200',
        bio: 'Premier audio content production agency.',
        isVerified: true,
        visibility: 'UNLISTED',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };

      const mapped = mapResponseToFormData(mockProfile);
      expect(mapped.companyName).toBe('Acme Media Labs');
      expect(mapped.industry).toBe('Audio Production');
      expect(mapped.websiteUrl).toBe('https://acmemedia.example.com');
      expect(mapped.companySize).toBe('51-200');
      expect(mapped.bio).toBe('Premier audio content production agency.');
      expect(mapped.visibility).toBe('UNLISTED');
    });

    it('returns default empty values when server profile is null', () => {
      const mapped = mapResponseToFormData(null);
      expect(mapped).toEqual(DEFAULT_BRAND_FORM_DATA);
    });
  });

  describe('Contractual Field Validation', () => {
    it('requires companyName to be non-empty', () => {
      const res = validateBrandProfile({
        ...DEFAULT_BRAND_FORM_DATA,
        companyName: '   ',
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.companyName).toBe('Company name is required.');
    });

    it('enforces maximum 150 characters on companyName', () => {
      const longName = 'A'.repeat(151);
      const res = validateBrandProfile({
        ...DEFAULT_BRAND_FORM_DATA,
        companyName: longName,
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.companyName).toBe('Company name cannot exceed 150 characters.');
    });

    it('enforces maximum 100 characters on industry', () => {
      const res = validateBrandProfile({
        ...DEFAULT_BRAND_FORM_DATA,
        companyName: 'Valid Brand',
        industry: 'I'.repeat(101),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.industry).toBe('Industry cannot exceed 100 characters.');
    });

    it('validates strict HTTPS URL policy', () => {
      // Valid HTTPS URLs
      expect(isValidHttpsUrl('https://example.com')).toBe(true);
      expect(isValidHttpsUrl('https://sub.domain.co.in/path?q=1')).toBe(true);
      expect(isValidHttpsUrl('')).toBe(true);

      // Insecure or invalid URLs
      expect(isValidHttpsUrl('http://insecure.example.com')).toBe(false);
      expect(isValidHttpsUrl('ftp://example.com')).toBe(false);
      expect(isValidHttpsUrl('not-a-url')).toBe(false);
      expect(isValidHttpsUrl('https://user:pass@example.com')).toBe(false); // credentials forbidden
      expect(isValidHttpsUrl('https://' + 'a'.repeat(510) + '.com')).toBe(false); // exceeds 512 chars

      const validationRes = validateBrandProfile({
        ...DEFAULT_BRAND_FORM_DATA,
        companyName: 'Valid Brand',
        websiteUrl: 'http://plain-http.com',
      });
      expect(validationRes.isValid).toBe(false);
      expect(validationRes.errors.websiteUrl).toContain('valid secure HTTPS URL');
    });

    it('enforces maximum 32 characters on companySize', () => {
      const res = validateBrandProfile({
        ...DEFAULT_BRAND_FORM_DATA,
        companyName: 'Valid Brand',
        companySize: 'S'.repeat(33),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.companySize).toBe('Company size cannot exceed 32 characters.');
    });

    it('enforces maximum 5000 characters on bio', () => {
      const res = validateBrandProfile({
        ...DEFAULT_BRAND_FORM_DATA,
        companyName: 'Valid Brand',
        bio: 'B'.repeat(5001),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.bio).toBe('Company bio cannot exceed 5000 characters.');
    });

    it('approves fully populated valid brand profile', () => {
      const res = validateBrandProfile({
        companyName: 'CreatorConnect Labs',
        industry: 'Creator Economy Software',
        websiteUrl: 'https://creatorconnect.test',
        companySize: '51-200',
        bio: 'Building world-class sponsorship tooling for creators and brands.',
        visibility: 'PUBLIC',
      });
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });
  });

  describe('Dirty State & Normalization', () => {
    it('considers identical states as not dirty', () => {
      const current: BrandFormData = {
        companyName: 'Apex Dynamics',
        industry: 'Tech',
        websiteUrl: 'https://apexdynamics.test',
        companySize: '11-50',
        bio: 'Short bio',
        visibility: 'PUBLIC',
      };
      const initial = { ...current };

      expect(isBrandFormDirty(current, initial)).toBe(false);
    });

    it('normalizes form data by trimming all string fields', () => {
      const raw: BrandFormData = {
        companyName: '  Apex Dynamics  ',
        industry: '  Tech  ',
        websiteUrl: '  https://apexdynamics.test  ',
        companySize: '  11-50  ',
        bio: '  Short bio  ',
        visibility: 'PUBLIC',
      };
      const normalized = normalizeBrandFormData(raw);
      expect(normalized).toEqual({
        companyName: 'Apex Dynamics',
        industry: 'Tech',
        websiteUrl: 'https://apexdynamics.test',
        companySize: '11-50',
        bio: 'Short bio',
        visibility: 'PUBLIC',
      });
    });

    it('ignores leading/trailing whitespace variations during dirty evaluation', () => {
      const initial: BrandFormData = {
        companyName: 'Apex Dynamics',
        industry: 'Tech',
        websiteUrl: 'https://apexdynamics.test',
        companySize: '11-50',
        bio: 'Short bio',
        visibility: 'PUBLIC',
      };
      const current: BrandFormData = {
        companyName: '  Apex Dynamics  ',
        industry: 'Tech ',
        websiteUrl: ' https://apexdynamics.test',
        companySize: '11-50',
        bio: 'Short bio ',
        visibility: 'PUBLIC',
      };

      expect(isBrandFormDirty(current, initial)).toBe(false);
    });

    it('detects genuine field modifications as dirty', () => {
      const initial: BrandFormData = {
        companyName: 'Apex Dynamics',
        industry: 'Tech',
        websiteUrl: 'https://apexdynamics.test',
        companySize: '11-50',
        bio: 'Short bio',
        visibility: 'PUBLIC',
      };

      expect(isBrandFormDirty({ ...initial, companyName: 'Apex Corp' }, initial)).toBe(true);
      expect(isBrandFormDirty({ ...initial, visibility: 'PRIVATE' }, initial)).toBe(true);
      expect(isBrandFormDirty({ ...initial, websiteUrl: '' }, initial)).toBe(true);
    });
  });

  describe('Payload Preparation (Ownership Protection)', () => {
    it('prepares payload adhering strictly to UpdateBrandProfileInput without ownership fields', () => {
      const form: BrandFormData = {
        companyName: '  Starlight Media  ',
        industry: '  Entertainment  ',
        websiteUrl: '  https://starlight.media  ',
        companySize: '  201-500  ',
        bio: '  Global agency.  ',
        visibility: 'UNLISTED',
      };

      const payload = prepareUpdateBrandProfilePayload(form);

      expect(payload).toEqual({
        companyName: 'Starlight Media',
        industry: 'Entertainment',
        websiteUrl: 'https://starlight.media',
        companySize: '201-500',
        bio: 'Global agency.',
        visibility: 'UNLISTED',
      });

      // Confirm no unauthorized ownership fields injected
      expect((payload as any).userId).toBeUndefined();
      expect((payload as any).roles).toBeUndefined();
      expect((payload as any).id).toBeUndefined();
    });

    it('omits optional empty strings from mutation payload', () => {
      const form: BrandFormData = {
        companyName: 'Minimal Brand Inc',
        industry: '   ',
        websiteUrl: '',
        companySize: '',
        bio: '   ',
        visibility: 'PUBLIC',
      };

      const payload = prepareUpdateBrandProfilePayload(form);

      expect(payload).toEqual({
        companyName: 'Minimal Brand Inc',
        visibility: 'PUBLIC',
      });
      expect(payload.industry).toBeUndefined();
      expect(payload.websiteUrl).toBeUndefined();
      expect(payload.companySize).toBeUndefined();
      expect(payload.bio).toBeUndefined();
    });
  });

  describe('API Transport & Error Handling', () => {
    it('fetchMeBrandProfile returns brand profile on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          brand: {
            id: 'uuid-1',
            userId: 'user-1',
            companyName: 'Test Brand',
            industry: 'SaaS',
            websiteUrl: 'https://test.com',
            companySize: '1-10',
            bio: 'Test bio',
            isVerified: false,
            visibility: 'PUBLIC',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      });

      const profile = await fetchMeBrandProfile('test-jwt-token', mockFetch as any);
      expect(profile).not.toBeNull();
      expect(profile?.companyName).toBe('Test Brand');
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/profiles/me', {
        headers: {
          Authorization: 'Bearer test-jwt-token',
          Accept: 'application/json',
        },
      });
    });

    it('fetchMeBrandProfile throws descriptive message on HTTP error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Authentication token expired.' }),
      });

      await expect(fetchMeBrandProfile('bad-token', mockFetch as any)).rejects.toThrow(
        'Authentication token expired.',
      );
    });

    it('saveBrandProfile sends PUT request and returns updated response', async () => {
      const mockResponse: BrandProfileResponse = {
        id: 'uuid-123',
        userId: 'user-456',
        companyName: 'Persisted Brand',
        industry: 'Fintech',
        websiteUrl: 'https://fintech.example.com',
        companySize: '51-200',
        bio: 'Secure banking.',
        isVerified: true,
        visibility: 'PUBLIC',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const payload = {
        companyName: 'Persisted Brand',
        industry: 'Fintech',
        websiteUrl: 'https://fintech.example.com',
        companySize: '51-200',
        bio: 'Secure banking.',
        visibility: 'PUBLIC' as const,
      };

      const saved = await saveBrandProfile('valid-token', payload, mockFetch as any);
      expect(saved.companyName).toBe('Persisted Brand');
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/profiles/brand', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    });

    it('saveBrandProfile parses RFC7807 problem details on failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          type: 'https://api.creatorconnect.com/errors/insufficient-role',
          title: 'Insufficient Permissions',
          detail: 'User does not have BRAND role.',
          status: 403,
        }),
      });

      await expect(
        saveBrandProfile('valid-token', { companyName: 'Disallowed' }, mockFetch as any),
      ).rejects.toThrow('User does not have BRAND role.');
    });
  });
});
