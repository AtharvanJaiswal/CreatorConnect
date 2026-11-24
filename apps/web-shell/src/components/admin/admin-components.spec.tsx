import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminButton } from './ui/AdminButton';
import { AdminBadge } from './ui/AdminBadge';
import { PermissionGate } from './ui/PermissionGate';

// Mock the auth provider hook
const mockUseAuth = vi.fn();
vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Admin UI Primitives & Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AdminButton', () => {
    it('renders with default primary warm yellow styling', () => {
      const html = renderToStaticMarkup(<AdminButton>Save Changes</AdminButton>);
      expect(html).toContain('Save Changes');
      expect(html).toContain('bg-[#FFD64A]');
      expect(html).toContain('rounded-full');
      expect(html).toContain('font-sans-body');
    });

    it('renders dark, secondary, danger, and ghost variants', () => {
      const darkHtml = renderToStaticMarkup(<AdminButton variant="dark">Dark Action</AdminButton>);
      expect(darkHtml).toContain('bg-[#14110F]');
      expect(darkHtml).toContain('text-white');

      const secondaryHtml = renderToStaticMarkup(
        <AdminButton variant="secondary">Cancel</AdminButton>,
      );
      expect(secondaryHtml).toContain('bg-[#F2ECE1]');

      const dangerHtml = renderToStaticMarkup(
        <AdminButton variant="danger">Delete Account</AdminButton>,
      );
      expect(dangerHtml).toContain('bg-[#D8483C]');

      const ghostHtml = renderToStaticMarkup(<AdminButton variant="ghost">Dismiss</AdminButton>);
      expect(ghostHtml).toContain('border-transparent');
    });

    it('renders loading spinner and disables button when loading is true', () => {
      const html = renderToStaticMarkup(<AdminButton loading>Processing</AdminButton>);
      expect(html).toContain('disabled=""');
      expect(html).toContain('animate-spin');
    });

    it('renders custom icon when provided', () => {
      const html = renderToStaticMarkup(
        <AdminButton icon={<span data-testid="custom-icon">+</span>}>Add Item</AdminButton>,
      );
      expect(html).toContain('data-testid="custom-icon"');
      expect(html).toContain('Add Item');
    });
  });

  describe('AdminBadge', () => {
    it('renders neutral badge by default', () => {
      const html = renderToStaticMarkup(<AdminBadge>Standard</AdminBadge>);
      expect(html).toContain('Standard');
      expect(html).toContain('bg-[#F2ECE1]');
      expect(html).toContain('text-[#6F675E]');
    });

    it('renders status variants correctly', () => {
      const successHtml = renderToStaticMarkup(<AdminBadge variant="success">Active</AdminBadge>);
      expect(successHtml).toContain('bg-[#E6F4EC]');
      expect(successHtml).toContain('text-[#2E9E6B]');

      const warningHtml = renderToStaticMarkup(<AdminBadge variant="warning">Pending</AdminBadge>);
      expect(warningHtml).toContain('bg-[#FBF1DC]');
      expect(warningHtml).toContain('text-[#C98A16]');

      const dangerHtml = renderToStaticMarkup(<AdminBadge variant="danger">Suspended</AdminBadge>);
      expect(dangerHtml).toContain('bg-[#FBE9E7]');
      expect(dangerHtml).toContain('text-[#D8483C]');

      const brandHtml = renderToStaticMarkup(<AdminBadge variant="brand">Verified</AdminBadge>);
      expect(brandHtml).toContain('bg-[#FFF8D6]');
      expect(brandHtml).toContain('text-[#7A5B00]');
    });

    it('renders status dot indicator when dot is enabled', () => {
      const html = renderToStaticMarkup(
        <AdminBadge variant="success" dot>
          Online
        </AdminBadge>,
      );
      expect(html).toContain('rounded-full');
      expect(html).toContain('bg-[#2E9E6B]');
    });
  });

  describe('PermissionGate', () => {
    it('renders fallback when user is unauthenticated', () => {
      mockUseAuth.mockReturnValue({ user: null });

      const html = renderToStaticMarkup(
        <PermissionGate fallback={<div>Sign In Required</div>}>
          <div>Protected Content</div>
        </PermissionGate>,
      );

      expect(html).toContain('Sign In Required');
      expect(html).not.toContain('Protected Content');
    });

    it('allows access unconditionally when user has SUPER_ADMIN role', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'admin@creatorconnect.in',
          adminRoles: ['SUPER_ADMIN'],
          adminPermissions: [],
        },
      });

      const html = renderToStaticMarkup(
        <PermissionGate permission="finance.refund">
          <div>Protected Financial Action</div>
        </PermissionGate>,
      );

      expect(html).toContain('Protected Financial Action');
    });

    it('allows access when user has wildcard * permission', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-2',
          email: 'root@creatorconnect.in',
          adminRoles: ['CUSTOM_ADMIN'],
          adminPermissions: ['*'],
        },
      });

      const html = renderToStaticMarkup(
        <PermissionGate permission="settings.edit">
          <div>Config Editor</div>
        </PermissionGate>,
      );

      expect(html).toContain('Config Editor');
    });

    it('allows access when user possesses specific permission', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-3',
          email: 'mod@creatorconnect.in',
          adminRoles: ['MODERATOR'],
          adminPermissions: ['moderation.queue', 'users.suspend'],
        },
      });

      const allowedHtml = renderToStaticMarkup(
        <PermissionGate permission="users.suspend">
          <div>Suspend Button</div>
        </PermissionGate>,
      );
      expect(allowedHtml).toContain('Suspend Button');

      const deniedHtml = renderToStaticMarkup(
        <PermissionGate permission="finance.refund" fallback={<div>No Access</div>}>
          <div>Refund Button</div>
        </PermissionGate>,
      );
      expect(deniedHtml).toContain('No Access');
      expect(deniedHtml).not.toContain('Refund Button');
    });

    it('renders locked banner when permission denied and showLockedPlaceholder is true', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-4',
          email: 'junior@creatorconnect.in',
          adminRoles: ['SUPPORT_AGENT'],
          adminPermissions: ['support.tickets'],
        },
      });

      const html = renderToStaticMarkup(
        <PermissionGate permission="users.delete" showLockedPlaceholder>
          <div>Delete User</div>
        </PermissionGate>,
      );

      expect(html).not.toContain('Delete User');
      expect(html).toContain('Restricted action: Requires users.delete administrative privilege.');
    });
  });
});
