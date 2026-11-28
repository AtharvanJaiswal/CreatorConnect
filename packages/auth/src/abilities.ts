import {
  AbilityBuilder,
  PureAbility,
  subject,
  type AbilityTuple,
  type ConditionsMatcher,
} from '@casl/ability';
import type { AdminPermission } from '@creatorconnect/contracts';
import type { UserIdentity } from './types.js';

export { subject };

export type AdminIdentityLike = {
  roles?: readonly string[] | undefined;
  adminRoles?: readonly string[] | undefined;
  adminPermissions?: readonly string[] | undefined;
};

/**
 * Returns true only when an authenticated ADMIN explicitly holds SUPER_ADMIN
 * role assignment or the universal wildcard ('*') permission.
 * Bare ADMIN accounts without granular roles/permissions fail closed.
 */
export function isSuperAdminIdentity(user: AdminIdentityLike | null | undefined): boolean {
  if (!user || !user.roles?.includes('ADMIN')) {
    return false;
  }
  return Boolean(user.adminRoles?.includes('SUPER_ADMIN') || user.adminPermissions?.includes('*'));
}

/**
 * Checks whether an authenticated ADMIN holds any of the required fine-grained
 * administrative permissions (or explicit SUPER_ADMIN / '*' authority).
 * Deny-by-default: bare ADMIN accounts with empty/missing permissions return false.
 */
export function hasAnyAdminPermission(
  user: AdminIdentityLike | null | undefined,
  requiredPermissions: readonly (AdminPermission | string)[],
): boolean {
  if (!user || !user.roles?.includes('ADMIN')) {
    return false;
  }
  if (isSuperAdminIdentity(user)) {
    return true;
  }
  if (!user.adminPermissions || user.adminPermissions.length === 0) {
    return false;
  }
  return requiredPermissions.some((perm) => user.adminPermissions!.includes(perm));
}

export type AppAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'manage'
  | 'apply'
  | 'accept'
  | 'shortlist'
  | 'reject'
  | 'withdraw';

export type AppSubject =
  | 'User'
  | 'CreatorProfile'
  | 'ProfessionalProfile'
  | 'BrandProfile'
  | 'PodcasterProfile'
  | 'PortfolioItem'
  | 'MediaAsset'
  | 'Assignment'
  | 'Application'
  | 'Conversation'
  | 'Message'
  | 'all'
  | any;

export type AppAbility = PureAbility<AbilityTuple<AppAction, AppSubject>>;

const lambdaMatcher: ConditionsMatcher<any> = (conditions: any) => {
  const matcher = (target: Record<string, unknown>): boolean => {
    if (!target || typeof target !== 'object') return false;
    return Object.entries(conditions).every(([key, value]) => target[key] === value);
  };
  return matcher as any;
};

/**
 * Builds the PureAbility authorization rules for an authenticated user identity.
 * Covers Phase 3 Identity & Phase 4 Business Domains.
 */
export function defineAbilitiesFor(user: UserIdentity): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  // User Profile (self-access baseline for every active identity)
  can('read', 'User', { id: user.id });
  can('update', 'User', { id: user.id });
  cannot('delete', 'User');

  // Administrative Access Control (Deny-By-Default Zero Trust)
  if (user.roles.includes('ADMIN')) {
    // Only explicit SUPER_ADMIN assignment or universal wildcard grants global 'manage all'
    if (isSuperAdminIdentity(user)) {
      can('manage', 'all');
      return build({ conditionsMatcher: lambdaMatcher });
    }

    // Bare ADMIN with missing/empty adminPermissions fails closed (no admin capabilities granted)
    const perms = user.adminPermissions || [];
    for (const perm of perms) {
      if (perm.startsWith('users.')) {
        can(['read', 'update'], 'User');
      }
      if (perm.startsWith('projects.')) {
        can(['read', 'update'], 'Assignment');
        can(perm === 'projects.moderate' ? ['read', 'update'] : ['read'], 'Dispute' as any);
      }
      if (perm.startsWith('reports.')) {
        can(['read', 'update'], 'Report' as any);
        can(perm === 'reports.resolve' ? ['read', 'update'] : ['read'], 'Dispute' as any);
      }
      if (perm.startsWith('reviews.')) {
        can(['read', 'update'], 'Review' as any);
      }
      if (perm.startsWith('support.')) {
        can(['read', 'update'], 'SupportTicket' as any);
      }
      if (perm.startsWith('audit.')) {
        can(['read'], 'AuditLog' as any);
      }
      if (perm.startsWith('payments.')) {
        can(['read'], 'Payment' as any);
        if (perm === 'payments.read') {
          can(['read'], 'Dispute' as any);
        }
        if (perm === 'payments.refund.request' || perm === 'payments.refund.approve') {
          can(['read', 'update'], 'Refund' as any);
        }
        if (perm === 'payments.refund.approve') {
          can(['read', 'update'], 'Dispute' as any);
        }
        if (perm === 'payments.reconcile') {
          can(['read', 'create'], 'Reconciliation' as any);
        }
      }
      if (perm === 'admins.read') {
        can(['read'], 'AdminUser' as any);
      }
      if (perm === 'admins.manage') {
        can(['read', 'create', 'update', 'delete'], 'AdminUser' as any);
      }
      if (perm === 'analytics.read') {
        can(['read'], 'Analytics' as any);
      }
      if (perm === 'settings.read') {
        can(['read'], 'Config' as any);
      }
      if (perm === 'settings.manage') {
        can(['read', 'update'], 'Config' as any);
      }
    }
  }

  // Creator Profile
  if (user.roles.includes('CREATOR')) {
    can('create', 'CreatorProfile');
    can('update', 'CreatorProfile', { userId: user.id });
  }
  can('read', 'CreatorProfile', { visibility: 'PUBLIC' });
  can('read', 'CreatorProfile', { visibility: 'UNLISTED' });
  can('read', 'CreatorProfile', { userId: user.id });

  // Professional Profile
  if (user.roles.includes('PROFESSIONAL')) {
    can('create', 'ProfessionalProfile');
    can('update', 'ProfessionalProfile', { userId: user.id });
  }
  can('read', 'ProfessionalProfile', { visibility: 'PUBLIC' });
  can('read', 'ProfessionalProfile', { visibility: 'UNLISTED' });
  can('read', 'ProfessionalProfile', { userId: user.id });

  // Brand Profile
  if (user.roles.includes('BRAND')) {
    can('create', 'BrandProfile');
    can('update', 'BrandProfile', { userId: user.id });
  }
  can('read', 'BrandProfile', { visibility: 'PUBLIC' });
  can('read', 'BrandProfile', { visibility: 'UNLISTED' });
  can('read', 'BrandProfile', { userId: user.id });

  // Podcaster Profile
  if (user.roles.includes('PODCASTER')) {
    can('create', 'PodcasterProfile');
    can('update', 'PodcasterProfile', { userId: user.id });
  }
  can('read', 'PodcasterProfile', { visibility: 'PUBLIC' });
  can('read', 'PodcasterProfile', { visibility: 'UNLISTED' });
  can('read', 'PodcasterProfile', { userId: user.id });

  // Portfolio
  if (user.roles.includes('CREATOR') || user.roles.includes('PROFESSIONAL')) {
    can('create', 'PortfolioItem');
    can(['update', 'delete'], 'PortfolioItem', { userId: user.id });
  }
  can('read', 'PortfolioItem', { visibility: 'PUBLIC' });
  can('read', 'PortfolioItem', { visibility: 'UNLISTED' });
  can('read', 'PortfolioItem', { userId: user.id });

  // Media
  can('create', 'MediaAsset');
  can(['read', 'update', 'delete'], 'MediaAsset', { userId: user.id });

  // Assignments (Strictly Brand-Owned)
  if (user.roles.includes('BRAND')) {
    can('create', 'Assignment');
    can(['update', 'delete'], 'Assignment', { brandUserId: user.id });
  }
  can('read', 'Assignment', { status: 'PUBLISHED' });
  can('read', 'Assignment', { brandUserId: user.id });

  // Applications
  if (user.roles.includes('CREATOR') || user.roles.includes('PROFESSIONAL')) {
    can('apply', 'Assignment');
    can('create', 'Application');
    can('read', 'Application', { applicantId: user.id });
    can('withdraw', 'Application', { applicantId: user.id });
  }
  can('read', 'Application', { assignmentBrandUserId: user.id });
  can(['shortlist', 'reject', 'accept'], 'Application', { assignmentBrandUserId: user.id });

  // Phase 5 Messaging & Conversations
  can(['read', 'create'], 'Conversation');
  can(['read', 'create'], 'Message');

  return build({ conditionsMatcher: lambdaMatcher });
}
