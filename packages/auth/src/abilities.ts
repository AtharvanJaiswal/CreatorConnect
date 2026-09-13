import {
  AbilityBuilder,
  PureAbility,
  subject,
  type AbilityTuple,
  type ConditionsMatcher,
} from '@casl/ability';
import type { UserIdentity } from './types.js';

export { subject };

export type AppAction = 'read' | 'update' | 'delete' | 'manage';
export type AppSubject = 'User' | { id: string } | 'all';

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
 * Strictly scoped to Phase 3 requirements.
 */
export function defineAbilitiesFor(user: UserIdentity): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  if (user.roles.includes('ADMIN')) {
    can('manage', 'all');
  } else {
    // Normal users can read and update only their own User record
    can('read', 'User', { id: user.id });
    can('update', 'User', { id: user.id });

    // Explicitly prohibit deletion
    cannot('delete', 'User');
  }

  return build({ conditionsMatcher: lambdaMatcher });
}
