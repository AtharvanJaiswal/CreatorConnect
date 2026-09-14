import {
  AbilityBuilder,
  PureAbility,
  subject,
  type AbilityTuple,
  type ConditionsMatcher,
} from '@casl/ability';
import type { UserIdentity } from './types.js';

export { subject };

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

  if (user.roles.includes('ADMIN')) {
    can('manage', 'all');
    return build({ conditionsMatcher: lambdaMatcher });
  }

  // User Profile
  can('read', 'User', { id: user.id });
  can('update', 'User', { id: user.id });
  cannot('delete', 'User');

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

  return build({ conditionsMatcher: lambdaMatcher });
}
