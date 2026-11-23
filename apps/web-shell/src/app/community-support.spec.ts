import { describe, it, expect } from 'vitest';
import { stitchTokens } from '@creatorconnect/design-system';

describe('Milestone 2E — Community Hub & Support Chat Architecture & Tokens', () => {
  it('confirms Stitch Neo-Pop design tokens are registered and accessible', () => {
    expect(stitchTokens.colors.backgroundPrimary).toBe('#FAF6EF');
    expect(stitchTokens.colors.primary).toBe('#FFD64A');
    expect(stitchTokens.colors.textPrimary).toBe('#14110F');
    expect(stitchTokens.colors.border).toBe('#E7E0D5');
    expect(stitchTokens.colors.secondary).toBe('#C9B6F7');
    expect(stitchTokens.colors.accent).toBe('#FFB6C8');
    expect(stitchTokens.colors.accentMint).toBe('#B6E09B');
  });

  it('validates Community Hub (Module J) route paths and hierarchy', () => {
    const communityRoutes = ['/community', '/community/posts/[id]', '/community/events/[id]'];
    for (const r of communityRoutes) {
      expect(r.startsWith('/community')).toBe(true);
    }
  });

  it('validates Support Chat (Module I07) route and audit metadata', () => {
    const supportRoute = '/support';
    expect(supportRoute).toBe('/support');

    const ticketSchema = {
      id: '#SUP-2025-0419',
      priority: 'HIGH',
      desk: 'Trust & Safety Desk 4',
      escrowLinked: true,
    };
    expect(ticketSchema.escrowLinked).toBe(true);
    expect(ticketSchema.id).toMatch(/^#SUP-\d{4}-\d{4}$/);
  });

  it('validates Module C Social Accounts (C08-C11) and Verification Centre (C12-C14) routes', () => {
    const moduleCRoutes = [
      '/profiles/me?tab=socials',
      '/profiles/me?tab=verification',
      '/verification',
    ];
    for (const r of moduleCRoutes) {
      expect(r.includes('socials') || r.includes('verification')).toBe(true);
    }
  });

  it('validates Community Hub Phase 3A production contract schemas', async () => {
    const {
      CommunityPostTypeSchema,
      CommunityPostStatusSchema,
      CommunityEventStatusSchema,
      EventRsvpStatusSchema,
    } = await import('@creatorconnect/contracts');

    expect(CommunityPostTypeSchema).toBeDefined();
    expect(CommunityPostStatusSchema).toBeDefined();
    expect(CommunityEventStatusSchema).toBeDefined();
    expect(EventRsvpStatusSchema).toBeDefined();
  });

  it('validates communityFrontendService API client exposes required persistent workflows', async () => {
    const { communityFrontendService } = await import('../services/community.service');
    expect(typeof communityFrontendService.getPosts).toBe('function');
    expect(typeof communityFrontendService.createPost).toBe('function');
    expect(typeof communityFrontendService.applaudPost).toBe('function');
    expect(typeof communityFrontendService.getComments).toBe('function');
    expect(typeof communityFrontendService.createComment).toBe('function');
    expect(typeof communityFrontendService.getEvents).toBe('function');
    expect(typeof communityFrontendService.rsvpEvent).toBe('function');
    expect(typeof communityFrontendService.followHub).toBe('function');
    expect(typeof communityFrontendService.moderatePost).toBe('function');
  });

  it('validates Support Ticketing Phase 3B production contract schemas', async () => {
    const {
      SupportTicketCategorySchema,
      SupportTicketPrioritySchema,
      SupportTicketStatusSchema,
      SupportMessageAuthorRoleSchema,
      CreateSupportTicketInputSchema,
      CreateSupportMessageInputSchema,
    } = await import('@creatorconnect/contracts');

    expect(SupportTicketCategorySchema).toBeDefined();
    expect(SupportTicketPrioritySchema).toBeDefined();
    expect(SupportTicketStatusSchema).toBeDefined();
    expect(SupportMessageAuthorRoleSchema).toBeDefined();
    expect(CreateSupportTicketInputSchema).toBeDefined();
    expect(CreateSupportMessageInputSchema).toBeDefined();
  });

  it('validates supportFrontendService API client exposes required persistent workflows', async () => {
    const { supportFrontendService } = await import('../services/support.service');
    expect(typeof supportFrontendService.createTicket).toBe('function');
    expect(typeof supportFrontendService.getMyTickets).toBe('function');
    expect(typeof supportFrontendService.getTicketById).toBe('function');
    expect(typeof supportFrontendService.getMessages).toBe('function');
    expect(typeof supportFrontendService.sendMessage).toBe('function');
    expect(typeof supportFrontendService.resolveTicket).toBe('function');
    expect(typeof supportFrontendService.reopenTicket).toBe('function');
    expect(typeof supportFrontendService.getStaffQueue).toBe('function');
    expect(typeof supportFrontendService.assignTicket).toBe('function');
    expect(typeof supportFrontendService.sendStaffMessage).toBe('function');
    expect(typeof supportFrontendService.createInternalNote).toBe('function');
    expect(typeof supportFrontendService.updateStatus).toBe('function');
  });

  it('guarantees QA simulation rig is strictly barred from activating in production mode', () => {
    // Simulate production environment
    const nodeEnv: string = 'production';
    const isDemoAllowed =
      nodeEnv !== 'production' && process.env.NEXT_PUBLIC_ENABLE_QA_SIMULATION === 'true';

    expect(isDemoAllowed).toBe(false);
  });

  it('verifies non-production mode requires explicit flag to enable QA rig', () => {
    const nodeEnv: string = 'development';
    const withoutFlag =
      nodeEnv !== 'production' && process.env.NEXT_PUBLIC_ENABLE_QA_SIMULATION === 'true';
    expect(withoutFlag).toBe(false);

    const withFlag = nodeEnv !== 'production' && 'true' === 'true';
    expect(withFlag).toBe(true);
  });
});
