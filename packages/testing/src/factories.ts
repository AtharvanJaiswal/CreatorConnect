import { generateId, toIsoUtcString } from '@creatorconnect/utils';

/**
 * Synthetic Test Data Factories.
 * Strictly avoids using production data in tests.
 */

export interface TestUser {
  id: string;
  email: string;
  role: 'CREATOR' | 'PROFESSIONAL' | 'BRAND' | 'PODCASTER' | 'ADMIN';
  createdAt: string;
}

export class UserFactory {
  static create(overrides?: Partial<TestUser>): TestUser {
    const id = overrides?.id || generateId('usr');
    return {
      id,
      email: overrides?.email || `test-${id.toLowerCase()}@creatorconnect.test`,
      role: overrides?.role || 'CREATOR',
      createdAt: overrides?.createdAt || toIsoUtcString(),
    };
  }
}
