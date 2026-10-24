'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Send,
  Save,
} from 'lucide-react';
import {
  assignmentsWorkflowService,
  formatMinorUnitsToCurrency,
} from '../../../lib/assignments-workflow-service';
import { useAuth } from '../../../providers/auth-provider';
import type { CreateAssignmentInput } from '@creatorconnect/contracts';

const CATEGORIES = [
  { id: 'directing', label: 'Directing & Filmmaking' },
  { id: 'video-editing', label: 'Video Editing & Post-Production' },
  { id: 'sound-design', label: 'Sound Engineering & Audio Design' },
  { id: 'motion-graphics', label: 'Motion Graphics & 3D Animation' },
  { id: 'podcast', label: 'Podcast Production & Audio Shows' },
  { id: 'other', label: 'Other Creative Commission' },
];

export default function CreateAssignmentWizardPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('directing');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState('Direct Brand Commission');
  const [isRemote, setIsRemote] = useState(true);
  const [location, setLocation] = useState('');

  // Requirements / Deliverables
  const [requirements, setRequirements] = useState<Array<{ title: string; isMandatory: boolean }>>([
    { title: 'Final 4K Master Video File', isMandatory: true },
    { title: 'Project Source Assets & Timeline Archives', isMandatory: false },
  ]);
  const [newRequirement, setNewRequirement] = useState('');

  // Budget & Timeline
  const [budgetType, setBudgetTypeFilter] = useState<'RANGE' | 'FIXED'>('RANGE');
  const [budgetMinRupees, setBudgetMinRupees] = useState(75000);
  const [budgetMaxRupees, setBudgetMaxRupees] = useState(120000);
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );

  const addRequirement = () => {
    if (!newRequirement.trim()) return;
    setRequirements([...requirements, { title: newRequirement.trim(), isMandatory: true }]);
    setNewRequirement('');
  };

  const removeRequirement = (idx: number) => {
    setRequirements(requirements.filter((_, i) => i !== idx));
  };

  const validateStep = (currentStep: number): boolean => {
    setError(null);
    if (currentStep === 1) {
      if (!title.trim()) {
        setError('Please enter a clear, descriptive assignment title.');
        return false;
      }
      if (!description.trim() || description.trim().length < 20) {
        setError('Please enter a creative brief of at least 20 characters.');
        return false;
      }
    } else if (currentStep === 2) {
      if (requirements.length === 0) {
        setError('Please define at least one required deliverable or skill.');
        return false;
      }
    } else if (currentStep === 3) {
      if (budgetMinRupees <= 0) {
        setError('Minimum budget must be greater than zero.');
        return false;
      }
      if (budgetType === 'RANGE' && budgetMaxRupees < budgetMinRupees) {
        setError('Maximum budget must be equal to or greater than minimum budget.');
        return false;
      }
      if (!deadline) {
        setError('Please specify a submission deadline.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4) as any);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1) as any);
  };

  const handlePublish = async (shouldPublishDirectly: boolean) => {
    setError(null);
    setSubmitting(true);

    try {
      const budgetMinPaise = Math.round(budgetMinRupees * 100);
      const budgetMaxPaise =
        budgetType === 'FIXED' ? budgetMinPaise : Math.round(budgetMaxRupees * 100);

      const payload: CreateAssignmentInput = {
        title: title.trim(),
        description: description.trim(),
        budgetType,
        budgetMin: budgetMinPaise,
        budgetMax: budgetMaxPaise,
        currency: 'INR',
        deadline: new Date(deadline + 'T23:59:59Z').toISOString(),
        isRemote,
        ...(isRemote ? {} : { location: location.trim() || 'On Location' }),
        requirements: requirements.map((r) => ({
          title: r.title,
          isMandatory: r.isMandatory,
        })),
      };

      const created = await assignmentsWorkflowService.createAssignment(
        payload,
        accessToken || undefined,
      );

      if (shouldPublishDirectly) {
        await assignmentsWorkflowService.publishAssignment(
          created.id,
          created.version,
          accessToken || undefined,
        );
      }

      router.push(`/assignments/${created.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save assignment brief.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] antialiased py-8 px-4 sm:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Top Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/assignments"
            className="flex items-center gap-1.5 text-xs font-bold text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD64A] bg-[#FFD64A]/20 px-3.5 py-1 text-xs font-bold text-[#875A00]">
            <Sparkles className="h-3.5 w-3.5 text-[#875A00]" />
            Google Stitch G05 / G06 · Assignment Builder
          </div>
        </div>

        {/* Wizard Card Container */}
        <div className="rounded-[28px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 sm:p-10 shadow-2xs">
          {/* Step Progress Tracker */}
          <div className="mb-8 border-b border-[#E7E0D5] pb-6">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#A39A8F] mb-3">
              <span>Step 0{step} of 04</span>
              <span className="text-[#875A00]">
                {step === 1 && 'Creative Brief & Scope'}
                {step === 2 && 'Deliverables & Skills'}
                {step === 3 && 'Remuneration & Timeline'}
                {step === 4 && 'Pre-Flight Review & Publish'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s <= step ? 'bg-[#FFD64A]' : 'bg-[#F2ECE1]'
                  }`}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[#FFB6C8] bg-[#FFB6C8]/15 p-4 text-xs font-bold text-[#A02842]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================
               STEP 1: CREATIVE BRIEF BASICS (G05)
               ======================================================== */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-heading font-black text-2xl text-[#14110F]">
                  Define the Creative{' '}
                  <span className="font-serif italic font-normal text-[#6F675E]">Assignment</span>
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#6F675E]">
                  Provide a concise title and structured scope of work so verified talent can assess
                  fit.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Lead Field Director for 4-Part Craft Heritage Docuseries"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3.5 text-sm text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-[#14110F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                    Primary Creative Discipline *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3.5 text-sm text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                    Commissioning Entity
                  </label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3.5 text-sm text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                  >
                    <option value="Direct Brand Commission">Direct Brand Commission</option>
                    <option value="Independent Studio / Production House">
                      Independent Studio / Production House
                    </option>
                    <option value="Lead Creator Collaboration">Lead Creator Collaboration</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                  Creative Scope of Work & Narrative Brief *
                </label>
                <textarea
                  rows={6}
                  placeholder="Describe project background, visual style, key narrative beats, format requirements, and timeline expectations..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-4 text-sm text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-[#14110F]"
                />
              </div>
            </div>
          )}

          {/* ========================================================
               STEP 2: DELIVERABLES & REQUIREMENTS (G05)
               ======================================================== */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-heading font-black text-2xl text-[#14110F]">
                  Required{' '}
                  <span className="font-serif italic font-normal text-[#6F675E]">Deliverables</span>{' '}
                  & Scope
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#6F675E]">
                  Itemize every deliverable milestone that must be completed for contract sign-off.
                </p>
              </div>

              {/* Deliverable Items List */}
              <div className="space-y-2.5">
                {requirements.map((req, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-[#2E9E6B]" />
                      <span className="text-sm font-semibold text-[#14110F]">{req.title}</span>
                      {req.isMandatory && (
                        <span className="rounded-full bg-[#FFD64A]/30 px-2 py-0.5 text-[10px] font-bold text-[#875A00]">
                          Mandatory
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeRequirement(idx)}
                      className="text-[#A39A8F] hover:text-[#A02842] transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Deliverable */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Color Grade XML & DaVinci Project Archive"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                  className="flex-1 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] px-4 py-2.5 text-sm text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addRequirement}
                  className="flex items-center gap-1.5 rounded-2xl bg-[#14110F] px-4 py-2.5 text-xs font-bold text-[#FFFFFF] hover:bg-[#2C2724] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {/* Remote / Location Settings */}
              <div className="border-t border-[#E7E0D5] pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRemote}
                    onChange={(e) => setIsRemote(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#14110F]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#14110F]">100% Remote Workflow</span>
                    <p className="text-[11px] text-[#6F675E]">
                      Collaborator delivers work digitally without on-set attendance requirements.
                    </p>
                  </div>
                </label>

                {!isRemote && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                      Shooting / Production Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Mumbai, Maharashtra · Studio 4"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3 text-sm text-[#14110F]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
               STEP 3: REMUNERATION & TIMELINE (G05)
               ======================================================== */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-heading font-black text-2xl text-[#14110F]">
                  Escrow Budget &{' '}
                  <span className="font-serif italic font-normal text-[#6F675E]">Deadlines</span>
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#6F675E]">
                  Transparent compensation backed by platform escrow protects both creator and
                  commissioning brand.
                </p>
              </div>

              {/* Budget Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2.5">
                  Compensation Model
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      id: 'RANGE',
                      title: 'Target Budget Range',
                      sub: 'Specify minimum and maximum parameters',
                    },
                    {
                      id: 'FIXED',
                      title: 'Fixed Project Escrow',
                      sub: 'Single contractual disbursement fee',
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBudgetTypeFilter(item.id as any)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        budgetType === item.id
                          ? 'border-[#14110F] bg-[#FAF6EF] shadow-2xs'
                          : 'border-[#E7E0D5] bg-[#FFFFFF] hover:bg-[#F2ECE1]'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#14110F]">{item.title}</div>
                      <div className="text-[11px] text-[#6F675E] mt-0.5">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                    {budgetType === 'RANGE' ? 'Minimum Fee (INR ₹)' : 'Total Project Fee (INR ₹)'}
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={5000}
                    value={budgetMinRupees}
                    onChange={(e) => setBudgetMinRupees(Number(e.target.value))}
                    className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3.5 text-sm font-mono font-bold text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                  <span className="text-[11px] text-[#6F675E] mt-1 block">
                    {formatMinorUnitsToCurrency(budgetMinRupees * 100, 'INR')}
                  </span>
                </div>

                {budgetType === 'RANGE' && (
                  <div>
                    <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                      Maximum Fee (INR ₹)
                    </label>
                    <input
                      type="number"
                      min={budgetMinRupees}
                      step={5000}
                      value={budgetMaxRupees}
                      onChange={(e) => setBudgetMaxRupees(Number(e.target.value))}
                      className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3.5 text-sm font-mono font-bold text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                    />
                    <span className="text-[11px] text-[#6F675E] mt-1 block">
                      {formatMinorUnitsToCurrency(budgetMaxRupees * 100, 'INR')}
                    </span>
                  </div>
                )}
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                  Proposals Submission Deadline *
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3.5 text-sm text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================
               STEP 4: PRE-FLIGHT REVIEW & PUBLISH (G06)
               ======================================================== */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-heading font-black text-2xl text-[#14110F]">
                  Pre-Flight{' '}
                  <span className="font-serif italic font-normal text-[#6F675E]">
                    Review & Confirmation
                  </span>
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#6F675E]">
                  Verify your brief parameters before committing it to the public marketplace.
                </p>
              </div>

              {/* Summary Card */}
              <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FAF6EF] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#875A00]">
                    {category.toUpperCase()} · {entityType}
                  </span>
                  <span className="text-xs font-bold text-[#2E9E6B]">
                    {isRemote ? '🌐 Remote Collaboration' : `📍 ${location}`}
                  </span>
                </div>

                <h3 className="font-heading font-black text-xl text-[#14110F]">{title}</h3>
                <p className="text-xs sm:text-sm text-[#6F675E] whitespace-pre-line">
                  {description}
                </p>

                {/* Deliverables Checklist */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#A39A8F] mb-2">
                    Key Deliverables ({requirements.length})
                  </div>
                  <div className="space-y-1.5">
                    {requirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#14110F]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2E9E6B]" />
                        <span>{req.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="rounded-2xl border border-[#E7E0D5] bg-[#FFFFFF] p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
                      Committed Escrow Range
                    </span>
                    <div className="font-heading font-black text-lg text-[#14110F]">
                      {budgetType === 'RANGE'
                        ? `${formatMinorUnitsToCurrency(budgetMinRupees * 100, 'INR')} - ${formatMinorUnitsToCurrency(budgetMaxRupees * 100, 'INR')}`
                        : formatMinorUnitsToCurrency(budgetMinRupees * 100, 'INR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
                      Deadline
                    </span>
                    <div className="text-xs font-bold text-[#14110F] flex items-center gap-1 justify-end">
                      <Calendar className="h-3.5 w-3.5 text-[#6F675E]" />
                      {new Date(deadline || Date.now()).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
               WIZARD CONTROLS
               ======================================================== */}
          <div className="mt-8 border-t border-[#E7E0D5] pt-6 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="flex items-center gap-2 rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-5 py-2.5 text-xs font-bold text-[#14110F] hover:bg-[#F2ECE1] transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous Step
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 rounded-full bg-[#14110F] px-6 py-2.5 text-xs font-bold text-[#FFFFFF] hover:bg-[#2C2724] transition-all shadow-2xs"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePublish(false)}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-5 py-2.5 text-xs font-bold text-[#14110F] hover:bg-[#F2ECE1] transition-all"
                >
                  <Save className="h-4 w-4 text-[#6F675E]" />
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handlePublish(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-full bg-[#FFD64A] px-6 py-2.5 text-xs font-bold text-[#14110F] hover:bg-[#F5CB35] transition-all shadow-2xs"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Publishing...' : 'Publish Brief to Marketplace'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
