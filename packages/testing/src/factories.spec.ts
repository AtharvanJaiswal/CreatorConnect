import { describe, it, expect } from 'vitest';
import { UserFactory } from './factories.js';

describe('Testing Factories', () => {
  it('creates a valid synthetic User fixture with defaults', () => {
    const user = UserFactory.create();
    expect(user.id).toBeDefined();
    expect(user.email).toContain('@creatorconnect.test');
    expect(user.role).toBe('CREATOR');
    expect(user.createdAt).toBeDefined();
  });

  it('supports overrides for role and email', () => {
    const user = UserFactory.create({
      email: 'brand-test@creatorconnect.test',
      role: 'BRAND',
    });
    expect(user.email).toBe('brand-test@creatorconnect.test');
    expect(user.role).toBe('BRAND');
  });
});
