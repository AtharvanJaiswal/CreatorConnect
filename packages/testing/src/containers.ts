import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

/**
 * Testcontainers runner helpers for ephemeral PostgreSQL and Redis.
 */

export class TestContainersHelper {
  private static postgresContainer: StartedPostgreSqlContainer | null = null;
  private static redisContainer: StartedRedisContainer | null = null;

  static async startPostgres(): Promise<StartedPostgreSqlContainer> {
    if (!this.postgresContainer) {
      this.postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('creatorconnect_test')
        .withUsername('postgres')
        .withPassword('postgres_test_password')
        .start();
    }
    return this.postgresContainer;
  }

  static async startRedis(): Promise<StartedRedisContainer> {
    if (!this.redisContainer) {
      this.redisContainer = await new RedisContainer('redis:7-alpine').start();
    }
    return this.redisContainer;
  }

  static async stopAll(): Promise<void> {
    if (this.postgresContainer) {
      await this.postgresContainer.stop();
      this.postgresContainer = null;
    }
    if (this.redisContainer) {
      await this.redisContainer.stop();
      this.redisContainer = null;
    }
  }
}
