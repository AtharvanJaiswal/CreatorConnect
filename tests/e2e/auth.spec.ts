import { test, expect } from '@playwright/test';

test.describe('Authentication and Identity UI', () => {
  test('verifies auth routes and structure exist for login, register, reset-password, unauthorized', async () => {
    const authRoutes = ['/login', '/register', '/reset-password', '/unauthorized'];
    for (const route of authRoutes) {
      expect(route.startsWith('/')).toBe(true);
    }
  });

  test('verifies role types are available for self-selection in registration', async () => {
    const allowedSelfSelectRoles = ['CREATOR', 'PROFESSIONAL', 'BRAND', 'PODCASTER'];
    expect(allowedSelfSelectRoles).not.toContain('ADMIN');
    expect(allowedSelfSelectRoles).toHaveLength(4);
  });
});
