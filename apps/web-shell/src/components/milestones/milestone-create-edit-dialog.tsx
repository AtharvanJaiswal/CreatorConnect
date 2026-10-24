'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertTriangle, Flag } from 'lucide-react';
import type {
  ProjectDeliverableResponse,
  CreateProjectDeliverableInput,
  UpdateProjectDeliverableInput,
} from '@creatorconnect/contracts';
import { createMilestone, updateMilestone } from '../../lib/milestone-workflow-service';

interface MilestoneCreateEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  milestoneToEdit?: ProjectDeliverableResponse | null;
  currency?: string;
  accessToken?: string | null;
}

export function MilestoneCreateEditDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  milestoneToEdit,
  currency = 'INR',
  accessToken,
}: MilestoneCreateEditDialogProps) {
  const isEditing = Boolean(milestoneToEdit);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (milestoneToEdit) {
        setTitle(milestoneToEdit.title || '');
        setDescription(milestoneToEdit.description || '');
        setAmount(milestoneToEdit.amount ? String(milestoneToEdit.amount) : '');
        setDueDate(milestoneToEdit.dueDate ? milestoneToEdit.dueDate.slice(0, 10) : '');
      } else {
        setTitle('');
        setDescription('');
        setAmount('');
        setDueDate('');
      }
      setError(null);
    }
  }, [isOpen, milestoneToEdit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid milestone amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && milestoneToEdit) {
        const updatePayload: UpdateProjectDeliverableInput = {
          title: title.trim(),
          amount: parsedAmount,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
        };
        await updateMilestone(projectId, milestoneToEdit.id, updatePayload, accessToken);
      } else {
        const createPayload: CreateProjectDeliverableInput = {
          title: title.trim(),
          amount: parsedAmount,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
        };
        await createMilestone(projectId, createPayload, accessToken);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save milestone.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-form-dialog-title"
    >
      <div className="relative w-full max-w-[500px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider mb-2">
            <Flag className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Edit Milestone' : 'New Milestone'}</span>
          </div>

          <h2
            id="milestone-form-dialog-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight"
          >
            {isEditing ? 'Update Milestone Parameters' : 'Add Project Milestone'}
          </h2>
          <p className="text-sm text-[#6F675E] mt-1">
            Define deliverables, financial allocation, and completion deadlines.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="milestone-title"
              className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5"
            >
              Milestone Title <span className="text-[#D8483C]">*</span>
            </label>
            <input
              id="milestone-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rough Cut Video Assembly"
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder-[#A39A8F] focus:outline-none focus:border-[#FFD64A] focus:ring-1 focus:ring-[#FFD64A]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="milestone-desc"
              className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5"
            >
              Description & Scope
            </label>
            <textarea
              id="milestone-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify requirements, deliverables, video duration, platform formats..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder-[#A39A8F] focus:outline-none focus:border-[#FFD64A] focus:ring-1 focus:ring-[#FFD64A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="milestone-amount"
                className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5"
              >
                Allocated Amount ({currency}) <span className="text-[#D8483C]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6F675E]">
                  ₹
                </span>
                <input
                  id="milestone-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="25000"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder-[#A39A8F] focus:outline-none focus:border-[#FFD64A] focus:ring-1 focus:ring-[#FFD64A]"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="milestone-due"
                className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5"
              >
                Target Due Date
              </label>
              <div className="relative">
                <input
                  id="milestone-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] focus:outline-none focus:border-[#FFD64A] focus:ring-1 focus:ring-[#FFD64A]"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-[#FCE8E6] border border-[#D8483C] text-xs text-[#D8483C] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#6F675E] hover:text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] text-xs font-bold shadow-sm disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Milestone'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
