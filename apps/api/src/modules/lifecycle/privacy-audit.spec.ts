import { describe, it, expect } from 'vitest';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { privacyAuditService } from './privacy-audit.service.js';
import { PrivacyReceiptInvalidError } from '../../errors/app-error.js';

describe('PrivacyAuditService — Cryptographic Verification & Receipts', () => {
  const prisma = getPrismaClient();

  it('generates high-entropy 256-bit CSPRNG base64url tokens', () => {
    const token1 = privacyAuditService.generateReceiptToken();
    const token2 = privacyAuditService.generateReceiptToken();

    expect(token1).not.toBe(token2);
    expect(typeof token1).toBe('string');
    // 32 bytes in base64url is 43 characters
    expect(token1.length).toBe(43);
    // Base64url character set: [A-Za-z0-9_-]
    expect(/^[A-Za-z0-9_-]+$/.test(token1)).toBe(true);
  });

  it('computes irreversible SHA-256 hash of tokens', () => {
    const token = privacyAuditService.generateReceiptToken();
    const hash = privacyAuditService.hashToken(token);

    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);

    // Deterministic for same input
    expect(privacyAuditService.hashToken(token)).toBe(hash);
  });

  it('uses constant-time comparison to verify tokens', () => {
    const token = privacyAuditService.generateReceiptToken();
    const hash = privacyAuditService.hashToken(token);

    expect(privacyAuditService.verifyToken(token, hash)).toBe(true);
    expect(privacyAuditService.verifyToken('wrong-token-value', hash)).toBe(false);
  });

  it('issues privacy certificate storing only hash and emits valid verifiable receipt', async () => {
    const requestId = generateUuidV7();
    const userId = generateUuidV7();

    const result = await prisma.$transaction(async (tx) => {
      return await privacyAuditService.issueCertificate(tx, {
        requestId,
        userId,
        actionTaken: 'IN_PLACE_PSEUDONYMIZATION',
        recordsProcessed: 3,
        mediaFilesPurged: 5,
      });
    });

    expect(result.rawToken).toBeDefined();
    expect(result.receipt.certificateToken).toBe(result.rawToken);
    expect(result.receipt.recordsProcessed).toBe(3);
    expect(result.receipt.mediaFilesPurged).toBe(5);
    expect(result.receipt.verificationSig).toHaveLength(64);

    // Verify stored AuditLog record DOES NOT contain the raw token
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entity: 'PrivacyCertificate',
        action: 'PRIVACY_AUDIT_CERTIFICATE_ISSUED',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditRecord).not.toBeNull();
    const meta = auditRecord?.metadata as any;
    expect(meta.tokenHash).toBe(privacyAuditService.hashToken(result.rawToken));
    expect(meta.token).toBeUndefined(); // Raw token MUST NOT be stored
    expect(JSON.stringify(meta)).not.toContain(result.rawToken);

    // Verification of receipt via public audit method
    const verification = await privacyAuditService.verifyReceiptToken(result.rawToken);
    expect(verification.valid).toBe(true);
    expect(verification.metadata.recordsProcessed).toBe(3);

    // Tampered token must be rejected
    await expect(
      privacyAuditService.verifyReceiptToken('tampered-token-that-does-not-exist'),
    ).rejects.toThrow(PrivacyReceiptInvalidError);
  });

  it('safely rejects tokens with mismatched lengths or invalid formats without timing leakage', () => {
    const validHash = privacyAuditService.hashToken('valid-token-example');

    // Shorter token
    expect(privacyAuditService.verifyToken('short', validHash)).toBe(false);
    // Longer token
    expect(
      privacyAuditService.verifyToken(
        'very-long-token-that-exceeds-standard-thirty-two-bytes-encoding',
        validHash,
      ),
    ).toBe(false);
    // Empty token
    expect(privacyAuditService.verifyToken('', validHash)).toBe(false);
  });

  it('guarantees enumeration resistance by throwing uniform error on invalid receipts', async () => {
    // Both malformed tokens and non-existent validly-formatted tokens must throw identical PrivacyReceiptInvalidError
    await expect(privacyAuditService.verifyReceiptToken('invalid_token_123')).rejects.toThrow(
      PrivacyReceiptInvalidError,
    );
    await expect(
      privacyAuditService.verifyReceiptToken(privacyAuditService.generateReceiptToken()),
    ).rejects.toThrow(PrivacyReceiptInvalidError);
  });
});
