'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input, Textarea, Badge } from '@creatorconnect/ui';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Globe,
  Briefcase,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../providers/auth-provider';
import {
  DEFAULT_BRAND_FORM_DATA,
  COMPANY_SIZE_OPTIONS,
  validateBrandProfile,
  isBrandFormDirty,
  prepareUpdateBrandProfilePayload,
  mapResponseToFormData,
  fetchMeBrandProfile,
  saveBrandProfile,
  type BrandFormData,
  type BrandFormStatus,
} from '../lib/brand-profile-service';

interface BrandProfileFormProps {
  onSaved?: () => void;
}

export function BrandProfileForm({ onSaved }: BrandProfileFormProps) {
  const { user, accessToken, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<BrandFormStatus>('IDLE');
  const [initialValues, setInitialValues] = useState<BrandFormData>(DEFAULT_BRAND_FORM_DATA);
  const [currentValues, setCurrentValues] = useState<BrandFormData>(DEFAULT_BRAND_FORM_DATA);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedUserId, setLastSavedUserId] = useState<string | null>(null);

  // Helper to obtain active token (supports test token injection)
  const getAuthToken = useCallback((): string | null => {
    if (accessToken) return accessToken;
    if (typeof window !== 'undefined') {
      return (
        (window as any).__TEST_ACCESS_TOKEN__ ||
        localStorage.getItem('creatorconnect_test_access_token') ||
        null
      );
    }
    return null;
  }, [accessToken]);

  // Determine authorization based on authenticated user roles
  const hasBrandRole = useMemo(() => {
    return Boolean(user?.roles?.includes('BRAND'));
  }, [user?.roles]);

  // Client validation
  const validation = useMemo(() => {
    return validateBrandProfile(currentValues);
  }, [currentValues]);

  // Dirty state calculation
  const isDirty = useMemo(() => {
    return isBrandFormDirty(currentValues, initialValues);
  }, [currentValues, initialValues]);

  // Save eligibility
  const canSave = useMemo(() => {
    return hasBrandRole && validation.isValid && isDirty && status !== 'SAVING';
  }, [hasBrandRole, validation.isValid, isDirty, status]);

  // Initial data loading & user session switching
  const loadProfile = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !user?.id) return;

    if (!hasBrandRole) {
      setStatus('READY');
      return;
    }

    setStatus('LOADING');
    setErrorMessage(null);

    try {
      const profile = await fetchMeBrandProfile(token);
      const mapped = mapResponseToFormData(profile);
      setInitialValues(mapped);
      setCurrentValues(mapped);
      setLastSavedUserId(user.id);
      setStatus('READY');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load brand profile. Please retry.');
      setStatus('ERROR');
    }
  }, [getAuthToken, user?.id, hasBrandRole]);

  useEffect(() => {
    if (authLoading) return;

    // Reset when switching authenticated accounts to prevent stale session bleed
    if (user?.id && user.id !== lastSavedUserId) {
      setInitialValues(DEFAULT_BRAND_FORM_DATA);
      setCurrentValues(DEFAULT_BRAND_FORM_DATA);
      loadProfile();
    } else if (!user) {
      setStatus('IDLE');
      setInitialValues(DEFAULT_BRAND_FORM_DATA);
      setCurrentValues(DEFAULT_BRAND_FORM_DATA);
      setLastSavedUserId(null);
    }
  }, [authLoading, user?.id, lastSavedUserId, loadProfile, user]);

  // Warn on unsaved changes when navigating away
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Handle field change
  const handleChange = (field: keyof BrandFormData, value: string) => {
    setCurrentValues((prev) => {
      const updated = { ...prev, [field]: value };
      return updated;
    });

    if (status === 'SAVED' || status === 'ERROR' || status === 'READY') {
      setStatus('DIRTY');
    }
  };

  // Handle save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSave || status === 'SAVING') {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setErrorMessage('Authentication session expired. Please sign in again.');
      setStatus('ERROR');
      return;
    }

    setStatus('SAVING');
    setErrorMessage(null);

    try {
      const payload = prepareUpdateBrandProfilePayload(currentValues);
      const canonical = await saveBrandProfile(token, payload);
      const canonicalForm = mapResponseToFormData(canonical);

      setInitialValues(canonicalForm);
      setCurrentValues(canonicalForm);
      setStatus('SAVED');

      if (onSaved) {
        onSaved();
      }
    } catch (err: any) {
      // Preserve current user inputs on failure
      setErrorMessage(err.message || 'Failed to update brand profile. Please try again.');
      setStatus('ERROR');
    }
  };

  // If user lacks BRAND role: show role gate explanatory card
  if (!authLoading && user && !hasBrandRole) {
    return (
      <Card glass className="p-8 text-center space-y-4" data-testid="brand-profile-role-gate">
        <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-heading font-bold text-lg">Brand Role Required</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your current authenticated account ({user.email}) does not have the{' '}
            <strong>BRAND</strong> role assigned. Customer brand profile editing is restricted to
            verified brand representatives.
          </p>
        </div>
        <div className="pt-2 text-xs text-muted-foreground">
          Assigned roles: <span className="font-mono">{user.roles.join(', ') || 'NONE'}</span>
        </div>
      </Card>
    );
  }

  // Loading skeleton
  if (status === 'LOADING' || authLoading) {
    return (
      <Card glass className="p-8 text-center space-y-4" data-testid="brand-profile-loading">
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Loading brand organization profile...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card glass className="p-6">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-bold text-lg">Brand & Customer Profile</h2>
            {isDirty && (
              <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
                Unsaved changes
              </Badge>
            )}
            {status === 'SAVED' && (
              <Badge variant="success" className="text-[10px]">
                Up to date
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Configure your enterprise brand details, public website, company size, and sponsorship
            overview.
          </p>
        </div>
        <Badge variant="outline" className="gap-1 border-primary/30 text-primary hidden sm:flex">
          <Building2 className="h-3.5 w-3.5" />
          <span>Enterprise Verified</span>
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>Company / Brand Name</span>
              <span className="text-destructive font-bold">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground font-mono">
              {currentValues.companyName.length}/150
            </span>
          </div>
          <Input
            name="companyName"
            value={currentValues.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
            placeholder="e.g. Apex Dynamics Media Global"
            maxLength={150}
            error={Boolean(validation.errors.companyName)}
            data-testid="brand-company-name-input"
            disabled={status === 'SAVING'}
            required
          />
          {validation.errors.companyName && (
            <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3 inline" />
              <span>{validation.errors.companyName}</span>
            </p>
          )}
        </div>

        {/* Industry & Company Size */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3 text-muted-foreground" />
                <span>Industry</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {currentValues.industry.length}/100
              </span>
            </div>
            <Input
              name="industry"
              value={currentValues.industry}
              onChange={(e) => handleChange('industry', e.target.value)}
              placeholder="e.g. Consumer Technology & SaaS"
              maxLength={100}
              error={Boolean(validation.errors.industry)}
              data-testid="brand-industry-input"
              disabled={status === 'SAVING'}
            />
            {validation.errors.industry && (
              <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 inline" />
                <span>{validation.errors.industry}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span>Company Size</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {currentValues.companySize.length}/32
              </span>
            </div>
            <select
              name="companySize"
              value={currentValues.companySize}
              onChange={(e) => handleChange('companySize', e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="brand-company-size-select"
              disabled={status === 'SAVING'}
            >
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {/* Support existing arbitrary server values <= 32 chars not in presets */}
              {currentValues.companySize &&
                !COMPANY_SIZE_OPTIONS.some((o) => o.value === currentValues.companySize) && (
                  <option value={currentValues.companySize}>{currentValues.companySize}</option>
                )}
            </select>
            {validation.errors.companySize && (
              <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 inline" />
                <span>{validation.errors.companySize}</span>
              </p>
            )}
          </div>
        </div>

        {/* Website URL */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span>Official Website URL</span>
            </label>
            <span className="text-[11px] text-muted-foreground font-mono">
              {currentValues.websiteUrl.length}/512
            </span>
          </div>
          <Input
            name="websiteUrl"
            type="url"
            value={currentValues.websiteUrl}
            onChange={(e) => handleChange('websiteUrl', e.target.value)}
            placeholder="https://company.example.com"
            maxLength={512}
            error={Boolean(validation.errors.websiteUrl)}
            data-testid="brand-website-url-input"
            disabled={status === 'SAVING'}
          />
          <p className="text-[11px] text-muted-foreground">
            Must use a secure HTTPS protocol (e.g.{' '}
            <code className="text-primary font-mono text-[10px]">https://company.com</code>).
          </p>
          {validation.errors.websiteUrl && (
            <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3 inline" />
              <span>{validation.errors.websiteUrl}</span>
            </p>
          )}
        </div>

        {/* Brand Bio */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Brand Mission & Overview
            </label>
            <span className="text-[11px] text-muted-foreground font-mono">
              {currentValues.bio.length}/5000
            </span>
          </div>
          <Textarea
            name="bio"
            value={currentValues.bio}
            onChange={(e) => handleChange('bio', e.target.value)}
            rows={4}
            placeholder="Describe your organization's sponsorship focus, creator partnership criteria, and mission..."
            className="resize-none"
            maxLength={5000}
            error={Boolean(validation.errors.bio)}
            data-testid="brand-bio-input"
            disabled={status === 'SAVING'}
          />
          {validation.errors.bio && (
            <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3 inline" />
              <span>{validation.errors.bio}</span>
            </p>
          )}
        </div>

        {/* Profile Visibility */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Profile Visibility</label>
          <select
            name="visibility"
            value={currentValues.visibility}
            onChange={(e) => handleChange('visibility', e.target.value as any)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="brand-visibility-select"
            disabled={status === 'SAVING'}
          >
            <option value="PUBLIC">PUBLIC (Visible in Discovery & Search)</option>
            <option value="UNLISTED">UNLISTED (Accessible via direct link only)</option>
            <option value="PRIVATE">PRIVATE (Strictly hidden, organization owner only)</option>
          </select>
        </div>

        {/* Feedback states */}
        {status === 'SAVED' && (
          <div
            className="p-3.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2"
            data-testid="brand-profile-save-success"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Brand profile successfully updated and synchronized!</span>
          </div>
        )}

        {errorMessage && (
          <div
            className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center justify-between gap-3"
            data-testid="brand-profile-save-error"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={status === 'ERROR' && !isDirty ? loadProfile : (e) => handleSubmit(e as any)}
              className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10"
              data-testid="retry-save-brand-profile-button"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Action button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={!canSave}
            className="gap-2 shadow-sm font-semibold"
            data-testid="save-brand-profile-button"
          >
            {status === 'SAVING' && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{status === 'SAVING' ? 'Saving Profile...' : 'Save Changes'}</span>
          </Button>

          {isDirty && (
            <Button
              type="button"
              variant="outline"
              disabled={status === 'SAVING'}
              onClick={() => {
                setCurrentValues(initialValues);
                setStatus('READY');
                setErrorMessage(null);
              }}
              className="text-xs"
            >
              Discard Changes
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
