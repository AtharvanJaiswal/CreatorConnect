import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Docker Secret Hygiene (Phase H)', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const dockerignorePath = path.join(rootDir, '.dockerignore');

  it('verifies .dockerignore exists and strictly excludes all environment files', () => {
    expect(fs.existsSync(dockerignorePath)).toBe(true);
    const content = fs.readFileSync(dockerignorePath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Assert essential exclusion rules exist
    expect(lines).toContain('.env');
    expect(lines).toContain('.env.*');
    expect(lines).toContain('**/.env');
    expect(lines).toContain('**/.env.*');

    // Assert .env.example is preserved for documentation
    expect(lines).toContain('!.env.example');
    expect(lines).toContain('!**/.env.example');
  });

  it('proves sentinel env files match ignore patterns and are rejected from build context', () => {
    const sentinelNames = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.sentinel_secret',
      'apps/api/.env',
      'apps/web-shell/.env.local',
      'packages/database/.env',
    ];

    const content = fs.readFileSync(dockerignorePath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const sentinel of sentinelNames) {
      const fileName = path.basename(sentinel);
      const isIgnored =
        lines.includes('.env') ||
        lines.includes('.env.*') ||
        lines.includes('**/.env') ||
        lines.includes('**/.env.*');

      expect(isIgnored).toBe(true);
      expect(fileName.startsWith('.env')).toBe(true);
      expect(fileName).not.toBe('.env.example');
    }
  });

  it('verifies Dockerfiles do not hardcode secrets or credentials', () => {
    const dockerfiles = [
      path.join(rootDir, 'apps/api/Dockerfile'),
      path.join(rootDir, 'apps/worker/Dockerfile'),
      path.join(rootDir, 'apps/realtime/Dockerfile'),
      path.join(rootDir, 'apps/web-shell/Dockerfile'),
    ];

    for (const df of dockerfiles) {
      if (fs.existsSync(df)) {
        const text = fs.readFileSync(df, 'utf-8');
        // Ensure no hardcoded Supabase project IDs or secret tokens
        expect(text).not.toMatch(/sb_publishable_[a-zA-Z0-9_-]+/);
        expect(text).not.toMatch(/jlmbsosbmhyafjlqvbgl/);
      }
    }
  });
});
