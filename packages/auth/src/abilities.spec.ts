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
});
