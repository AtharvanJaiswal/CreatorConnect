'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@creatorconnect/ui';
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Upload,
  ArrowLeft,
  X,
  FileText,
  Lock,
  Loader2,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';

export type VerificationState =
  'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'APPROVED' | 'CHANGES_REQUIRED' | 'COOLDOWN';

export interface VerificationDocument {
  id: string;
  name: string;
  size: string;
  type: 'GOVT_ID' | 'TAX_REG' | 'PORTFOLIO_PROOF';
  categoryLabel: string;
  status: 'UPLOADED' | 'UPLOADING' | 'FAILED';
  uploadProgress?: number;
  errorMessage?: string;
}

const INITIAL_DOCS: VerificationDocument[] = [
  {
    id: 'doc-1',
    name: 'Govt_ID_Front_AanyaRao.pdf',
    size: '1.8 MB',
    type: 'GOVT_ID',
    categoryLabel: 'Government Identity Document',
    status: 'UPLOADED',
  },
  {
    id: 'doc-2',
    name: 'Business_GST_TaxReg_2024.pdf',
    size: '3.2 MB',
    type: 'TAX_REG',
    categoryLabel: 'Business / GST Tax Document',
    status: 'UPLOADING',
    uploadProgress: 72,
  },
  {
    id: 'doc-3',
    name: 'Unreadable_Blurry_Scan.jpg',
    size: '840 KB',
    type: 'PORTFOLIO_PROOF',
    categoryLabel: 'Proof of Production Work',
    status: 'FAILED',
    errorMessage: 'Scan resolution too low or file damaged. Please upload a clear document.',
  },
];

interface VerificationCentrePanelProps {
  initialIsVerified?: boolean;
  onNavigateOverview?: () => void;
  onNavigateBack?: () => void;
}

export function VerificationCentrePanel({
  initialIsVerified = false,
  onNavigateOverview,
  onNavigateBack,
}: VerificationCentrePanelProps) {
  // Verification lifecycle state
  const [verificationState, setVerificationState] = useState<VerificationState>(
    initialIsVerified ? 'APPROVED' : 'UNDER_REVIEW',
  );

  // Active view: 'centre' (C12), 'request' (C13), 'outcome' (C14)
  const [currentView, setCurrentView] = useState<'centre' | 'request' | 'outcome'>('centre');

  // Active persona mode
  const [personaRole, setPersonaRole] = useState<'creator' | 'brand'>('creator');

  // Documents state for C13
  const [documents, setDocuments] = useState<VerificationDocument[]>(INITIAL_DOCS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [isDlg16Open, setIsDlg16Open] = useState(false);
  const [isDlg17Open, setIsDlg17Open] = useState(false);
  const [isDlg21Open, setIsDlg21Open] = useState(false);

  // Outcome preview state (C14)
  const [outcomeTab, setOutcomeTab] = useState<
    'approved' | 'changes-required' | 'rejected' | 'pending'
  >('approved');

  // Handle document upload simulation (or real media URL integration)
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: VerificationDocument['type'],
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newDoc: VerificationDocument = {
      id: `doc-${Date.now()}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type,
      categoryLabel:
        type === 'GOVT_ID'
          ? 'Government Identity Document'
          : type === 'TAX_REG'
            ? 'Business / GST Tax Document'
            : 'Proof of Production Work',
      status: 'UPLOADED',
    };

    setDocuments((prev) => [...prev.filter((d) => d.status !== 'FAILED'), newDoc]);
    setActionSuccess(`Uploaded ${file.name} successfully.`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Remove document
  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Submit verification request via DLG-16
  const handleConfirmSubmission = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsDlg16Open(false);
      setVerificationState('UNDER_REVIEW');
      setOutcomeTab('pending');
      setCurrentView('outcome');
      setActionSuccess('Verification request successfully submitted for review!');
      setTimeout(() => setActionSuccess(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6" data-testid="module-c-verification-container">
      {/* Interactive State Switcher at the top (C12 Canonical Simulator) */}
      <aside
        aria-label="Verification State Rig"
        className="rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs"
        data-testid="verification-simulation-bar"
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-[#FFD64A] text-[#14110F] font-bold border-none px-2 py-0.5"
          >
            Module C • C12–C14 Simulator
          </Badge>
          <span className="text-[#6F675E] hidden sm:inline">Preview Verification Lifecycle:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setVerificationState('NOT_STARTED');
              setCurrentView('centre');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              verificationState === 'NOT_STARTED' && currentView === 'centre'
                ? 'bg-[#14110F] text-[#FAF6EF]'
                : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]'
            }`}
            data-testid="ver-btn-not-started"
          >
            Not Started
          </button>
          <button
            type="button"
            onClick={() => {
              setVerificationState('IN_PROGRESS');
              setCurrentView('request');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              verificationState === 'IN_PROGRESS' || currentView === 'request'
                ? 'bg-[#14110F] text-[#FAF6EF]'
                : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]'
            }`}
            data-testid="ver-btn-in-progress"
          >
            Request Form (C13)
          </button>
          <button
            type="button"
            onClick={() => {
              setVerificationState('UNDER_REVIEW');
              setCurrentView('centre');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              verificationState === 'UNDER_REVIEW' && currentView === 'centre'
                ? 'bg-[#14110F] text-[#FAF6EF]'
                : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]'
            }`}
            data-testid="ver-btn-under-review"
          >
            Under Review (C12)
          </button>
          <button
            type="button"
            onClick={() => {
              setVerificationState('APPROVED');
              setOutcomeTab('approved');
              setCurrentView('outcome');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              verificationState === 'APPROVED' && currentView === 'outcome'
                ? 'bg-[#2E9E6B] text-white'
                : 'bg-white border border-[#E7E0D5] text-[#2E9E6B] hover:bg-[#FAF6EF]'
            }`}
            data-testid="ver-btn-approved"
          >
            Outcome (C14)
          </button>
          <button
            type="button"
            onClick={() => setIsDlg21Open(true)}
            className="px-2.5 py-1 rounded-lg font-semibold bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]"
            data-testid="ver-btn-dlg21"
          >
            DLG-21 Modal
          </button>
          <button
            type="button"
            onClick={() => setPersonaRole(personaRole === 'creator' ? 'brand' : 'creator')}
            className="px-2.5 py-1 rounded-lg font-semibold bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#FAF6EF]"
            data-testid="ver-btn-toggle-role"
          >
            Role: {personaRole === 'creator' ? 'Creator' : 'Brand'}
          </button>
        </div>
      </aside>

      {/* Success feedback toast */}
      {actionSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#2E9E6B]/10 border border-[#2E9E6B]/30 text-[#2E9E6B] text-xs font-bold flex items-center gap-2.5 animate-fadeIn"
          data-testid="verification-action-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: C12 — VERIFICATION CENTRE (DESKTOP STATUS & NEXT-STEPS)
      ========================================================================= */}
      {currentView === 'centre' && (
        <div className="space-y-6 animate-fadeIn" data-testid="c12-centre-container">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E]">
              <span>MODULE C • STEP 07 OF 08</span>
              <span>•</span>
              <span>TRUST & IDENTITY GOVERNANCE</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#14110F] mt-1">
              Verification{' '}
              <span className="font-serif italic font-normal text-[#14110F]">centre</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#6F675E] mt-0.5">
              Build marketplace trust, unlock verified search placement, and protect your
              collaborative rights across South Asia.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Column (8 cols) */}
            <div className="lg:col-span-8 space-y-5">
              {/* Top Status Card */}
              <Card className="p-6 rounded-3xl bg-white border border-[#E7E0D5] shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {verificationState === 'UNDER_REVIEW' && (
                        <Badge className="bg-[#FFD64A]/40 text-[#14110F] border-none font-bold text-xs px-2.5 py-0.5">
                          Under Review
                        </Badge>
                      )}
                      {verificationState === 'APPROVED' && (
                        <Badge className="bg-[#B6E09B]/40 text-[#14110F] border-none font-bold text-xs px-2.5 py-0.5">
                          Approved / Verified ✓
                        </Badge>
                      )}
                      {verificationState === 'NOT_STARTED' && (
                        <Badge
                          variant="outline"
                          className="border-[#E7E0D5] text-[#6F675E] text-xs px-2.5 py-0.5"
                        >
                          Not Started (Initial)
                        </Badge>
                      )}
                      {verificationState === 'CHANGES_REQUIRED' && (
                        <Badge className="bg-[#FFB6C8]/40 text-[#D8483C] border-none font-bold text-xs px-2.5 py-0.5">
                          Action Needed • Clarification Requested
                        </Badge>
                      )}
                      {verificationState === 'COOLDOWN' && (
                        <Badge className="bg-[#FFB6C8]/40 text-[#D8483C] border-none font-bold text-xs px-2.5 py-0.5">
                          Cooldown Period Active
                        </Badge>
                      )}
                      <span className="text-xs text-[#6F675E]">Ref: #VER-84920-IN</span>
                    </div>
                    <h3 className="font-heading font-extrabold text-xl text-[#14110F]">
                      {verificationState === 'UNDER_REVIEW' &&
                        'Identity & Platform Verification in Queue'}
                      {verificationState === 'APPROVED' &&
                        'Your Marketplace Profile is Authoritatively Verified'}
                      {verificationState === 'NOT_STARTED' && 'Unlock Verified Creator Status'}
                      {verificationState === 'CHANGES_REQUIRED' &&
                        'Reviewer Requested Updates to Document Scan'}
                      {verificationState === 'COOLDOWN' &&
                        'Maximum Verification Attempts Reached for Current Cycle'}
                    </h3>
                  </div>

                  {/* Top Action Button */}
                  <div>
                    {verificationState === 'NOT_STARTED' && (
                      <Button
                        type="button"
                        onClick={() => setCurrentView('request')}
                        className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-5 shadow-sm"
                        data-testid="btn-start-verification"
                      >
                        Start verification →
                      </Button>
                    )}
                    {verificationState === 'UNDER_REVIEW' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentView('request')}
                        className="rounded-xl border-[#E7E0D5] text-xs font-bold"
                        data-testid="btn-view-submitted"
                      >
                        View submitted details
                      </Button>
                    )}
                    {verificationState === 'APPROVED' && (
                      <Button
                        type="button"
                        onClick={() => {
                          setOutcomeTab('approved');
                          setCurrentView('outcome');
                        }}
                        className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-5"
                        data-testid="btn-view-badge"
                      >
                        View verified badge & credentials →
                      </Button>
                    )}
                    {verificationState === 'CHANGES_REQUIRED' && (
                      <Button
                        type="button"
                        onClick={() => setCurrentView('request')}
                        className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-5"
                        data-testid="btn-fix-resubmit"
                      >
                        Fix and resubmit →
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#6F675E] leading-relaxed">
                  {verificationState === 'UNDER_REVIEW' &&
                    'Your documents and platform linkages have been submitted and are currently queued for manual compliance review. Standard reviews typically complete within 2 to 3 business days — no expedite guarantee.'}
                  {verificationState === 'APPROVED' &&
                    'Congratulations! Your identity and linked social profiles carry the verified badge across client search results, project shortlists, and direct escrow contracts.'}
                  {verificationState === 'NOT_STARTED' &&
                    'Complete 2 quick verification steps to attach verified checkmarks to your reels, ensure faster milestone releases, and access commercial agency campaigns.'}
                  {verificationState === 'CHANGES_REQUIRED' &&
                    'Our compliance desk has requested an updated copy of your legal identity document. You have 14 calendar days to upload matching credentials without restarting the review queue.'}
                  {verificationState === 'COOLDOWN' &&
                    'Policy limit: 3 attempts per 30 calendar days. You will be eligible to request verification again on November 24, 2024.'}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#6F675E] pt-3 border-t border-[#E7E0D5]">
                  <span>Submitted on 24 Oct, 2024 at 11:20 AM IST</span>
                  <span>•</span>
                  <span>Attempt 1 of 3 (Policy limit: 3 attempts / 30 days)</span>
                </div>
              </Card>

              {/* Horizontal Stepper / Timeline */}
              <Card className="p-6 rounded-3xl bg-white border border-[#E7E0D5] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading font-bold text-sm text-[#14110F]">
                    {personaRole === 'creator'
                      ? 'Creator Verification Journey'
                      : 'Corporate Entity Verification Journey'}
                  </h4>
                  <span className="text-xs text-[#6F675E]">Phase 2 Governance</span>
                </div>

                {personaRole === 'creator' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-[#B6E09B]/20 border border-[#B6E09B]/50 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#14110F]">
                        <CheckCircle2 className="h-4 w-4 text-[#2E9E6B]" />
                        <span>Step 1: ID Doc</span>
                      </div>
                      <p className="text-[11px] text-[#6F675E]">
                        Aadhaar / Passport / PAN Confirmed
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#B6E09B]/20 border border-[#B6E09B]/50 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#14110F]">
                        <CheckCircle2 className="h-4 w-4 text-[#2E9E6B]" />
                        <span>Step 2: Socials</span>
                      </div>
                      <p className="text-[11px] text-[#6F675E]">
                        Instagram & YouTube Ownership Linked
                      </p>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl border space-y-1 ${
                        verificationState === 'APPROVED'
                          ? 'bg-[#B6E09B]/20 border-[#B6E09B]/50'
                          : 'bg-[#FFD64A]/20 border-[#FFD64A]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-[#14110F]">
                        {verificationState === 'APPROVED' ? (
                          <CheckCircle2 className="h-4 w-4 text-[#2E9E6B]" />
                        ) : (
                          <Clock className="h-4 w-4 text-[#14110F]" />
                        )}
                        <span>Step 3: Review</span>
                      </div>
                      <p className="text-[11px] text-[#6F675E]">Compliance & Identity Check</p>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl border space-y-1 ${
                        verificationState === 'APPROVED'
                          ? 'bg-[#B6E09B]/20 border-[#B6E09B]/50'
                          : 'bg-[#FAF6EF] border-[#E7E0D5]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-[#14110F]">
                        {verificationState === 'APPROVED' ? (
                          <CheckCircle2 className="h-4 w-4 text-[#2E9E6B]" />
                        ) : (
                          <Shield className="h-4 w-4 text-[#6F675E]" />
                        )}
                        <span>Step 4: Badge</span>
                      </div>
                      <p className="text-[11px] text-[#6F675E]">Trust Seal & Search Placement</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-[#B6E09B]/20 border border-[#B6E09B]/50 space-y-1">
                      <div className="font-bold text-[#14110F]">Step 1: GSTIN</div>
                      <p className="text-[11px] text-[#6F675E]">Corporate Incorporation</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#B6E09B]/20 border border-[#B6E09B]/50 space-y-1">
                      <div className="font-bold text-[#14110F]">Step 2: Domain</div>
                      <p className="text-[11px] text-[#6F675E]">Signatory Email Match</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#FFD64A]/20 border border-[#FFD64A] space-y-1">
                      <div className="font-bold text-[#14110F]">Step 3: Compliance</div>
                      <p className="text-[11px] text-[#6F675E]">Brand Partner Audit</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-1">
                      <div className="font-bold text-[#14110F]">Step 4: Partner</div>
                      <p className="text-[11px] text-[#6F675E]">Escrow Waiver Unlocked</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Right Column: Marketplace Trust Perks (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="p-5 rounded-2xl bg-white border border-[#E7E0D5] shadow-sm space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6F675E]">
                  <Sparkles className="h-3.5 w-3.5 text-[#FFD64A]" />
                  <span>Verified Creator Advantages</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#2E9E6B] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#14110F]">
                        4.2x Higher Agency Brief Matches
                      </div>
                      <p className="text-[#6F675E] text-[11px]">
                        Production companies filter candidates by verified status to minimize
                        booking risk.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#2E9E6B] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#14110F]">
                        Automated Escrow Milestone Protection
                      </div>
                      <p className="text-[#6F675E] text-[11px]">
                        Instant release authorization when clients confirm deliverable approval.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#2E9E6B] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#14110F]">South Asia Trust Seal</div>
                      <p className="text-[#6F675E] text-[11px]">
                        Public verified checkmark on discovery cards and pitch decks.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Zero-access security note */}
              <div className="p-4 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[#14110F]">
                  <Lock className="h-3.5 w-3.5 text-[#2E9E6B]" />
                  <span>Zero-Access Encrypted Vault</span>
                </div>
                <p className="text-[#6F675E] text-[11px] leading-relaxed">
                  Identity documents pass through SHA-256 byte verification, isolated malware
                  scanning, and are stored in cold encrypted buckets. CreatorConnect never shares
                  identity numbers with brands or third parties.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Action Nav */}
          <div className="pt-4 border-t border-[#E7E0D5] flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onNavigateBack}
              className="gap-2 rounded-xl text-xs font-bold border-[#E7E0D5] text-[#14110F]"
              data-testid="btn-back-socials"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Social Accounts (C08)</span>
            </Button>
            <Button
              type="button"
              onClick={() => setCurrentView('request')}
              className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-5 shadow-sm"
              data-testid="btn-c12-start"
            >
              <span>Request Verification (C13) →</span>
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: C13 — REQUEST VERIFICATION FORM & DOCUMENT UPLOAD
      ========================================================================= */}
      {currentView === 'request' && (
        <div className="space-y-6 animate-fadeIn" data-testid="c13-request-container">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setCurrentView('centre')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6F675E] hover:text-[#14110F]"
              data-testid="btn-back-c12"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Verification Centre (C12)</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E] pt-1">
              <span>MODULE C • STEP 07</span>
              <span>•</span>
              <span>CREDENTIAL SUBMISSION</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#14110F]">
              Submit verification{' '}
              <span className="font-serif italic text-[#14110F]">credentials</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#6F675E]">
              Upload legal credentials to establish identity alignment with your linked social
              handles and banking records.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Upload Fields (8 cols) */}
            <div className="lg:col-span-8 space-y-5">
              {/* Upload Zone 1: Govt ID */}
              <Card className="p-6 rounded-3xl bg-white border border-[#E7E0D5] shadow-sm space-y-4">
                <div>
                  <h3 className="font-heading font-bold text-base text-[#14110F]">
                    1. Government Identity Document (Mandatory)
                  </h3>
                  <p className="text-xs text-[#6F675E]">
                    Aadhaar Card, Indian Passport, or Voter ID. Full name and birthdate must match
                    your CreatorConnect account name.
                  </p>
                </div>

                <div className="border-2 border-dashed border-[#E7E0D5] hover:border-[#14110F]/40 transition-colors rounded-2xl p-6 text-center space-y-2 bg-[#FFF8F5]">
                  <Upload className="h-6 w-6 text-[#6F675E] mx-auto" />
                  <label className="cursor-pointer">
                    <span className="text-xs font-bold text-[#14110F] hover:underline">
                      Click to upload document
                    </span>
                    <span className="text-xs text-[#6F675E]"> or drag and drop</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, 'GOVT_ID')}
                      className="hidden"
                      data-testid="upload-input-govt-id"
                    />
                  </label>
                  <p className="text-[10px] text-[#6F675E]">PDF, JPG, or PNG up to 10MB</p>
                </div>
              </Card>

              {/* Upload Zone 2: Business / GST (Optional) */}
              <Card className="p-6 rounded-3xl bg-white border border-[#E7E0D5] shadow-sm space-y-4">
                <div>
                  <h3 className="font-heading font-bold text-base text-[#14110F]">
                    2. Business Registration / GST Certificate (Optional)
                  </h3>
                  <p className="text-xs text-[#6F675E]">
                    For registered studios, production companies, or creators with formal tax
                    registration.
                  </p>
                </div>

                <div className="border-2 border-dashed border-[#E7E0D5] hover:border-[#14110F]/40 transition-colors rounded-2xl p-6 text-center space-y-2 bg-[#FFF8F5]">
                  <Upload className="h-6 w-6 text-[#6F675E] mx-auto" />
                  <label className="cursor-pointer">
                    <span className="text-xs font-bold text-[#14110F] hover:underline">
                      Click to upload GST document
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, 'TAX_REG')}
                      className="hidden"
                      data-testid="upload-input-tax-reg"
                    />
                  </label>
                  <p className="text-[10px] text-[#6F675E]">PDF or PNG up to 15MB</p>
                </div>
              </Card>

              {/* Attached Documents List */}
              <Card className="p-6 rounded-3xl bg-white border border-[#E7E0D5] shadow-sm space-y-3">
                <h4 className="font-heading font-bold text-sm text-[#14110F]">
                  Attached Documents for Review
                </h4>
                <div className="space-y-2.5">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl border border-[#E7E0D5] bg-[#FAF6EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      data-testid={`doc-item-${doc.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-[#14110F] shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#14110F]">{doc.name}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[#E7E0D5] bg-white text-[#6F675E]"
                            >
                              {doc.categoryLabel}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-[#6F675E]">{doc.size}</div>
                          {doc.errorMessage && (
                            <p className="text-[11px] text-[#D8483C] font-semibold">
                              {doc.errorMessage}
                            </p>
                          )}
                          {doc.status === 'UPLOADING' && (
                            <div className="w-48 bg-white rounded-full h-1.5 border border-[#E7E0D5] overflow-hidden mt-1">
                              <div
                                className="bg-[#FFD64A] h-full transition-all"
                                style={{ width: `${doc.uploadProgress || 50}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {doc.status === 'UPLOADED' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2E9E6B]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ready
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDoc(doc.id)}
                          className="text-[#6F675E] hover:text-[#D8483C] text-xs font-semibold"
                          data-testid={`btn-remove-doc-${doc.id}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right Column: Sticky Summary Card (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="p-5 rounded-2xl bg-white border border-[#E7E0D5] shadow-sm space-y-3.5">
                <div className="font-heading font-extrabold text-sm text-[#14110F] border-b border-[#E7E0D5] pb-2">
                  Verification Request Summary
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6F675E]">Active Role</span>
                    <span className="font-bold text-[#14110F]">Creator / Influencer</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F675E]">Public Info Check</span>
                    <span className="font-bold text-[#2E9E6B]">Instagram Linked ✓</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F675E]">Valid Documents</span>
                    <span className="font-bold text-[#14110F]">
                      {documents.filter((d) => d.status === 'UPLOADED').length} attached
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFF8F5] border border-[#E7E0D5] text-[11px] text-[#6F675E] space-y-1">
                  <div className="font-bold text-[#14110F]">Compliance Notice</div>
                  <p>
                    Uploaded documents are permanently audited and encrypted. They will never appear
                    in your media kit or brand pitch decks.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => setIsDlg16Open(true)}
                  disabled={documents.filter((d) => d.status === 'UPLOADED').length === 0}
                  className="w-full bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs py-2.5 shadow-sm"
                  data-testid="btn-open-dlg16"
                >
                  Review & Confirm Request →
                </Button>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: C14 — VERIFICATION OUTCOME & DECISION
      ========================================================================= */}
      {currentView === 'outcome' && (
        <div className="space-y-6 animate-fadeIn" data-testid="c14-outcome-container">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E]">
                <span>MODULE C • C14 OUTCOME & DECISION</span>
              </div>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#14110F] mt-1">
                Verification <span className="font-serif italic text-[#14110F]">outcome</span>
              </h2>
            </div>

            {/* Outcome Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#E7E0D5] text-xs">
              {(['approved', 'changes-required', 'rejected', 'pending'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setOutcomeTab(tab)}
                  className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                    outcomeTab === tab
                      ? 'bg-[#14110F] text-[#FAF6EF]'
                      : 'text-[#6F675E] hover:text-[#14110F]'
                  }`}
                  data-testid={`tab-outcome-${tab}`}
                >
                  {tab.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Canonical State 1: Approved */}
          {outcomeTab === 'approved' && (
            <Card
              glass
              className="p-8 sm:p-12 rounded-3xl border-[#E7E0D5] text-center space-y-6 max-w-2xl mx-auto"
            >
              <Badge className="bg-[#B6E09B]/40 text-[#14110F] border-none font-bold text-xs uppercase px-3 py-1 mx-auto">
                Verification Confirmed • Tier 1 Verified Creator
              </Badge>

              <div className="w-16 h-16 rounded-3xl bg-[#B6E09B]/30 flex items-center justify-center mx-auto text-[#2E9E6B]">
                <ShieldCheck className="h-10 w-10 text-[#2E9E6B]" />
              </div>

              <div className="space-y-2">
                <h3 className="font-heading font-extrabold text-3xl text-[#14110F]">
                  Your profile is verified.
                </h3>
                <p className="text-xs sm:text-sm text-[#6F675E] max-w-md mx-auto leading-relaxed">
                  Your identity and linked social profiles have been confirmed by our verification
                  team. Your profile now carries the verified checkmark across brand searches and
                  discovery briefs.
                </p>
              </div>

              {/* Verified Profile Preview Card */}
              <div className="p-4 rounded-2xl bg-white border border-[#E7E0D5] max-w-md mx-auto text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs flex items-center justify-center">
                      AR
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#14110F] flex items-center gap-1">
                        <span>Aanya Rao</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2E9E6B]" />
                      </div>
                      <div className="text-[11px] text-[#6F675E]">@aanyarao.creates</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#6F675E]">Verified Oct 24, 2024</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={onNavigateOverview}
                  className="w-full sm:w-auto bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-6"
                  data-testid="btn-outcome-done"
                >
                  Done — Go to Profile Overview →
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDlg17Open(true)}
                  className="w-full sm:w-auto rounded-xl border-[#E7E0D5] text-xs font-bold"
                  data-testid="btn-outcome-dlg17"
                >
                  DLG-17 Compact Sheet
                </Button>
              </div>
            </Card>
          )}

          {/* Canonical State 2: Changes Required */}
          {outcomeTab === 'changes-required' && (
            <Card
              glass
              className="p-8 sm:p-12 rounded-3xl border-[#E7E0D5] text-center space-y-6 max-w-2xl mx-auto"
            >
              <Badge className="bg-[#FFD64A]/40 text-[#14110F] border-none font-bold text-xs uppercase px-3 py-1 mx-auto">
                Action Needed • Clarification Requested
              </Badge>

              <div className="w-16 h-16 rounded-3xl bg-[#FFD64A]/20 flex items-center justify-center mx-auto text-[#14110F]">
                <AlertTriangle className="h-9 w-9 text-[#C98A16]" />
              </div>

              <div className="space-y-2">
                <h3 className="font-heading font-extrabold text-2xl text-[#14110F]">
                  A few details need your attention.
                </h3>
                <p className="text-xs sm:text-sm text-[#6F675E] max-w-md mx-auto leading-relaxed">
                  Our compliance team reviewed your submission. To finalize your verified status,
                  please update the requested item below.
                </p>
              </div>

              {/* Actionable Reviewer Fix Box */}
              <div className="p-4 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] text-left space-y-2 text-xs">
                <div className="font-bold text-[#14110F] flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-[#C98A16]" />
                  <span>Reviewer Note: Government ID Scan</span>
                </div>
                <p className="text-[#6F675E] leading-relaxed">
                  &ldquo;The legal name on your Aadhaar card does not exactly match your profile
                  registration name (&lsquo;Aanya R. Rao&rsquo; vs &lsquo;Aanya Rao&rsquo;). Please
                  upload a clear photo of an ID document with matching initials or update your legal
                  name in Step 02.&rdquo;
                </p>
                <div className="text-[11px] text-[#C98A16] font-semibold pt-1">
                  Resubmission window: 14 days remaining without restarting queue.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => setCurrentView('request')}
                  className="w-full sm:w-auto bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-6"
                  data-testid="btn-fix-resubmit-outcome"
                >
                  Fix and Resubmit →
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentView('centre')}
                  className="w-full sm:w-auto rounded-xl border-[#E7E0D5] text-xs font-bold"
                >
                  Review Submission Details
                </Button>
              </div>
            </Card>
          )}

          {/* Canonical State 3: Rejected */}
          {outcomeTab === 'rejected' && (
            <Card
              glass
              className="p-8 sm:p-12 rounded-3xl border-[#E7E0D5] text-center space-y-6 max-w-2xl mx-auto"
            >
              <Badge className="bg-[#FFB6C8]/40 text-[#D8483C] border-none font-bold text-xs uppercase px-3 py-1 mx-auto">
                Verification Ineligible
              </Badge>

              <div className="w-16 h-16 rounded-3xl bg-[#FFB6C8]/20 flex items-center justify-center mx-auto text-[#D8483C]">
                <X className="h-9 w-9 text-[#D8483C]" />
              </div>

              <div className="space-y-2">
                <h3 className="font-heading font-extrabold text-2xl text-[#14110F]">
                  We couldn’t verify your account at this time.
                </h3>
                <p className="text-xs sm:text-sm text-[#6F675E] max-w-md mx-auto leading-relaxed">
                  Your account does not currently meet the eligibility criteria for public
                  marketplace verification. The reviewer noted that linked social accounts must show
                  at least 60 days of active public posting history.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] text-xs text-[#6F675E] space-y-1">
                <div className="font-bold text-[#14110F]">Resubmission Policy</div>
                <p>
                  Resubmission is permitted after 30 days (Eligible on November 24, 2024). In the
                  meantime, your standard CreatorConnect creator profile remains active and
                  discoverable.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={onNavigateOverview}
                  className="w-full sm:w-auto rounded-xl border-[#E7E0D5] text-xs font-bold bg-white"
                >
                  Return to Profile Overview
                </Button>
                <a
                  href="/support"
                  className="text-xs text-[#6F675E] hover:text-[#14110F] underline font-semibold"
                >
                  Read Verification Guidelines ↗
                </a>
              </div>
            </Card>
          )}

          {/* Canonical State 4: Pending / Under Review */}
          {outcomeTab === 'pending' && (
            <Card
              glass
              className="p-8 sm:p-12 rounded-3xl border-[#E7E0D5] text-center space-y-6 max-w-2xl mx-auto"
            >
              <Badge className="bg-[#C9B6F7]/40 text-[#14110F] border-none font-bold text-xs uppercase px-3 py-1 mx-auto">
                In Review • Submission Received
              </Badge>

              <div className="w-16 h-16 rounded-3xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center mx-auto text-[#14110F]">
                <Clock className="h-9 w-9 text-[#14110F]" />
              </div>

              <div className="space-y-2">
                <h3 className="font-heading font-extrabold text-2xl text-[#14110F]">
                  Your verification request is being reviewed.
                </h3>
                <p className="text-xs sm:text-sm text-[#6F675E] max-w-md mx-auto leading-relaxed">
                  Our operations team is currently reviewing your submitted details and linked
                  platform credentials. You will receive an email and in-app notification once the
                  review is completed.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E7E0D5] max-w-md mx-auto space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#6F675E]">
                  <span>Step 1: Request Submitted</span>
                  <span className="font-bold text-[#2E9E6B]">Completed ✓</span>
                </div>
                <div className="flex items-center justify-between text-[#14110F] font-bold">
                  <span>Step 2: Compliance & Identity Review</span>
                  <span className="text-[#C98A16]">Active ⏳</span>
                </div>
                <div className="flex items-center justify-between text-[#6F675E]">
                  <span>Step 3: Decision & Badge Issuance</span>
                  <span>Upcoming ○</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => setCurrentView('centre')}
                  className="w-full sm:w-auto bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs px-6"
                  data-testid="btn-back-centre"
                >
                  Back to Verification Centre →
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentView('request')}
                  className="w-full sm:w-auto rounded-xl border-[#E7E0D5] text-xs font-bold"
                >
                  Edit Submission while in queue
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* =========================================================================
          DLG-16: CONFIRM VERIFICATION SUBMISSION MODAL
      ========================================================================= */}
      <Dialog open={isDlg16Open} onOpenChange={setIsDlg16Open}>
        <DialogContent
          className="sm:max-w-md rounded-3xl bg-white border border-[#E7E0D5]"
          data-testid="dlg16-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-extrabold text-xl text-[#14110F]">
              Confirm Verification Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F675E] pt-2 space-y-2 leading-relaxed">
              <p>
                Your linked social handle (
                <span className="font-bold text-[#14110F]">@aanyarao.studio</span>) and{' '}
                <span className="font-bold text-[#14110F]">
                  {documents.filter((d) => d.status === 'UPLOADED').length} attached government
                  identity document(s)
                </span>{' '}
                will be reviewed against our creator trust guidelines.
              </p>
              <p>
                <span className="font-bold text-[#14110F]">Estimated response:</span> About 48
                business hours. Uploaded credentials will never be shared with brands or other
                users.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDlg16Open(false)}
              className="rounded-xl border-[#E7E0D5] text-xs font-bold"
              data-testid="btn-dlg16-cancel"
            >
              Back to Form
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSubmission}
              disabled={isSubmitting}
              className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs"
              data-testid="btn-dlg16-confirm"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Submit Verification Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          DLG-17: COMPACT NOTIFICATION SHEET OVERLAY
      ========================================================================= */}
      <Dialog open={isDlg17Open} onOpenChange={setIsDlg17Open}>
        <DialogContent
          className="sm:max-w-md rounded-3xl bg-white border border-[#E7E0D5]"
          data-testid="dlg17-modal"
        >
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-[#B6E09B]/30 flex items-center justify-center text-[#2E9E6B] mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="font-heading font-extrabold text-xl text-[#14110F]">
              Verification Notification
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F675E] pt-1">
              Your profile verification request was approved by the Trust &amp; Safety desk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDlg17Open(false)}
              className="rounded-xl border-[#E7E0D5] text-xs font-bold"
            >
              Dismiss
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsDlg17Open(false);
                setOutcomeTab('approved');
                setCurrentView('outcome');
              }}
              className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs"
            >
              View Full Outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          DLG-21: VERIFICATION REQUIRED MODAL
      ========================================================================= */}
      <Dialog open={isDlg21Open} onOpenChange={setIsDlg21Open}>
        <DialogContent
          className="sm:max-w-md rounded-3xl bg-white border border-[#E7E0D5]"
          data-testid="dlg21-modal"
        >
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-[#FFF8F5] border border-[#E7E0D5] flex items-center justify-center text-[#14110F] mb-2">
              <Lock className="h-6 w-6 text-[#14110F]" />
            </div>
            <DialogTitle className="font-heading font-extrabold text-xl text-[#14110F]">
              Verification Required
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F675E] pt-2 space-y-2 leading-relaxed">
              <p>
                To unlock escrow-backed assignments over ₹50,000 and direct brand chat inquiries,
                your account must complete identity verification.
              </p>
              <p>
                This ensures two-sided compliance with the Digital Personal Data Protection Act
                (DPDP) and marketplace dispute guarantees.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDlg21Open(false)}
              className="rounded-xl border-[#E7E0D5] text-xs font-bold"
            >
              Later
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsDlg21Open(false);
                setCurrentView('request');
              }}
              className="bg-[#FFD64A] text-[#14110F] font-bold hover:bg-[#F5CB35] rounded-xl text-xs"
            >
              Begin Verification (C13) →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
