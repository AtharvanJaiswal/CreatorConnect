import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PostgresContainerResolver,
  DockerUnavailableError,
  PostgresContainerNotFoundError,
} from './postgres-container-resolver.js';

describe('PostgresContainerResolver', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.POSTGRES_CONTAINER_NAME;
    delete process.env.PG_CONTAINER;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('throws DockerUnavailableError when Docker CLI or daemon fails', () => {
    const mockExecutor = vi.fn().mockImplementation(() => {
      throw new Error('docker: command not found');
    });

    expect(() => PostgresContainerResolver.resolve({ commandExecutor: mockExecutor })).toThrow(
      DockerUnavailableError,
    );
  });

  it('resolves container from POSTGRES_CONTAINER_NAME environment variable when running', () => {
    process.env.POSTGRES_CONTAINER_NAME = 'custom-ci-postgres';

    const mockExecutor = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes('docker version')) return '24.0.0';
      if (cmd.includes('docker inspect --format "{{.State.Running}}" custom-ci-postgres'))
        return 'true';
      if (cmd.includes('docker inspect --format "{{.Config.Image}}" custom-ci-postgres'))
        return 'postgres:16-alpine';
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const info = PostgresContainerResolver.resolve({ commandExecutor: mockExecutor });
    expect(info.id).toBe('custom-ci-postgres');
    expect(info.source).toBe('env');
    expect(info.image).toBe('postgres:16-alpine');
  });

  it('resolves explicit container when running', () => {
    const mockExecutor = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes('docker version')) return '24.0.0';
      if (cmd.includes('docker inspect --format "{{.State.Running}}" explicit-pg')) return 'true';
      if (cmd.includes('docker inspect --format "{{.Config.Image}}" explicit-pg'))
        return 'postgres:16-alpine';
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const info = PostgresContainerResolver.resolve({
      preferredName: 'explicit-pg',
      commandExecutor: mockExecutor,
    });
    expect(info.id).toBe('explicit-pg');
    expect(info.source).toBe('explicit');
  });

  it('throws PostgresContainerNotFoundError when strictName is true and explicit container is missing', () => {
    const mockExecutor = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes('docker version')) return '24.0.0';
      if (cmd.includes('docker inspect')) throw new Error('No such container');
      throw new Error(`Unexpected command: ${cmd}`);
    });

    expect(() =>
      PostgresContainerResolver.resolve({
        preferredName: 'missing-pg',
        strictName: true,
        commandExecutor: mockExecutor,
      }),
    ).toThrow(PostgresContainerNotFoundError);
  });

  it('resolves container via Docker Compose when available', () => {
    const mockExecutor = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes('docker version')) return '24.0.0';
      if (cmd.includes('docker compose ps -q postgres')) return 'compose-cid-12345';
      if (cmd.includes('docker inspect --format "{{.State.Running}}" compose-cid-12345'))
        return 'true';
      if (cmd.includes('docker inspect --format "{{.Config.Image}}" compose-cid-12345'))
        return 'postgres:16-alpine';
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const info = PostgresContainerResolver.resolve({ commandExecutor: mockExecutor });
    expect(info.id).toBe('compose-cid-12345');
    expect(info.source).toBe('compose');
  });

  it('discovers GitHub Actions service container from docker ps when explicit name is not found', () => {
    const mockExecutor = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes('docker version')) return '24.0.0';
      if (cmd.includes('docker inspect --format "{{.State.Running}}" creatorconnect-postgres')) {
        throw new Error('Error response from daemon: No such container: creatorconnect-postgres');
      }
      if (cmd.includes('docker compose ps')) throw new Error('no compose');
      if (cmd.includes('docker ps --filter "status=running"')) {
        // Simulates GitHub Actions runner output with random container ID and service labels
        return [
          'redis-id-1\trunner-redis\tredis:7-alpine\t0.0.0.0:6379->6379/tcp\tlabel=foo',
          'gha-postgres-id-99\tgithub-actions-service-postgres\tpostgres:16-alpine\t0.0.0.0:5432->5432/tcp\tcom.github.actions.service=postgres',
        ].join('\n');
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const info = PostgresContainerResolver.resolve({
      preferredName: 'creatorconnect-postgres',
      commandExecutor: mockExecutor,
    });

    expect(info.id).toBe('gha-postgres-id-99');
    expect(info.name).toBe('github-actions-service-postgres');
    expect(info.image).toBe('postgres:16-alpine');
    expect(info.source).toBe('discovery');
  });

  it('throws PostgresContainerNotFoundError when no running PostgreSQL containers exist', () => {
    const mockExecutor = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes('docker version')) return '24.0.0';
      if (cmd.includes('docker compose ps')) throw new Error('no compose');
      if (cmd.includes('docker ps --filter "status=running"')) {
        return 'web-shell-id\tweb-shell\tnode:20-alpine\t3000/tcp\tlabel=foo';
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });

    expect(() => PostgresContainerResolver.resolve({ commandExecutor: mockExecutor })).toThrow(
      PostgresContainerNotFoundError,
    );
  });
});
