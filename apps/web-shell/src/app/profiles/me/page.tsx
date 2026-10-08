'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Badge,
  Button,
  Input,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@creatorconnect/ui';
import {
  User,
  Upload,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Video,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type {
  UpdateCreatorProfileInput,
  UpdateProfessionalProfileInput,
  ProfessionalProfileResponse,
  CreatorProfileResponse,
} from '@creatorconnect/contracts';
import { useAuth } from '../../../providers/auth-provider';

export default function MyProfilePage() {
  const { user, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'creator' | 'professional' | 'media'>('creator');

  // Creator profile state
  const [tagline, setTagline] = useState('Senior Tech & Documentary Video Creator');
  const [creatorBio, setCreatorBio] = useState(
    'Producing high-impact tech reviews, developer storytelling, and 4K visuals.',
  );
  const [creatorCity, setCreatorCity] = useState('Bengaluru');
  const [creatorCountry, setCreatorCountry] = useState('IN');
  const [startingRate, setStartingRate] = useState('50000');
  const [creatorVisibility, setCreatorVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>(
    'PUBLIC',
  );
  const [isRemote, setIsRemote] = useState(true);

  // Professional profile state
  const [headline, setHeadline] = useState('Senior Audio Engineer & Mixing Specialist');
  const [professionalBio, setProfessionalBio] = useState(
    'Specializing in immersive Dolby Atmos sound design, dialogue editing, and cinematic mastering.',
  );
  const [yearsExperience, setYearsExperience] = useState('8');
  const [dayRate, setDayRate] = useState('65000');
  const [currency, setCurrency] = useState('INR');
  const [isAvailable, setIsAvailable] = useState(true);
  const [professionalCity, setProfessionalCity] = useState('Mumbai');
  const [professionalCountry, setProfessionalCountry] = useState('IN');
  const [professionalVisibility, setProfessionalVisibility] = useState<
    'PUBLIC' | 'UNLISTED' | 'PRIVATE'
  >('PUBLIC');
  const [equipmentList, setEquipmentList] = useState(
    'ProTools Ultimate, Genelec 8341A, UAD Apollo x8p',
  );

  // Media upload state
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Profile save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to obtain the active authentication token
  const getAuthToken = (): string | null => {
    if (accessToken) return accessToken;
    if (typeof window !== 'undefined') {
      return (
        (window as any).__TEST_ACCESS_TOKEN__ ||
        localStorage.getItem('creatorconnect_test_access_token') ||
        null
      );
    }
    return null;
  };

  // Load existing profile attributes on user load or tab switch
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !user?.id) return;

    if (activeTab === 'professional') {
      fetch(`/api/v1/profiles/professional/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: ProfessionalProfileResponse | null) => {
          if (data) {
            if (data.headline) setHeadline(data.headline);
            if (data.bio) setProfessionalBio(data.bio);
            if (data.yearsExperience !== null && data.yearsExperience !== undefined)
              setYearsExperience(String(data.yearsExperience));
            if (data.dayRate !== null && data.dayRate !== undefined)
              setDayRate(String(data.dayRate));
            if (data.currency) setCurrency(data.currency);
            if (data.isAvailable !== undefined) setIsAvailable(data.isAvailable);
            if (data.locationCity) setProfessionalCity(data.locationCity);
            if (data.locationCountry) setProfessionalCountry(data.locationCountry);
            if (data.visibility) setProfessionalVisibility(data.visibility);
            if (data.equipmentList && data.equipmentList.length > 0)
              setEquipmentList(data.equipmentList.join(', '));
          }
        })
        .catch(() => {});
    } else if (activeTab === 'creator') {
      fetch(`/api/v1/profiles/creator/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: CreatorProfileResponse | null) => {
          if (data) {
            if (data.tagline) setTagline(data.tagline);
            if (data.bio) setCreatorBio(data.bio);
            if (data.locationCity) setCreatorCity(data.locationCity);
            if (data.locationCountry) setCreatorCountry(data.locationCountry);
            if (data.startingRate !== null && data.startingRate !== undefined)
              setStartingRate(String(data.startingRate));
            if (data.visibility) setCreatorVisibility(data.visibility);
            if (data.isRemote !== undefined) setIsRemote(data.isRemote);
          }
        })
        .catch(() => {});
    }
  }, [user?.id, activeTab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const token = getAuthToken();
    if (!token) {
      setErrorMessage('Authentication required. Please sign in to save your profile.');
      setSaving(false);
      return;
    }

    try {
      let endpoint = '';
      let bodyPayload = '';

      if (activeTab === 'creator') {
        endpoint = '/api/v1/profiles/creator';
        const payload: UpdateCreatorProfileInput = {
          visibility: creatorVisibility,
          isRemote,
        };
        if (tagline.trim()) payload.tagline = tagline.trim();
        if (creatorBio.trim()) payload.bio = creatorBio.trim();
        if (creatorCity.trim()) payload.locationCity = creatorCity.trim();
        if (creatorCountry.trim()) payload.locationCountry = creatorCountry.trim().toUpperCase();
        if (startingRate.trim()) payload.startingRate = parseInt(startingRate, 10);
        bodyPayload = JSON.stringify(payload);
      } else if (activeTab === 'professional') {
        endpoint = '/api/v1/profiles/professional';
        const payload: UpdateProfessionalProfileInput = {
          visibility: professionalVisibility,
          isAvailable,
          currency: (currency as any) || 'INR',
        };
        if (headline.trim()) payload.headline = headline.trim();
        if (professionalBio.trim()) payload.bio = professionalBio.trim();
        if (yearsExperience.trim()) payload.yearsExperience = parseInt(yearsExperience, 10);
        if (dayRate.trim()) payload.dayRate = parseInt(dayRate, 10);
        if (professionalCountry.trim())
          payload.locationCountry = professionalCountry.trim().toUpperCase();
        if (professionalCity.trim()) payload.locationCity = professionalCity.trim();
        if (equipmentList.trim()) {
          payload.equipmentList = equipmentList
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
        bodyPayload = JSON.stringify(payload);
      } else {
        return;
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: bodyPayload,
      });

      if (!res.ok) {
        // Parse RFC7807 problem details
        let parsedDetail = `Failed to update profile (HTTP ${res.status}).`;
        try {
          const problemJson = await res.json();
          if (problemJson.detail) {
            parsedDetail = problemJson.detail;
          } else if (problemJson.title) {
            parsedDetail = problemJson.title;
          } else if (problemJson.message) {
            parsedDetail = problemJson.message;
          }
        } catch {
          // Response body was not JSON
        }
        setErrorMessage(parsedDetail);
        throw new Error(parsedDetail);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      if (!errorMessage) {
        setErrorMessage(err.message || 'Error updating profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getAuthToken();
    if (!token) {
      setUploadError('Authentication required to upload media.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // 1. Request presigned upload URL with Bearer token
      const urlRes = await fetch('/api/v1/media/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || 'image/png',
          byteSize: file.size,
          mediaType: file.type.startsWith('video') ? 'VIDEO' : 'IMAGE',
        }),
      });

      if (!urlRes.ok) {
        let errDetail = 'Failed to generate secure upload credentials.';
        try {
          const prob = await urlRes.json();
          if (prob.detail) errDetail = prob.detail;
        } catch {}
        throw new Error(errDetail);
      }

      const { uploadUrl, assetId } = await urlRes.json();

      // 2. Direct upload to R2/S3
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/png' },
        body: file,
      });

      if (!s3Res.ok) {
        throw new Error('Direct storage upload failed.');
      }

      // 3. Confirm upload byte validation with Bearer token
      const confirmRes = await fetch('/api/v1/media/upload-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assetId }),
      });

      if (!confirmRes.ok) {
        let errDetail = 'Upload byte verification failed.';
        try {
          const prob = await confirmRes.json();
          if (prob.detail) errDetail = prob.detail;
        } catch {}
        throw new Error(errDetail);
      }

      setUploadSuccess(
        `File uploaded successfully! Queued for magic-byte scan and derivative generation (Asset ID: ${assetId.slice(
          0,
          8,
        )}...).`,
      );
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container max-w-5xl px-4 sm:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-border/60 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="default" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span>Identity & Persona Console</span>
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Authenticated Workspace</span>
          </Badge>
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
          Manage Profile & Portfolio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your public persona, professional rate card, verified gear, and secure media
          assets.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as any);
          setErrorMessage(null);
          setSaveSuccess(false);
        }}
        className="space-y-6"
      >
        <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="creator" className="gap-2 rounded-lg text-xs font-semibold">
            <Video className="h-3.5 w-3.5" />
            <span>Creator Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="professional"
            className="gap-2 rounded-lg text-xs font-semibold"
            data-testid="tab-professional"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Professional Profile</span>
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-2 rounded-lg text-xs font-semibold">
            <Upload className="h-3.5 w-3.5" />
            <span>Media & Portfolio</span>
          </TabsTrigger>
        </TabsList>

        {/* Creator Profile Tab */}
        <TabsContent value="creator">
          <Card glass className="p-6">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Channel Headline / Tagline
                </label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Senior Tech & Documentary Video Creator"
                  data-testid="creator-tagline-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Creator Bio</label>
                <Textarea
                  value={creatorBio}
                  onChange={(e) => setCreatorBio(e.target.value)}
                  rows={4}
                  placeholder="Tell brands about your audience demographics, engagement, and production quality..."
                  className="resize-none"
                  data-testid="creator-bio-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">City</label>
                  <Input
                    value={creatorCity}
                    onChange={(e) => setCreatorCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    data-testid="creator-city-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Country Code</label>
                  <Input
                    value={creatorCountry}
                    onChange={(e) => setCreatorCountry(e.target.value)}
                    placeholder="IN"
                    maxLength={2}
                    data-testid="creator-country-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Starting Rate (INR)
                  </label>
                  <Input
                    type="number"
                    value={startingRate}
                    onChange={(e) => setStartingRate(e.target.value)}
                    placeholder="50000"
                    data-testid="creator-starting-rate-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Profile Visibility
                  </label>
                  <select
                    value={creatorVisibility}
                    onChange={(e) => setCreatorVisibility(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="creator-visibility-select"
                  >
                    <option value="PUBLIC">PUBLIC (Visible in Discovery & Search)</option>
                    <option value="UNLISTED">UNLISTED (Accessible via direct link only)</option>
                    <option value="PRIVATE">PRIVATE (Strictly hidden, owner only)</option>
                  </select>
                </div>
              </div>

              {saveSuccess && (
                <div
                  className="p-3 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2"
                  data-testid="profile-save-success"
                  role="status"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Creator profile successfully updated!</span>
                </div>
              )}

              {errorMessage && (
                <div
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2"
                  data-testid="profile-save-error"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={saving}
                className="gap-2 shadow-sm font-semibold"
                data-testid="save-profile-button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Save Changes</span>
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* Professional Profile Tab */}
        <TabsContent value="professional">
          <Card glass className="p-6">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Professional Headline
                </label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Audio Engineer & Mastering Specialist"
                  data-testid="profile-headline-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Professional Bio</label>
                <Textarea
                  value={professionalBio}
                  onChange={(e) => setProfessionalBio(e.target.value)}
                  rows={4}
                  placeholder="Detail your engineering experience, notable clients, mixing styles, and deliverables..."
                  className="resize-none"
                  data-testid="profile-bio-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Years of Experience
                  </label>
                  <Input
                    type="number"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="8"
                    min="0"
                    max="70"
                    data-testid="profile-years-experience-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Day Rate ({currency})
                  </label>
                  <Input
                    type="number"
                    value={dayRate}
                    onChange={(e) => setDayRate(e.target.value)}
                    placeholder="65000"
                    min="0"
                    data-testid="profile-day-rate-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">City</label>
                  <Input
                    value={professionalCity}
                    onChange={(e) => setProfessionalCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    data-testid="profile-city-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Country Code</label>
                  <Input
                    value={professionalCountry}
                    onChange={(e) => setProfessionalCountry(e.target.value)}
                    placeholder="IN"
                    maxLength={2}
                    data-testid="profile-country-input"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Verified Equipment & Gear List
                </label>
                <Input
                  value={equipmentList}
                  onChange={(e) => setEquipmentList(e.target.value)}
                  placeholder="e.g. ProTools Ultimate, Genelec 8341A, UAD Apollo x8p"
                  data-testid="profile-equipment-input"
                />
                <p className="text-[11px] text-muted-foreground">
                  Comma-separated list of hardware, studio monitors, cameras, or software packages.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Profile Visibility</label>
                <select
                  value={professionalVisibility}
                  onChange={(e) => setProfessionalVisibility(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="profile-visibility-select"
                >
                  <option value="PUBLIC">PUBLIC (Visible in Discovery & Directory)</option>
                  <option value="UNLISTED">UNLISTED (Accessible via direct link only)</option>
                  <option value="PRIVATE">PRIVATE (Strictly hidden, owner only)</option>
                </select>
              </div>

              {saveSuccess && (
                <div
                  className="p-3 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2"
                  data-testid="profile-save-success"
                  role="status"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Professional profile successfully updated!</span>
                </div>
              )}

              {errorMessage && (
                <div
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2"
                  data-testid="profile-save-error"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={saving}
                className="gap-2 shadow-sm font-semibold"
                data-testid="save-profile-button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Save Changes</span>
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* Media Upload Tab */}
        <TabsContent value="media">
          <Card glass className="p-6 space-y-6">
            <div>
              <h3 className="font-heading font-bold text-lg">Secure Media Asset Uploader</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload image, video, and PDF portfolio samples. Files pass through server
                quarantine, SHA byte-validation, magic-byte inspection, and WebP thumbnail
                generation.
              </p>
            </div>

            <div className="border-2 border-dashed border-border/80 rounded-xl p-8 text-center space-y-3 bg-muted/20 hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
              <div>
                <label className="cursor-pointer">
                  <span className="font-bold text-primary hover:underline text-sm">
                    Click to select file
                  </span>
                  <span className="text-xs text-muted-foreground"> or drag and drop</span>
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                PNG, JPEG, WebP, MP4, WebM, or PDF up to 50MB
              </p>
            </div>

            {uploading && (
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Uploading and verifying with R2/S3 storage...</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
