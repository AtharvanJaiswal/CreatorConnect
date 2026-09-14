import { describe, expect, it } from 'vitest';
import { defineAbilitiesFor, subject } from './abilities.js';
import type { UserIdentity } from './types.js';

describe('Pure CASL Authorization Abilities', () => {
  const creatorUser: UserIdentity = {
    id: '018f3a5e-2b1c-7f4d-9a8b-123456789abc',
    supabaseAuthId: 'sub_creator_123',
    email: 'creator@example.com',
    roles: ['CREATOR'],
    status: 'ACTIVE',
  };

  const proUser: UserIdentity = {
    id: '018f3a5e-2b1c-7f4d-9a8b-111111111111',
    supabaseAuthId: 'sub_pro_111',
    email: 'pro@example.com',
    roles: ['PROFESSIONAL'],
    status: 'ACTIVE',
  };

  const brandUser: UserIdentity = {
    id: '018f3a5e-2b1c-7f4d-9a8b-222222222222',
    supabaseAuthId: 'sub_brand_222',
    email: 'brand@example.com',
    roles: ['BRAND'],
    status: 'ACTIVE',
  };

  const adminUser: UserIdentity = {
    id: '018f3a5e-2b1c-7f4d-9a8b-987654321def',
    supabaseAuthId: 'sub_admin_456',
    email: 'admin@example.com',
    roles: ['ADMIN'],
    status: 'ACTIVE',
  };

  it('allows a creator to read and update their own User record', () => {
    const ability = defineAbilitiesFor(creatorUser);
    expect(ability.can('read', subject('User', { id: creatorUser.id }))).toBe(true);
    expect(ability.can('update', subject('User', { id: creatorUser.id }))).toBe(true);
  });

  it('prohibits a creator from updating another user record (anti-IDOR)', () => {
    const ability = defineAbilitiesFor(creatorUser);
    expect(ability.can('update', subject('User', { id: 'other-user-uuid' }))).toBe(false);
  });

  it('prohibits a creator from deleting their User record', () => {
    const ability = defineAbilitiesFor(creatorUser);
    expect(ability.can('delete', subject('User', { id: creatorUser.id }))).toBe(false);
    expect(ability.can('delete', 'User')).toBe(false);
  });

  it('allows an admin to manage all resources (admin override)', () => {
    const ability = defineAbilitiesFor(adminUser);
    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('update', subject('User', { id: 'any-user-id' }))).toBe(true);
    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('enforces role-gated assignment creation (BRAND only)', () => {
    const brandAbility = defineAbilitiesFor(brandUser);
    const creatorAbility = defineAbilitiesFor(creatorUser);

    expect(brandAbility.can('create', 'Assignment')).toBe(true);
    expect(creatorAbility.can('create', 'Assignment')).toBe(false);
  });

  it('enforces assignment update ownership (brandUserId)', () => {
    const brandAbility = defineAbilitiesFor(brandUser);

    expect(brandAbility.can('update', subject('Assignment', { brandUserId: brandUser.id }))).toBe(
      true,
    );
    expect(
      brandAbility.can('update', subject('Assignment', { brandUserId: 'other-brand-id' })),
    ).toBe(false);
  });

  it('allows creators and professionals to apply to assignments', () => {
    const creatorAbility = defineAbilitiesFor(creatorUser);
    const proAbility = defineAbilitiesFor(proUser);
    const brandAbility = defineAbilitiesFor(brandUser);

    expect(creatorAbility.can('apply', 'Assignment')).toBe(true);
    expect(proAbility.can('apply', 'Assignment')).toBe(true);
    expect(brandAbility.can('apply', 'Assignment')).toBe(false);
  });

  it('allows applicants to withdraw their own proposals and brands to shortlist/accept', () => {
    const creatorAbility = defineAbilitiesFor(creatorUser);
    const brandAbility = defineAbilitiesFor(brandUser);

    expect(
      creatorAbility.can('withdraw', subject('Application', { applicantId: creatorUser.id })),
    ).toBe(true);
    expect(
      creatorAbility.can('withdraw', subject('Application', { applicantId: 'other-applicant' })),
    ).toBe(false);

    expect(
      brandAbility.can('accept', subject('Application', { assignmentBrandUserId: brandUser.id })),
    ).toBe(true);
    expect(
      brandAbility.can('accept', subject('Application', { assignmentBrandUserId: 'other-brand' })),
    ).toBe(false);
  });
});
