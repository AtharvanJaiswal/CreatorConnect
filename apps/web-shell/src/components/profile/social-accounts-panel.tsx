'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Badge,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@creatorconnect/ui';
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Lock,
  ArrowRight,
  ArrowLeft,
  X,
  HelpCircle,
  Loader2,
  Share2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export interface SocialAccountItem {
  id: string;
  platform: 'INSTAGRAM' | 'YOUTUBE' | 'SPOTIFY' | 'LINKEDIN' | 'VIMEO' | 'X';
  name: string;
  categoryTag: string;
  status: 'CONNECTED' | 'VERIFIED' | 'NOT_CONNECTED' | 'ERROR';
  handle?: string | undefined;
  url?: string | undefined;
  displayName?: string | undefined;
  accountType?: string | undefined;
  reach?: string | undefined;
  lastSync?: string | undefined;
  errorMessage?: string | undefined;
}

const DEFAULT_PLATFORMS: SocialAccountItem[] = [
  {
    id: 'instagram',
    platform: 'INSTAGRAM',
    name: 'Instagram',
    categoryTag: 'Visual & Short-Form Reels',
    status: 'CONNECTED',
    handle: '@aanyarao.studio',
    url: 'https://instagram.com/aanyarao.studio',
    displayName: 'Aanya Rao | Visual Storyteller',
    accountType: 'Professional / Creator Account',
    reach: '48,200 Public Followers',
    lastSync: 'Today at 02:45 PM IST',
  },
  {
    id: 'youtube',
    platform: 'YOUTUBE',
    name: 'YouTube Channel',
    categoryTag: 'Long-form & Shorts Video',
    status: 'VERIFIED',
    handle: '@aanyaraofilms',
    url: 'https://youtube.com/@aanyaraofilms',
    displayName: 'Aanya Rao Films',
    accountType: 'Verified YouTube Partner',
    reach: '124,000 Subscribers',
    lastSync: 'Today at 01:15 PM IST',
  },
  {
    id: 'spotify',
    platform: 'SPOTIFY',
    name: 'Spotify for Podcasters',
    categoryTag: 'Audio Show Catalog',
    status: 'NOT_CONNECTED',
  },
  {
    id: 'linkedin',
    platform: 'LINKEDIN',
    name: 'LinkedIn Professional',
    categoryTag: 'Industry Credentials & Production Credits',
    status: 'NOT_CONNECTED',
  },
  {
    id: 'vimeo',
    platform: 'VIMEO',
    name: 'Vimeo Pro / Showcase',
    categoryTag: 'High-Bitrate Showreels & 4K Stills',
    status: 'ERROR',
    handle: 'vimeo.com/aanyarao',
    url: 'https://vimeo.com/aanyarao',
    errorMessage: 'OAuth Token Expired — Please re-authenticate',
  },
  {
    id: 'x',
    platform: 'X',
    name: 'X (formerly Twitter)',
    categoryTag: 'Public Commentary & Thought Leadership',
    status: 'NOT_CONNECTED',
  },
];

interface SocialAccountsPanelProps {
  initialSocialLinks?: Array<{ platform: string; url: string }> | null;
  onSaveLinks?: (links: Array<{ platform: string; url: string }>) => Promise<void>;
  onNavigateNext?: () => void;
  onNavigateBack?: () => void;
}

export function SocialAccountsPanel({
  initialSocialLinks,
  onSaveLinks,
  onNavigateNext,
  onNavigateBack,
}: SocialAccountsPanelProps) {
  // State simulation toolbar (C08 / C10 / C11 states)
  const [simulatorState, setSimulatorState] = useState<
    'default' | 'all-disconnected' | 'connection-error' | 'empty' | 'disconnect-modal'
  >('default');

  // Active view: 'list' (C08), 'handoff' (C09), 'detail' (C10), 'error' (C11)
  const [currentView, setCurrentView] = useState<'list' | 'handoff' | 'detail' | 'error'>('list');

  // Currently focused platform item
  const [selectedPlatform, setSelectedPlatform] = useState<SocialAccountItem>(
    DEFAULT_PLATFORMS[0]!,
  );

  // Accounts state
  const [accounts, setAccounts] = useState<SocialAccountItem[]>(() => {
    if (initialSocialLinks && initialSocialLinks.length > 0) {
      return DEFAULT_PLATFORMS.map((p) => {
        const found = initialSocialLinks.find(
          (l) => l.platform.toUpperCase() === p.platform.toUpperCase(),
        );
        if (found) {
          return {
            ...p,
            status: 'CONNECTED',
            url: found.url,
            handle: found.url.split('/').filter(Boolean).pop() || p.handle || '@connected',
          };
        }
        return p;
      });
    }
    return DEFAULT_PLATFORMS;
  });

  // Handoff & connection state (C09)
  const [handoffStep, setHandoffStep] = useState<'connecting' | 'alternative' | 'success'>(
    'connecting',
  );
  const [manualHandleInput, setManualHandleInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Disconnect modal (DLG-15)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);

  // Error simulation subtype for C11
  const [errorSubtype, setErrorSubtype] = useState<
    'cancelled' | 'session-expired' | 'rate-limited' | 'network' | 'retrying' | 'repeated'
  >('cancelled');

  // Why connect popover
  const [showWhyConnect, setShowWhyConnect] = useState(false);

  // Update simulator state
  useEffect(() => {
    if (simulatorState === 'all-disconnected') {
      setAccounts(
        DEFAULT_PLATFORMS.map((p) => ({
          ...p,
          status: 'NOT_CONNECTED',
          handle: undefined,
          url: undefined,
        })),
      );
      setCurrentView('list');
    } else if (simulatorState === 'connection-error') {
      setSelectedPlatform(DEFAULT_PLATFORMS[0]!);
      setErrorSubtype('cancelled');
      setCurrentView('error');
    } else if (simulatorState === 'empty') {
      setAccounts([]);
      setCurrentView('list');
    } else if (simulatorState === 'disconnect-modal') {
      setSelectedPlatform(DEFAULT_PLATFORMS[0]!);
      setIsDisconnectOpen(true);
      setCurrentView('list');
    } else {
      setAccounts(DEFAULT_PLATFORMS);
      setCurrentView('list');
    }
  }, [simulatorState]);

  // Handle initiate connect (C09)
  const handleInitiateConnect = (item: SocialAccountItem) => {
    setSelectedPlatform(item);
    setManualHandleInput(item.handle || '');
    setHandoffStep('connecting');
    setCurrentView('handoff');

    // Simulate transition from OAuth initiating to alternative / completion
    setTimeout(() => {
      setHandoffStep('alternative');
    }, 1200);
  };

  // Confirm manual or alternative connect
  const handleConfirmConnect = async () => {
    if (!manualHandleInput.trim()) return;
    setIsSaving(true);

    const cleanHandle = manualHandleInput.trim().replace(/^@/, '');
    const cleanUrl =
      selectedPlatform.platform === 'YOUTUBE'
        ? `https://youtube.com/@${cleanHandle}`
        : selectedPlatform.platform === 'INSTAGRAM'
          ? `https://instagram.com/${cleanHandle}`
          : selectedPlatform.platform === 'SPOTIFY'
            ? `https://open.spotify.com/show/${cleanHandle}`
            : selectedPlatform.platform === 'LINKEDIN'
              ? `https://linkedin.com/in/${cleanHandle}`
              : selectedPlatform.platform === 'VIMEO'
                ? `https://vimeo.com/${cleanHandle}`
                : `https://x.com/${cleanHandle}`;

    const updated = accounts.map((p) => {
      if (p.id === selectedPlatform.id) {
        return {
          ...p,
          status: 'CONNECTED' as const,
          handle: `@${cleanHandle}`,
          url: cleanUrl,
          displayName: `${cleanHandle} (Verified Channel)`,
          accountType: 'Public Linked Profile',
          lastSync: 'Just now',
          errorMessage: undefined,
        };
      }
      return p;
    });

    setAccounts(updated);

    if (onSaveLinks) {
      try {
        const payload = updated
          .filter((p) => p.status === 'CONNECTED' || p.status === 'VERIFIED')
          .map((p) => ({
            platform: p.platform,
            url: p.url || `https://${p.platform.toLowerCase()}.com`,
          }));
        await onSaveLinks(payload);
      } catch {
        // Handled upstream
      }
    }

    setIsSaving(false);
    setHandoffStep('success');
    setTimeout(() => {
      setCurrentView('list');
      setActionSuccess(`Successfully connected ${selectedPlatform.name}!`);
      setTimeout(() => setActionSuccess(null), 4000);
    }, 1500);
  };

  // Handle open details (C10)
  const handleOpenDetail = (item: SocialAccountItem) => {
    setSelectedPlatform(item);
    setCurrentView('detail');
  };

  // Handle disconnect (DLG-15)
  const handleConfirmDisconnect = async () => {
    setIsSaving(true);
    const updated = accounts.map((p) => {
      if (p.id === selectedPlatform.id) {
        return {
          ...p,
          status: 'NOT_CONNECTED' as const,
          handle: undefined,
          url: undefined,
          displayName: undefined,
          lastSync: undefined,
        };
      }
      return p;
    });
    setAccounts(updated);

    if (onSaveLinks) {
      try {
        const payload = updated
          .filter((p) => p.status === 'CONNECTED' || p.status === 'VERIFIED')
          .map((p) => ({
            platform: p.platform,
            url: p.url || `https://${p.platform.toLowerCase()}.com`,
          }));
        await onSaveLinks(payload);
      } catch {
        // Handled upstream
      }
    }

    setIsSaving(false);
    setIsDisconnectOpen(false);
    if (currentView === 'detail') {
      setCurrentView('list');
    }
    setActionSuccess(`Disconnected ${selectedPlatform.name}`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Render platform icon helper
  const renderPlatformGlyph = (platform: SocialAccountItem['platform']) => {
    switch (platform) {
      case 'INSTAGRAM':
        return (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF543E] via-[#F80261] to-[#7024C4] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            IG
          </div>
        );
      case 'YOUTUBE':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#FF0000] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            YT
          </div>
        );
      case 'SPOTIFY':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#1DB954] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            SP
          </div>
        );
      case 'LINKEDIN':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#0077B5] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            IN
          </div>
        );
      case 'VIMEO':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#1AB7EA] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            VM
          </div>
        );
      case 'X':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#14110F] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            𝕏
          </div>
        );
    }
  };

  return (
    <div className="space-y-6" data-testid="module-c-social-container">
      {/* Interactive Simulation Bar at very top of content */}
      <aside
        aria-label="Module C Simulation Rig"
        className="rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs"
        data-testid="social-simulation-bar"
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-[#FFD64A] text-[#14110F] font-bold border-none px-2 py-0.5"
          >
            Module C • C08–C11 Simulator
          </Badge>
          <span className="text-[#6F675E] hidden sm:inline">Preview Canonical Stitch States:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSimulatorState('default')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              simulatorState === 'default' && currentView === 'list'
                ? 'bg-[#14110F] text-[#FAF6EF]'
                : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]'
            }`}
            data-testid="sim-btn-default"
          >
            Default (Mixed C08)
          </button>
          <button
            type="button"
            onClick={() => setSimulatorState('all-disconnected')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              simulatorState === 'all-disconnected'
                ? 'bg-[#14110F] text-[#FAF6EF]'
                : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]'
            }`}
            data-testid="sim-btn-disconnected"
          >
            All Disconnected
          </button>
          <button
            type="button"
            onClick={() => {
              setSimulatorState('connection-error');
              setCurrentView('error');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              currentView === 'error'
                ? 'bg-[#D8483C] text-white'
                : 'bg-white border border-[#E7E0D5] text-[#D8483C] hover:bg-[#FAF6EF]'
            }`}
            data-testid="sim-btn-error"
          >
            OAuth Error (C11)
          </button>
          <button
            type="button"
            onClick={() => setSimulatorState('empty')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              simulatorState === 'empty'
                ? 'bg-[#14110F] text-[#FAF6EF]'
                : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]'
            }`}
            data-testid="sim-btn-empty"
          >
            Empty (No Platforms)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPlatform(accounts[0] ?? DEFAULT_PLATFORMS[0]!);
              setIsDisconnectOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg font-semibold bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]"
            data-testid="sim-btn-dlg15"
          >
            DLG-15 Disconnect Modal
          </button>
        </div>
      </aside>

      {/* Success feedback toast */}
      {actionSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#2E9E6B]/10 border border-[#2E9E6B]/30 text-[#2E9E6B] text-xs font-bold flex items-center gap-2.5 animate-fadeIn"
          data-testid="social-action-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: C08 — CONNECTED SOCIAL ACCOUNTS GRID
      ========================================================================= */}
      {currentView === 'list' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E]">
                <span>MODULE C • STEP 05 OF 08</span>
                <span>•</span>
                <span>CONNECTED SOCIAL CHANNELS</span>
                <span>•</span>
                <span>~2 MINS</span>
              </div>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-[#14110F] mt-1">
                Connect your{' '}
                <span className="font-serif italic font-normal text-[#14110F]">
                  social accounts
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-[#6F675E] mt-0.5">
                Link a supported account to help casting directors and brands discover your
                authenticated work.
              </p>
            </div>

            {/* Why connect trigger */}
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowWhyConnect(!showWhyConnect)}
                className="gap-1.5 text-xs font-bold rounded-xl border-[#E7E0D5] bg-white text-[#14110F]"
                data-testid="why-connect-button"
              >
                <HelpCircle className="h-3.5 w-3.5 text-[#6F675E]" />
                <span>Why connect an account?</span>
              </Button>

              {showWhyConnect && (
                <div
                  className="absolute right-0 top-10 z-20 w-80 p-4 rounded-2xl bg-white border border-[#E7E0D5] shadow-lg text-xs space-y-2 animate-fadeIn"
                  data-testid="why-connect-popover"
                >
                  <div className="flex items-center justify-between font-bold text-[#14110F]">
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-[#2E9E6B]" />
                      Read-Only Verification Promise
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowWhyConnect(false)}
                      className="text-[#6F675E] hover:text-[#14110F]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-[#6F675E]">
                    Verified social accounts elevate your discovery ranking by confirming authentic
                    ownership. CreatorConnect strictly requests read-only public identity data and
                    never accesses your private messages, contacts, or draft campaigns.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Empty State */}
          {accounts.length === 0 ? (
            <Card glass className="p-12 text-center space-y-4 rounded-3xl border-[#E7E0D5]">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] flex items-center justify-center mx-auto text-[#6F675E]">
                <Share2 className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-lg text-[#14110F]">
                No Platforms Available
              </h3>
              <p className="text-xs text-[#6F675E] max-w-md mx-auto">
                No third-party social integration platforms are currently configured. You can
                proceed with your core portfolio and rate card.
              </p>
              <Button
                type="button"
                onClick={() => setAccounts(DEFAULT_PLATFORMS)}
                className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl"
              >
                Reset Default Platforms
              </Button>
            </Card>
          ) : (
            /* Main Content Grid: 2 Columns (68% accounts grid / 32% right rail) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: SocialAccountCards Grid (8 cols) */}
              <div className="lg:col-span-8 space-y-3.5">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E0D5] shadow-sm hover:border-[#14110F]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    data-testid={`social-card-${acc.id}`}
                  >
                    <div className="flex items-start gap-3.5">
                      {renderPlatformGlyph(acc.platform)}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-heading font-bold text-base text-[#14110F]">
                            {acc.name}
                          </h3>
                          {acc.status === 'CONNECTED' && (
                            <Badge className="bg-[#B6E09B]/30 text-[#14110F] border-none font-bold text-[11px] px-2 py-0.5">
                              Connected
                            </Badge>
                          )}
                          {acc.status === 'VERIFIED' && (
                            <Badge className="bg-[#C9B6F7]/30 text-[#14110F] border-none font-bold text-[11px] px-2 py-0.5">
                              Identity Verified ✓
                            </Badge>
                          )}
                          {acc.status === 'ERROR' && (
                            <Badge className="bg-[#FFB6C8]/40 text-[#D8483C] border-none font-bold text-[11px] px-2 py-0.5">
                              OAuth Token Expired
                            </Badge>
                          )}
                          {acc.status === 'NOT_CONNECTED' && (
                            <Badge
                              variant="outline"
                              className="border-[#E7E0D5] text-[#6F675E] text-[11px] px-2 py-0.5"
                            >
                              Not Connected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#6F675E]">{acc.categoryTag}</p>
                        {acc.handle && (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#14110F]">
                            <span>{acc.handle}</span>
                            {acc.url && (
                              <a
                                href={acc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#6F675E] hover:text-[#14110F]"
                                aria-label={`View public profile on ${acc.name}`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                        {acc.errorMessage && (
                          <p className="text-[11px] text-[#D8483C] font-semibold">
                            {acc.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {(acc.status === 'CONNECTED' || acc.status === 'VERIFIED') && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetail(acc)}
                            className="rounded-xl border-[#E7E0D5] bg-white text-[#14110F] font-bold text-xs hover:bg-[#FAF6EF]"
                            data-testid={`btn-detail-${acc.id}`}
                          >
                            Open Account Details (C10)
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPlatform(acc);
                              setIsDisconnectOpen(true);
                            }}
                            className="rounded-xl text-[#6F675E] hover:text-[#D8483C] text-xs font-semibold"
                            data-testid={`btn-disconnect-trigger-${acc.id}`}
                          >
                            Disconnect
                          </Button>
                        </>
                      )}

                      {acc.status === 'NOT_CONNECTED' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleInitiateConnect(acc)}
                          className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs shadow-sm gap-1.5"
                          data-testid={`btn-connect-${acc.id}`}
                        >
                          <span>Connect Account</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {acc.status === 'ERROR' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleInitiateConnect(acc)}
                          className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs gap-1.5"
                          data-testid={`btn-reconnect-${acc.id}`}
                        >
                          <span>Reconnect Account</span>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column: Live Discovery Snapshot & Privacy Promise (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                {/* Live Discovery Card Preview */}
                <Card className="p-5 rounded-2xl bg-white border border-[#E7E0D5] shadow-sm space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6F675E]">
                    <Sparkles className="h-3.5 w-3.5 text-[#FFD64A]" />
                    <span>Live Discovery Card Preview</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs flex items-center justify-center">
                        AR
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#14110F]">Aanya Rao</div>
                        <div className="text-[11px] text-[#6F675E]">
                          Senior Tech & Visual Creator
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {accounts
                        .filter((p) => p.status === 'CONNECTED' || p.status === 'VERIFIED')
                        .map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E7E0D5] text-[10px] font-bold text-[#14110F]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B]" />
                            {p.name.split(' ')[0]} Verified
                          </span>
                        ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#6F675E]">
                    Connected handles appear with verified badges on your public card in agency
                    search briefs.
                  </p>
                </Card>

                {/* Data Privacy Promise */}
                <Card className="p-5 rounded-2xl bg-white border border-[#E7E0D5] shadow-sm space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-[#14110F]">
                    <Lock className="h-4 w-4 text-[#2E9E6B]" />
                    <span>Data Privacy & Permitted Scopes</span>
                  </div>
                  <p className="text-xs text-[#6F675E] leading-relaxed">
                    Read-only profile verification. CreatorConnect never accesses your private
                    messages, contacts, or drafts. You can revoke access at any time with one click.
                  </p>
                </Card>

                {/* Optional Step Notice */}
                <div className="p-4 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] text-xs text-[#6F675E] space-y-1">
                  <div className="font-bold text-[#14110F]">Optional Step Notice</div>
                  <p>
                    Linking accounts is entirely optional. You can continue without connecting or
                    link them anytime from your Account Settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div className="pt-4 border-t border-[#E7E0D5] flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onNavigateBack}
              className="gap-2 rounded-xl text-xs font-bold border-[#E7E0D5] text-[#14110F]"
              data-testid="btn-back-portfolio"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Portfolio & Rates</span>
            </Button>

            <div className="flex items-center gap-2 text-xs text-[#6F675E]">
              <span className="w-2 h-2 rounded-full bg-[#2E9E6B] animate-pulse" />
              <span>Changes auto-saved to cloud draft</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onNavigateNext}
                className="text-xs font-bold text-[#6F675E] hover:text-[#14110F]"
                data-testid="btn-skip-socials"
              >
                Skip for now
              </Button>
              <Button
                type="button"
                onClick={onNavigateNext}
                className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-5 shadow-sm"
                data-testid="btn-save-continue-socials"
              >
                <span>Save and continue →</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: C09 — SOCIAL ACCOUNT HANDOFF & PROGRESS
      ========================================================================= */}
      {currentView === 'handoff' && (
        <Card
          glass
          className="p-6 sm:p-10 rounded-3xl border-[#E7E0D5] max-w-2xl mx-auto space-y-6"
          data-testid="c09-handoff-container"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E]">
              <span>MODULE C • C09 HANDOFF & PROGRESS</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('list')}
              className="text-[#6F675E] hover:text-[#14110F]"
              aria-label="Close handoff"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#14110F]">
              Connecting your{' '}
              <span className="font-serif italic text-[#14110F]">{selectedPlatform.name}</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
              Verify platform ownership to link public audience credentials directly to your
              marketplace card.
            </p>
          </div>

          {/* Handoff Step 1: Connecting spinner */}
          {handoffStep === 'connecting' && (
            <div className="p-8 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#14110F] mx-auto" />
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-base text-[#14110F]">
                  Connecting to provider authorization...
                </h3>
                <p className="text-xs text-[#6F675E]">
                  Opening secure OAuth dialog with {selectedPlatform.name}. Please keep this tab
                  open.
                </p>
              </div>
            </div>
          )}

          {/* Handoff Step 2: Alternative / Manual Handle Input */}
          {handoffStep === 'alternative' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] space-y-2 text-xs">
                <div className="font-bold text-[#14110F] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#2E9E6B]" />
                  <span>Truthful Integration Notice</span>
                </div>
                <p className="text-[#6F675E]">
                  Automated OAuth synchronization requires platform developer credentials. Manual
                  verified profile handle entry is active and persisted to your authoritative
                  profile.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#14110F]">
                  Enter Public {selectedPlatform.name} Handle or Channel Name
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={manualHandleInput}
                    onChange={(e) => setManualHandleInput(e.target.value)}
                    placeholder="@aanyarao.studio"
                    className="font-mono text-sm rounded-xl border-[#E7E0D5]"
                    data-testid="input-manual-handle"
                  />
                  <Button
                    type="button"
                    onClick={handleConfirmConnect}
                    disabled={isSaving || !manualHandleInput.trim()}
                    className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-4"
                    data-testid="btn-confirm-connect"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Save'}
                  </Button>
                </div>
                <p className="text-[11px] text-[#6F675E]">
                  Example: @aanyarao.studio or https://instagram.com/aanyarao.studio
                </p>
              </div>

              {/* Alternative: Code-in-Bio Verification */}
              <div className="p-4 rounded-2xl bg-white border border-[#E7E0D5] space-y-2 text-xs">
                <div className="font-bold text-[#14110F]">
                  Alternative: Code-in-Bio Verification
                </div>
                <p className="text-[#6F675E]">
                  Add temporary security token{' '}
                  <span className="font-mono bg-[#FFF8F5] px-1.5 py-0.5 rounded border border-[#E7E0D5] font-bold">
                    CC-VERIFY-8841
                  </span>{' '}
                  to your social bio for automatic ownership verification.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentView('list')}
                  className="rounded-xl border-[#E7E0D5] text-xs font-bold"
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorSubtype('cancelled');
                    setCurrentView('error');
                  }}
                  className="text-xs text-[#D8483C] hover:underline font-semibold"
                >
                  Simulate Connection Error (C11)
                </button>
              </div>
            </div>
          )}

          {/* Handoff Step 3: Success state */}
          {handoffStep === 'success' && (
            <div className="p-8 rounded-2xl bg-[#B6E09B]/20 border border-[#B6E09B] text-center space-y-3 animate-fadeIn">
              <CheckCircle2 className="h-10 w-10 text-[#2E9E6B] mx-auto" />
              <h3 className="font-heading font-extrabold text-xl text-[#14110F]">
                Account successfully connected!
              </h3>
              <p className="text-xs text-[#6F675E]">
                {selectedPlatform.name} has been verified and added to your profile. Redirecting to
                your channels...
              </p>
            </div>
          )}
        </Card>
      )}

      {/* =========================================================================
          VIEW 3: C10 — CONNECTED SOCIAL ACCOUNT DETAIL
      ========================================================================= */}
      {currentView === 'detail' && (
        <div className="space-y-6 animate-fadeIn" data-testid="c10-detail-container">
          {/* Breadcrumb & Header */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setCurrentView('list')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6F675E] hover:text-[#14110F]"
              data-testid="btn-back-c08"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to all social accounts (C08)</span>
            </button>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#14110F]">
              {selectedPlatform.name} Details
            </h2>
            <p className="text-xs sm:text-sm text-[#6F675E]">
              Inspect your linked social profile, verify public synchronization status, or manage
              connection permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols) - Detail Card */}
            <Card className="lg:col-span-8 p-6 rounded-3xl bg-white border border-[#E7E0D5] shadow-sm space-y-6">
              {/* Card Header with multi-account switcher */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E7E0D5]">
                <div className="flex items-center gap-3">
                  {renderPlatformGlyph(selectedPlatform.platform)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-lg text-[#14110F]">
                        {selectedPlatform.name}
                      </h3>
                      <Badge className="bg-[#B6E09B]/30 text-[#14110F] border-none font-bold text-xs px-2 py-0.5">
                        Connected & Verified ✓
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#6F675E]">
                      <span>{selectedPlatform.handle}</span>
                      {selectedPlatform.url && (
                        <a
                          href={selectedPlatform.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#6F675E] hover:text-[#14110F]"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Carousel switcher */}
                <div className="flex items-center gap-1.5 text-xs text-[#6F675E]">
                  <span className="font-semibold">Account 1 of 3</span>
                </div>
              </div>

              {/* Key Information Data Rows */}
              <div className="divide-y divide-[#E7E0D5] text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#6F675E]">Account Display Name</span>
                  <span className="font-bold text-[#14110F]">
                    {selectedPlatform.displayName || 'Aanya Rao'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#6F675E]">Account Type</span>
                  <span className="font-bold text-[#14110F]">
                    {selectedPlatform.accountType || 'Professional / Creator Account'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#6F675E]">Audience Reach</span>
                  <span className="font-bold text-[#14110F]">
                    {selectedPlatform.reach || '48,200 Public Followers'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#6F675E]">Verified Identity Match</span>
                  <span className="font-bold text-[#2E9E6B]">
                    Match Confirmed (100% legal name alignment)
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#6F675E]">Last Successful Sync</span>
                  <span className="font-bold text-[#14110F]">
                    {selectedPlatform.lastSync || 'Today at 02:45 PM IST'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#6F675E]">Connection Status</span>
                  <span className="font-bold text-[#2E9E6B]">
                    Active & Healthy (OAuth token renewed)
                  </span>
                </div>
              </div>

              {/* Action Area */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActionSuccess('Account metrics refreshed successfully!');
                    setTimeout(() => setActionSuccess(null), 3000);
                  }}
                  className="gap-2 rounded-xl text-xs font-bold border-[#E7E0D5]"
                  data-testid="btn-refresh-data"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh Account Data</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDisconnectOpen(true)}
                  className="text-xs font-bold text-[#D8483C] hover:bg-[#D8483C]/10 rounded-xl"
                  data-testid="btn-disconnect-detail"
                >
                  Disconnect account...
                </Button>
              </div>

              <p className="text-[11px] text-[#6F675E] border-t border-[#E7E0D5] pt-3">
                CreatorConnect strictly accesses public creator profile data. We never request
                publishing access, private messages, or ad account permissions.
              </p>
            </Card>

            {/* Right Column (4 cols) - Discovery Impact */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="p-5 rounded-2xl bg-white border border-[#E7E0D5] shadow-sm space-y-3">
                <Badge className="bg-[#C9B6F7]/40 text-[#14110F] font-bold text-xs uppercase tracking-wider border-none">
                  Discovery Impact
                </Badge>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#14110F]">
                    How brands see this account
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs font-bold text-[#14110F]">
                    {selectedPlatform.handle} • {selectedPlatform.reach || '48.2k'} • Visual Arts
                  </div>
                </div>
                <p className="text-xs text-[#6F675E] leading-relaxed">
                  Verified handles allow South Asian D2C brands and agency planners to invite you
                  directly to regional campaigns without manual screenshot verification.
                </p>
              </Card>

              <div className="p-4 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] text-xs text-[#6F675E] space-y-1">
                <div className="font-bold text-[#14110F]">Automated Refresh Schedule</div>
                <p>
                  Automated daily background refresh keeps your pitch metrics accurate without
                  requiring manual logins.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: C11 — SOCIAL CONNECTION ERROR & RECOVERY
      ========================================================================= */}
      {currentView === 'error' && (
        <Card
          glass
          className="p-6 sm:p-10 rounded-3xl border-[#E7E0D5] max-w-2xl mx-auto space-y-6"
          data-testid="c11-error-container"
        >
          {/* Subtype selector for testing all failure cases */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pb-3 border-b border-[#E7E0D5]">
            <span className="font-bold text-[#6F675E]">Simulate Error:</span>
            {(
              [
                'cancelled',
                'session-expired',
                'rate-limited',
                'network',
                'retrying',
                'repeated',
              ] as const
            ).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setErrorSubtype(sub)}
                className={`px-2 py-0.5 rounded font-semibold capitalize transition-all ${
                  errorSubtype === sub
                    ? 'bg-[#D8483C] text-white'
                    : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]'
                }`}
                data-testid={`err-subtype-${sub}`}
              >
                {sub.replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="text-center space-y-3">
            <Badge className="bg-[#FFB6C8]/40 text-[#D8483C] border-none font-bold text-xs uppercase px-3 py-1 mx-auto">
              {errorSubtype === 'retrying' ? 'Retrying Connection...' : 'Connection Incomplete'}
            </Badge>

            <div className="w-16 h-16 rounded-3xl bg-[#FFF8F5] border border-[#E7E0D5] flex items-center justify-center mx-auto text-[#D8483C]">
              {errorSubtype === 'retrying' ? (
                <RefreshCw className="h-8 w-8 animate-spin text-[#14110F]" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-[#D8483C]" />
              )}
            </div>

            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-2xl text-[#14110F]">
                We couldn’t connect your {selectedPlatform.name} account
              </h2>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-xs font-semibold text-[#14110F]">
                <span>{selectedPlatform.name}</span>
                <span>({selectedPlatform.handle || '@channel'})</span>
              </div>
            </div>

            {/* Error body copy tailored to failure reason */}
            <p className="text-xs sm:text-sm text-[#6F675E] max-w-md mx-auto leading-relaxed">
              {errorSubtype === 'cancelled' &&
                'It looks like the authorization window was closed before finishing, or permission was declined on the provider window. No changes were made to your profile.'}
              {errorSubtype === 'session-expired' &&
                'The authorization session timed out while waiting for a response. Please initiate a fresh link request.'}
              {errorSubtype === 'rate-limited' &&
                'Too many connection attempts were made in a short interval. Please wait a few moments before trying again.'}
              {errorSubtype === 'network' &&
                'A network interruption prevented communication with the social provider. Please verify your connection.'}
              {errorSubtype === 'retrying' &&
                'Attempting to re-establish secure connection with provider...'}
              {errorSubtype === 'repeated' &&
                'We have encountered repeated authentication challenges with this platform. Our support team can assist you.'}
            </p>
          </div>

          {/* Things to check checklist */}
          <div className="p-4 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] space-y-2 text-xs">
            <div className="font-bold text-[#14110F]">Helpful things to check:</div>
            <ul className="space-y-1.5 text-[#6F675E] list-disc list-inside">
              <li>Check that you are logged into the right account in your browser tab.</li>
              <li>Ensure third-party app permissions are allowed in your account settings.</li>
              <li>Your CreatorConnect profile remains completely safe and untouched.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              onClick={() => handleInitiateConnect(selectedPlatform)}
              className="w-full sm:w-auto bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-6"
              data-testid="btn-try-connecting-again"
            >
              Try connecting again →
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView('list')}
              className="w-full sm:w-auto rounded-xl border-[#E7E0D5] text-xs font-bold"
              data-testid="btn-error-back-c08"
            >
              Back to social accounts
            </Button>
          </div>

          <div className="text-center">
            <a
              href="/support"
              className="text-xs text-[#6F675E] hover:text-[#14110F] underline font-semibold"
            >
              Need help connecting? Talk to support
            </a>
          </div>
        </Card>
      )}

      {/* =========================================================================
          DLG-15: DISCONNECT SOCIAL ACCOUNT MODAL
      ========================================================================= */}
      <Dialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <DialogContent
          className="sm:max-w-md rounded-3xl bg-white border border-[#E7E0D5]"
          data-testid="dlg15-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-extrabold text-xl text-[#14110F]">
              Disconnect {selectedPlatform.name}?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F675E] pt-2 leading-relaxed">
              Removing{' '}
              <span className="font-bold text-[#14110F]">
                {selectedPlatform.handle || selectedPlatform.name}
              </span>{' '}
              will unpin your verified badge from search briefs and regional discovery cards. Your
              saved profile bio, portfolio, and active assignment agreements remain completely
              unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDisconnectOpen(false)}
              className="rounded-xl border-[#E7E0D5] text-xs font-bold"
              data-testid="btn-dlg15-cancel"
            >
              Cancel (Keep Connected)
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDisconnect}
              disabled={isSaving}
              className="bg-[#D8483C] text-white font-bold hover:bg-[#D8483C]/90 rounded-xl text-xs"
              data-testid="btn-dlg15-confirm"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
