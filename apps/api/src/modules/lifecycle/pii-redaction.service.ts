import pino, { type Logger } from 'pino';
import { PrismaClient, Prisma, UserStatus } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface RedactionResult {
  userId: string;
  tombstoneEmail: string;
  recordsScrubbed: number;
}

export class PiiRedactionService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  /**
   * Generates a deterministic, standard-compliant tombstone email for a deleted account.
   * Uses the reserved .invalid TLD (RFC 2606) to prevent accidental email delivery.
   */
  public generateTombstoneEmail(userId: string): string {
    return `deleted-${userId}@deleted.invalid`;
  }

  /**
   * Performs atomic in-place pseudonymization of a user's personal identity records.
   * Preserves relational foreign-key integrity (distinct UUID kept) while scrubbing PII.
   * MUST be executed inside an active transaction with parent-row lock already acquired!
   */
  public async pseudonymizeUser(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<RedactionResult> {
    const tombstoneEmail = this.generateTombstoneEmail(userId);
    let recordsScrubbed = 0;

    // 1. In-place pseudonymization of the users table row
    await tx.user.update({
      where: { id: userId },
      data: {
        email: tombstoneEmail,
        firstName: 'Deleted',
        lastName: 'User',
        avatarUrl: null,
        status: UserStatus.DEACTIVATED,
      },
    });
    recordsScrubbed += 1;

    // 2. Scrub CreatorProfile if present
    const creator = await tx.creatorProfile.findUnique({
      where: { userId },
    });
    if (creator) {
      await tx.creatorProfile.update({
        where: { userId },
        data: {
          bio: null,
          tagline: null,
          socialLinks: Prisma.JsonNull,
        },
      });
      recordsScrubbed += 1;
    }

    // 3. Scrub BrandProfile if present
    const brand = await tx.brandProfile.findUnique({
      where: { userId },
    });
    if (brand) {
      await tx.brandProfile.update({
        where: { userId },
        data: {
          companyName: 'Deleted Brand',
          bio: null,
          websiteUrl: null,
        },
      });
      recordsScrubbed += 1;
    }

    logger.info(
      {
        event: 'PII_REDACTION_APPLIED',
        userId,
        tombstoneEmail,
        recordsScrubbed,
      },
      'Personal data in-place pseudonymization completed.',
    );

    return {
      userId,
      tombstoneEmail,
      recordsScrubbed,
    };
  }
}

export const piiRedactionService = new PiiRedactionService();
