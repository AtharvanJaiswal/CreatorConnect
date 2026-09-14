'use client';

import React, { useState } from 'react';
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
import { User, Upload, CheckCircle2, AlertCircle, Briefcase, Video, Loader2 } from 'lucide-react';

export default function MyProfilePage() {
  const [activeTab, setActiveTab] = useState('creator');
  const [tagline, setTagline] = useState('Senior Tech & Documentary Video Creator');
  const [bio, setBio] = useState(
    'Producing high-impact tech reviews, developer storytelling, and 4K visuals.',
  );
  const [city, setCity] = useState('Bengaluru');
  const [country, setCountry] = useState('IN');
  const [startingRate, setStartingRate] = useState('50000');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PUBLIC');

  // Media upload state
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Profile save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const endpoint =
        activeTab === 'creator' ? '/api/v1/profiles/creator' : '/api/v1/profiles/professional';

      const payload = {
        tagline,
        bio,
        locationCity: city,
        locationCountry: country,
        startingRate: startingRate ? parseInt(startingRate, 10) : undefined,
        visibility,
      };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to update profile.');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // 1. Request presigned upload URL
      const urlRes = await fetch('/api/v1/media/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || 'image/png',
          byteSize: file.size,
          mediaType: file.type.startsWith('video') ? 'VIDEO' : 'IMAGE',
        }),
      });

      if (!urlRes.ok) {
        throw new Error('Failed to generate secure upload credentials.');
      }

      const { uploadUrl, assetId } = await urlRes.json();

      // 2. Direct upload to R2/S3
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/png' },
        body: file,
      });

      if (!s3Res.ok) {
        throw new Error('Direct file upload failed.');
      }

      // 3. Confirm upload byte validation
      const confirmRes = await fetch('/api/v1/media/upload-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      });

      if (!confirmRes.ok) {
        throw new Error('Upload byte verification failed.');
      }

      setUploadSuccess(
        `File uploaded successfully! Queued for magic-byte scan and derivative generation (Asset ID: ${assetId.slice(0, 8)}...).`,
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
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
          Manage Profile & Portfolio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your public persona, skills proficiency, verified rate card, and secure media
          assets.
        </p>
      </div>

      <Tabs defaultValue="creator" onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="creator" className="gap-2 rounded-lg text-xs font-semibold">
            <Video className="h-3.5 w-3.5" />
            <span>Creator Profile</span>
          </TabsTrigger>
          <TabsTrigger value="professional" className="gap-2 rounded-lg text-xs font-semibold">
            <Briefcase className="h-3.5 w-3.5" />
            <span>Professional Profile</span>
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-2 rounded-lg text-xs font-semibold">
            <Upload className="h-3.5 w-3.5" />
            <span>Media & Portfolio</span>
          </TabsTrigger>
        </TabsList>

        {/* Creator / Professional Profile Tab */}
        {(activeTab === 'creator' || activeTab === 'professional') && (
          <TabsContent value={activeTab}>
            <Card glass className="p-6">
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Headline / Tagline
                  </label>
                  <Input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Award-winning Colorist & Cinematographer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Professional Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    placeholder="Tell brands and creators about your specialties..."
                    className="resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">City</label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Country Code</label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="IN"
                      maxLength={2}
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
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Profile Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="PUBLIC">PUBLIC (Visible in Discovery & Google FTS)</option>
                      <option value="UNLISTED">UNLISTED (Accessible via direct link only)</option>
                      <option value="PRIVATE">PRIVATE (Strictly hidden, owner only)</option>
                    </select>
                  </div>
                </div>

                {saveSuccess && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Profile successfully updated!</span>
                  </div>
                )}

                <Button type="submit" disabled={saving} className="gap-2 shadow-sm font-semibold">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Save Changes</span>
                </Button>
              </form>
            </Card>
          </TabsContent>
        )}

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
