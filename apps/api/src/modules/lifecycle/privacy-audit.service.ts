import crypto from 'node:crypto';
import pino, { type Logger } from 'pino';
import { PrismaClient, Prisma } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type { PrivacyReceiptResponse } from '@creatorconnect/contracts';
import { PrivacyReceiptInvalidError } from '../../errors/app-error.js';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface IssueCertificateParams {
  requestId: string;
  userId: string;
  actionTaken: string;
  recordsProcessed: number;
  mediaFilesPurged: number;
}

export class PrivacyAuditService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  /**
   * Generates a high-entropy 256-bit CSPRNG nonce token.
   * Format: base64url encoding of 32 random bytes.
   */
  public generateReceiptToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Computes an irreversible SHA-256 hash of a receipt token for storage.
   */
  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Constant-time comparison to verify a presented token against stored hash.
   */
  public verifyToken(presentedToken: string, storedHash: string): boolean {
    const computedHash = this.hashToken(presentedToken);
    const hashBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (hashBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuf, storedBuf);
  }

  /**
   * Issues a non-repudiable privacy certificate, returning the raw token to the user
   * while storing only the cryptographic hash in the audit ledger.
   */
  public async issueCertificate(
    tx: Prisma.TransactionClient,
    params: IssueCertificateParams,
  ): Promise<{ receipt: PrivacyReceiptResponse; rawToken: string }> {
    const { requestId, userId, actionTaken, recordsProcessed, mediaFilesPurged } = params;

    const rawToken = this.generateReceiptToken();
    const tokenHash = this.hashToken(rawToken);
    const certificateId = generateUuidV7();
    const completedAt = new Date();

    // Verification signature (HMAC of certificate payload)
    const hmacSecret = process.env.PRIVACY_HMAC_SECRET || 'audit_hmac_default_secret_key_32b';
    const payloadToSign = `${requestId}:${actionTaken}:${recordsProcessed}:${mediaFilesPurged}:${completedAt.toISOString()}`;
    const verificationSig = crypto
      .createHmac('sha256', hmacSecret)
      .update(payloadToSign)
      .digest('hex');

    // Store in AuditLog table without plaintext user PII
    await tx.auditLog.create({
      data: {
        id: certificateId,
        action: 'PRIVACY_AUDIT_CERTIFICATE_ISSUED',
        entity: 'PrivacyCertificate',
        entityId: certificateId,
        metadata: {
          certificateId,
          requestId,
          tokenHash, // Only SHA-256 hash stored
          actionTaken,
          recordsProcessed,
          mediaFilesPurged,
          completedAt: completedAt.toISOString(),
          verificationSig,
        },
      },
    });

    // Structured log: NEVER log the raw receipt token!
    logger.info(
      {
        event: 'PRIVACY_CERTIFICATE_ISSUED',
        certificateId,
        requestId,
        userId,
        tokenHashPrefix: tokenHash.substring(0, 8),
        recordsProcessed,
        mediaFilesPurged,
      },
      'Privacy compliance audit certificate issued.',
    );

    const receipt: PrivacyReceiptResponse = {
      certificateToken: rawToken,
      requestId,
      actionTaken,
      recordsProcessed,
      mediaFilesPurged,
      completedAt: completedAt.toISOString(),
      verificationSig,
    };

    return { receipt, rawToken };
  }

  /**
   * Verifies a raw receipt token against the audit ledger.
   */
  public async verifyReceiptToken(rawToken: string): Promise<{ valid: boolean; metadata?: any }> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'PRIVACY_AUDIT_CERTIFICATE_ISSUED',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    for (const log of logs) {
      const meta = log.metadata as any;
      if (meta && meta.tokenHash && this.verifyToken(rawToken, meta.tokenHash)) {
        return { valid: true, metadata: meta };
      }
    }

    throw new PrivacyReceiptInvalidError('The provided privacy certificate token is invalid.');
  }
}

export const privacyAuditService = new PrivacyAuditService();
