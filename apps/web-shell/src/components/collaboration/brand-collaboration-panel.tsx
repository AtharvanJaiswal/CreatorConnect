'use client';

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@creatorconnect/ui';
import {
  Users,
  Plus,
  Send,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { ShortlistResponse, InvitationResponse } from '@creatorconnect/contracts';
import { collaborationWorkflowService } from '../../lib/collaboration-workflow-service';

export function BrandCollaborationPanel() {
  const [activeSubTab, setActiveSubTab] = useState<'shortlists' | 'invitations'>('shortlists');
  const [shortlists, setShortlists] = useState<ShortlistResponse[]>([]);
  const [selectedShortlist, setSelectedShortlist] = useState<ShortlistResponse | null>(null);
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New shortlist form state
  const [showNewShortlistModal, setShowNewShortlistModal] = useState(false);
  const [newShortlistName, setNewShortlistName] = useState('');
  const [newShortlistDesc, setNewShortlistDesc] = useState('');
  const [isSubmittingShortlist, setIsSubmittingShortlist] = useState(false);

  // Invite creator modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteTargetCreatorId, setInviteTargetCreatorId] = useState<string | null>(null);
  const [inviteTargetCreatorName, setInviteTargetCreatorName] = useState<string>('');
  const [inviteProjectId, setInviteProjectId] = useState<string>('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [shortlistsRes, invitesRes] = await Promise.all([
        collaborationWorkflowService.listShortlists().catch(() => ({ items: [], total: 0 })),
        collaborationWorkflowService
          .listSentInvitations()
          .catch(() => ({ items: [], nextCursor: null, total: 0 })),
      ]);
      setShortlists(shortlistsRes.items);
      setInvitations(invitesRes.items);
      if (shortlistsRes.items.length > 0 && !selectedShortlist) {
        setSelectedShortlist(shortlistsRes.items[0] || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load collaboration data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShortlist(e: React.FormEvent) {
    e.preventDefault();
    if (!newShortlistName.trim()) return;

    setIsSubmittingShortlist(true);
    setError(null);
    try {
      const payload: { name: string; description?: string } = {
        name: newShortlistName.trim(),
      };
      if (newShortlistDesc.trim()) {
        payload.description = newShortlistDesc.trim();
      }
      const created = await collaborationWorkflowService.createShortlist(payload);
      setShortlists([created, ...shortlists]);
      setSelectedShortlist(created);
      setNewShortlistName('');
      setNewShortlistDesc('');
      setShowNewShortlistModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create shortlist.');
    } finally {
      setIsSubmittingShortlist(false);
    }
  }

  async function handleDeleteShortlist(id: string) {
    if (!confirm('Are you sure you want to delete this shortlist?')) return;
    try {
      await collaborationWorkflowService.deleteShortlist(id);
      const remaining = shortlists.filter((s) => s.id !== id);
      setShortlists(remaining);
      setSelectedShortlist(remaining[0] || null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete shortlist.');
    }
  }

  async function handleRemoveMember(shortlistId: string, creatorId: string) {
    try {
      await collaborationWorkflowService.removeShortlistMember(shortlistId, creatorId);
      // Reload shortlist
      const updated = await collaborationWorkflowService.getShortlist(shortlistId);
      setSelectedShortlist(updated);
      setShortlists(shortlists.map((s) => (s.id === shortlistId ? updated : s)));
    } catch (err: any) {
      setError(err.message || 'Failed to remove creator from shortlist.');
    }
  }

  async function handleSendInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteTargetCreatorId || !inviteProjectId.trim() || !inviteMessage.trim()) return;

    setIsSubmittingInvite(true);
    setError(null);
    try {
      const created = await collaborationWorkflowService.createInvitation({
        projectId: inviteProjectId.trim(),
        creatorId: inviteTargetCreatorId,
        message: inviteMessage.trim(),
        expiresInDays: 7,
      });
      setInvitations([created, ...invitations]);
      setInviteModalOpen(false);
      setInviteMessage('');
      setInviteProjectId('');
    } catch (err: any) {
      setError(err.message || 'Failed to send hiring invitation.');
    } finally {
      setIsSubmittingInvite(false);
    }
  }

  async function handleWithdrawInvitation(invitationId: string) {
    if (!confirm('Withdraw this pending invitation?')) return;
    try {
      await collaborationWorkflowService.withdrawInvitation(invitationId);
      setInvitations(
        invitations.map((inv) =>
          inv.id === invitationId ? { ...inv, status: 'WITHDRAWN' as any } : inv,
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to withdraw invitation.');
    }
  }

  function openInviteDialog(creatorId: string, creatorName: string) {
    setInviteTargetCreatorId(creatorId);
    setInviteTargetCreatorName(creatorName);
    setInviteModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Sub-Tabs: Shortlists vs Sent Invitations */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('shortlists')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'shortlists'
                ? 'bg-[#14110F] text-white shadow-xs'
                : 'text-[#5C564E] hover:bg-[#FAF7F2]'
            }`}
          >
            Saved Shortlists ({shortlists.length})
          </button>
          <button
            onClick={() => setActiveSubTab('invitations')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'invitations'
                ? 'bg-[#14110F] text-white shadow-xs'
                : 'text-[#5C564E] hover:bg-[#FAF7F2]'
            }`}
          >
            Hiring Invitations ({invitations.length})
          </button>
        </div>

        {activeSubTab === 'shortlists' && (
          <Button
            size="sm"
            onClick={() => setShowNewShortlistModal(true)}
            className="gap-1.5 shadow-sm bg-[#FFD64A] text-[#14110F] hover:bg-[#E0A800] font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Shortlist</span>
          </Button>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading collaboration workspace...</span>
        </div>
      ) : activeSubTab === 'shortlists' ? (
        /* SHORTLISTS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Shortlist Collections List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C8479]">
              Your Shortlists
            </h3>

            {shortlists.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground text-xs space-y-2">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p>No shortlists created yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewShortlistModal(true)}
                  className="text-xs"
                >
                  Create First Shortlist
                </Button>
              </Card>
            ) : (
              shortlists.map((sl) => (
                <div
                  key={sl.id}
                  onClick={async () => {
                    const full = await collaborationWorkflowService.getShortlist(sl.id);
                    setSelectedShortlist(full);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    selectedShortlist?.id === sl.id
                      ? 'bg-white border-[#E0A800] shadow-sm'
                      : 'bg-[#FAF7F2] border-[#EDE7DE] hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-[#121212]">{sl.name}</h4>
                      {sl.description && (
                        <p className="text-xs text-[#6B655C] line-clamp-1 mt-0.5">
                          {sl.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {sl.memberCount} talent
                    </Badge>
                  </div>
                  {sl.project && (
                    <div className="mt-2 text-[11px] text-[#7A5B00] bg-[#FFF6D9] px-2 py-0.5 rounded-md inline-block">
                      Project: {sl.project.title}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right: Selected Shortlist Details & Member Roster */}
          <div className="lg:col-span-2 space-y-4">
            {selectedShortlist ? (
              <Card className="p-6 space-y-6">
                <div className="flex items-start justify-between border-b border-[#EDE7DE] pb-4">
                  <div>
                    <h2 className="font-heading font-bold text-xl text-[#121212]">
                      {selectedShortlist.name}
                    </h2>
                    {selectedShortlist.description && (
                      <p className="text-xs text-[#6B655C] mt-1">{selectedShortlist.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteShortlist(selectedShortlist.id)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 gap-1 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Shortlist</span>
                  </Button>
                </div>

                {/* Member Roster */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C8479]">
                    Shortlisted Talent ({selectedShortlist.members?.length || 0})
                  </h3>

                  {!selectedShortlist.members || selectedShortlist.members.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs space-y-2 border border-dashed border-[#EDE7DE] rounded-2xl">
                      <Sparkles className="h-6 w-6 mx-auto text-[#FFCE38]" />
                      <p>No creators added to this shortlist yet.</p>
                      <p className="text-[11px] text-[#8C8479]">
                        Explore Discovery and click &ldquo;Save&rdquo; or add creators to this
                        shortlist.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedShortlist.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 rounded-2xl border border-[#EDE7DE] bg-[#FAF7F2] hover:bg-white transition-all gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#FFD64A]/20 border border-[#FFD64A]/40 flex items-center justify-center font-bold text-xs text-[#14110F] shrink-0">
                              {member.creator.avatarUrl ? (
                                <img
                                  src={member.creator.avatarUrl}
                                  alt={member.creator.displayName}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                member.creator.displayName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-heading font-bold text-sm text-[#121212]">
                                  {member.creator.displayName}
                                </h4>
                                {member.creator.creatorProfile?.isVerified && (
                                  <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                                )}
                              </div>
                              <p className="text-[11px] text-[#6B655C] line-clamp-1">
                                {member.creator.creatorProfile?.tagline || 'Verified Creator'}
                              </p>
                              {member.note && (
                                <p className="text-[10px] text-[#8C8479] italic mt-0.5">
                                  Note: &ldquo;{member.note}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() =>
                                openInviteDialog(member.creator.id, member.creator.displayName)
                              }
                              className="text-xs gap-1 font-semibold bg-[#FFD64A] text-[#14110F] hover:bg-[#E0A800]"
                            >
                              <Send className="h-3 w-3" />
                              <span>Invite</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleRemoveMember(selectedShortlist.id, member.creatorId)
                              }
                              className="text-xs text-muted-foreground hover:text-red-600"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center text-muted-foreground text-xs">
                Select a shortlist on the left or create a new one to view details.
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* SENT INVITATIONS VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C8479]">
              Outgoing Project Invitations
            </h3>
            <span className="text-xs text-muted-foreground">{invitations.length} Total</span>
          </div>

          {invitations.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-xs space-y-2">
              <Send className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p>No project invitations sent yet.</p>
              <p className="text-[11px] text-[#8C8479]">
                Invite talent directly from your shortlists or candidate profiles.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => (
                <Card key={inv.id} className="p-5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading font-bold text-sm text-[#121212]">
                        {inv.project.title}
                      </h4>
                      {inv.status === 'PENDING' && (
                        <Badge variant="warning" className="text-[10px] gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <span>Pending Response</span>
                        </Badge>
                      )}
                      {inv.status === 'ACCEPTED' && (
                        <Badge variant="success" className="text-[10px] gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>Accepted</span>
                        </Badge>
                      )}
                      {inv.status === 'DECLINED' && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <XCircle className="h-2.5 w-2.5" />
                          <span>Declined</span>
                        </Badge>
                      )}
                      {inv.status === 'WITHDRAWN' && (
                        <Badge variant="secondary" className="text-[10px]">
                          Withdrawn
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#5C564E]">
                      Invited:{' '}
                      <span className="font-semibold text-[#14110F]">
                        {inv.invitee.displayName}
                      </span>{' '}
                      • Budget: ₹{inv.project.totalAmount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] text-[#8C8479] italic line-clamp-1">
                      &ldquo;{inv.message}&rdquo;
                    </p>
                  </div>

                  {inv.status === 'PENDING' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWithdrawInvitation(inv.id)}
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
                    >
                      Withdraw
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Create New Shortlist */}
      {showNewShortlistModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-5 border border-[#EDE7DE]">
            <div>
              <h3 className="font-heading font-bold text-lg text-[#121212]">
                Create New Shortlist
              </h3>
              <p className="text-xs text-[#6B655C] mt-1">
                Organize creators into campaign-specific rosters or backup talent lists.
              </p>
            </div>

            <form onSubmit={handleCreateShortlist} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#14110F] block mb-1">
                  Shortlist Name *
                </label>
                <input
                  type="text"
                  required
                  value={newShortlistName}
                  onChange={(e) => setNewShortlistName(e.target.value)}
                  placeholder="e.g. Diwali Campaign Lead Talent"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#EDE7DE] focus:outline-hidden focus:border-[#E0A800]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14110F] block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={newShortlistDesc}
                  onChange={(e) => setNewShortlistDesc(e.target.value)}
                  placeholder="Brief context about this talent collection..."
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#EDE7DE] focus:outline-hidden focus:border-[#E0A800]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewShortlistModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingShortlist || !newShortlistName.trim()}
                  className="text-xs font-semibold bg-[#FFD64A] text-[#14110F] hover:bg-[#E0A800]"
                >
                  {isSubmittingShortlist ? 'Creating...' : 'Create Shortlist'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Send Hiring Invitation */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-5 border border-[#EDE7DE]">
            <div>
              <h3 className="font-heading font-bold text-lg text-[#121212]">
                Invite {inviteTargetCreatorName}
              </h3>
              <p className="text-xs text-[#6B655C] mt-1">
                Extend a formal project collaboration invitation. The creator will be notified
                in-app.
              </p>
            </div>

            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#14110F] block mb-1">
                  Project UUID *
                </label>
                <input
                  type="text"
                  required
                  value={inviteProjectId}
                  onChange={(e) => setInviteProjectId(e.target.value)}
                  placeholder="Paste active Project UUID"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#EDE7DE] focus:outline-hidden focus:border-[#E0A800]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14110F] block mb-1">
                  Invitation Message *
                </label>
                <textarea
                  required
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Hi! We loved your portfolio and would like to invite you to collaborate on our upcoming campaign..."
                  rows={4}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#EDE7DE] focus:outline-hidden focus:border-[#E0A800]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInviteModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingInvite || !inviteProjectId.trim() || !inviteMessage.trim()}
                  className="text-xs font-semibold bg-[#FFD64A] text-[#14110F] hover:bg-[#E0A800] gap-1"
                >
                  <Send className="h-3 w-3" />
                  <span>{isSubmittingInvite ? 'Sending...' : 'Send Invitation'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
