import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';
import { defaultJwtVerifier } from '../../../services/jwt-verifier.js';
import { adminRbacService } from '../rbac/admin-rbac.service.js';
import { sanitizeAuditMetadata } from './audit-sanitizer.js';
import { AdminAuditService } from './admin-audit.service.js';
import { encodeAuditCursor, decodeAuditCursor } from '@creatorconnect/contracts';
import { getPrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import {
  createTestJwt,
  createTestKeySet,
} from '../../../../../../tests/fixtures/auth-test-helper.js';

describe('Admin Audit Trail — Unit, Sanitization, Pagination & Real-DB Security Suite', () => {
  // ============================================================================
  // 1. Metadata Sanitizer Adversarial & Idempotency Tests
  // ============================================================================
  describe('1. Audit Metadata Sanitizer (Workstream C)', () => {
    it('redacts key variations, embedded connection strings, PEM keys, JWTs, and secret prefixes', () => {
      const rawMetadata = {
        reason: 'Staff compliance inspection completed',
        password: 'PlaintextPassword1!',
        Password: 'CapitalPassword2!',
        PASSWORD: 'UpperPassword3!',
        accessToken: 'at_987654321',
        refresh_token: 'rt_123456789',
        apiKey: 'cc_live_api_key_9988',
        sessionId: 'sess_abc_123',
        session_id: 'sess_xyz_789',
        authorization: 'Basic dXNlcjpwYXNz',
        cookie: 'cc_sid=secretcookievalue',
        privateKey: 'raw-private-key-material',
        cvv: '412',
        cardNumber: '4111111111111111',
        embeddedBearer:
          'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signaturepartvalue12345',
        rawJwt:
          'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepartvalue1234567890',
        connNote:
          'Failed connecting to postgresql://postgres:supersecretpw@prod-db.internal:5432/cc_prod',
        pemText:
          '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
        stripeLeak: `key=${['sk', 'live', '51H8abcdef1234567890ghij'].join('_')}`,
        unicodeKey_note: 'Safe unicode note 👍',
        unicodeKey_secret: 'hidden-unicode-secret',
        nestedContext: {
          country: 'IN',
          arrayValues: [
            'normal-tag',
            { token: 'nested-array-token', safeFlag: true },
            'redis://:redis_pass@10.0.0.5:6379/0',
          ],
        },
      };

      const snapshotBefore = structuredClone(rawMetadata);
      const sanitized = sanitizeAuditMetadata(rawMetadata);

      // Must never mutate original input object
      expect(rawMetadata).toEqual(snapshotBefore);

      expect(sanitized).not.toBeNull();
      expect(sanitized!.reason).toBe('Staff compliance inspection completed');
      expect(sanitized!.password).toBe('[REDACTED]');
      expect(sanitized!.Password).toBe('[REDACTED]');
      expect(sanitized!.PASSWORD).toBe('[REDACTED]');
      expect(sanitized!.accessToken).toBe('[REDACTED]');
      expect(sanitized!.refresh_token).toBe('[REDACTED]');
      expect(sanitized!.apiKey).toBe('[REDACTED]');
      expect(sanitized!.sessionId).toBe('[REDACTED]');
      expect(sanitized!.session_id).toBe('[REDACTED]');
      expect(sanitized!.authorization).toBe('[REDACTED]');
      expect(sanitized!.cookie).toBe('[REDACTED]');
      expect(sanitized!.privateKey).toBe('[REDACTED]');
      expect(sanitized!.cvv).toBe('[REDACTED]');
      expect(sanitized!.cardNumber).toBe('[REDACTED]');
      expect(sanitized!.embeddedBearer).toBe('[REDACTED]');
      expect(sanitized!.rawJwt).toBe('[REDACTED]');
      expect(sanitized!.connNote).toBe('Failed connecting to [REDACTED_CONNECTION_STRING]');
      expect(sanitized!.pemText).toBe('[REDACTED_PRIVATE_KEY]');
      expect(sanitized!.stripeLeak).toBe('key=[REDACTED]');
      expect(sanitized!.unicodeKey_note).toBe('Safe unicode note 👍');
      expect(sanitized!.unicodeKey_secret).toBe('[REDACTED]');

      const nested = sanitized!.nestedContext as any;
      expect(nested.country).toBe('IN');
      expect(nested.arrayValues[0]).toBe('normal-tag');
      expect(nested.arrayValues[1]).toEqual({ token: '[REDACTED]', safeFlag: true });
      expect(nested.arrayValues[2]).toBe('[REDACTED_CONNECTION_STRING]');
    });

    it('handles circular references, deep nesting, oversized strings, large arrays, Date, Error, Buffer, null-prototype objects and satisfies idempotency S(S(x)) = S(x)', () => {
      const circular: Record<string, unknown> = {
        label: 'root',
        createdAt: new Date('2026-11-20T10:00:00Z'),
      };
      circular.self = circular;

      const deepObj: any = { level: 0 };
      let curr = deepObj;
      for (let i = 1; i <= 15; i++) {
        curr.child = { level: i, password: 'nested-secret-at-depth' };
        curr = curr.child;
      }

      const nullProto = Object.create(null);
      nullProto.safeField = 'hello';
      nullProto.secretField = 'should-hide';

      const hugeArray = Array.from({ length: 120 }, (_, i) => `item-${i}`);
      const hugeString = 'A'.repeat(5000);

      const pathologicalInput = {
        circular,
        deepObj,
        nullProto,
        hugeArray,
        hugeString,
        buf: Buffer.from('raw-binary-bytes'),
        err: new Error('Query failed on postgres://admin:pass123@db.local:5432/cc'),
      };

      const sanitizedOnce = sanitizeAuditMetadata(pathologicalInput);
      expect(sanitizedOnce).not.toBeNull();
      expect((sanitizedOnce!.circular as any).label).toBe('root');
      expect((sanitizedOnce!.circular as any).createdAt).toBe('2026-11-20T10:00:00.000Z');
      expect((sanitizedOnce!.circular as any).self).toBe('[CIRCULAR]');
      expect(sanitizedOnce!.nullProto as any).toEqual({
        safeField: 'hello',
        secretField: '[REDACTED]',
      });
      expect((sanitizedOnce!.hugeArray as unknown[]).length).toBe(50);
      expect((sanitizedOnce!.hugeArray as unknown[])[49]).toBe('[TRUNCATED_ARRAY]');
      expect((sanitizedOnce!.hugeString as string).length).toBe(1024);
      expect((sanitizedOnce!.hugeString as string).endsWith('...[TRUNCATED]')).toBe(true);
      expect(sanitizedOnce!.buf).toBe('[BINARY_REDACTED]');
      expect((sanitizedOnce!.err as any).message).toBe(
        'Query failed on [REDACTED_CONNECTION_STRING]',
      );

      // Idempotency invariant: S(S(x)) = S(x)
      const sanitizedTwice = sanitizeAuditMetadata(sanitizedOnce);
      expect(sanitizedTwice).toEqual(sanitizedOnce);

      // Verify JSON serialization succeeds without prototype pollution or cyclic error
      expect(() => JSON.stringify(sanitizedOnce)).not.toThrow();
    });

    it('ignores prototype pollution keys safely and handles null/primitive inputs', () => {
      const maliciousPayload = JSON.parse(
        '{"__proto__":{"polluted":true},"constructor":"bad","safe":"ok"}',
      );
      const sanitized = sanitizeAuditMetadata(maliciousPayload);
      expect(sanitized).toEqual({ safe: 'ok' });
      expect(({} as any).polluted).toBeUndefined();

      expect(sanitizeAuditMetadata(null)).toBeNull();
      expect(sanitizeAuditMetadata(undefined)).toBeNull();
      expect(sanitizeAuditMetadata('primitive' as any)).toBeNull();
      expect(sanitizeAuditMetadata(new Date())).toBeNull();
      expect(sanitizeAuditMetadata(['a', 'b'])).toEqual({ items: ['a', 'b'] });
    });
  });

  // ============================================================================
  // 2. Cursor Codec & Bounds Validation
  // ============================================================================
  describe('2. Keyset Cursor Codec & Security', () => {
    it('encodes and decodes valid composite (createdAt, id) cursors', () => {
      const id = '0192a0e2-1234-7000-8000-000000000099';
      const date = new Date('2026-11-20T14:30:00.000Z');
      const encoded = encodeAuditCursor(date, id);
      const decoded = decodeAuditCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.id).toBe(id);
      expect(decoded!.createdAt.toISOString()).toBe(date.toISOString());
    });

    it('rejects oversized, non-UUID, tampered, ReDoS padding, and malformed cursors', () => {
      expect(decodeAuditCursor('')).toBeNull();
      expect(decodeAuditCursor('garbage!cursor')).toBeNull();
      expect(decodeAuditCursor('A'.repeat(513))).toBeNull();
      expect(
        decodeAuditCursor(
          Buffer.from('{"c":"2026-11-20T00:00:00Z","i":"not-a-uuid"}').toString('base64url'),
        ),
      ).toBeNull();
      expect(
        decodeAuditCursor(
          Buffer.from('{"c":"not-a-date","i":"0192a0e2-1234-7000-8000-000000000099"}').toString(
            'base64url',
          ),
        ),
      ).toBeNull();
      expect(decodeAuditCursor(Buffer.from('[]').toString('base64url'))).toBeNull();
      expect(() =>
        encodeAuditCursor('invalid-date', '0192a0e2-1234-7000-8000-000000000099'),
      ).toThrow();
      expect(() => encodeAuditCursor(new Date(), 'not-a-uuid')).toThrow();
    });
  });

  // ============================================================================
  // 3. Real Fastify + PostgreSQL + Redis Integration & Authorization Suite
  // ============================================================================
  describe('3. Real Fastify + PostgreSQL Integration, Authorization & Keyset Pagination', () => {
    let app: FastifyInstance;
    const prisma = getPrismaClient();
    const ts = Date.now();
    const testActionPrefix = `TEST_AUDIT_SUITE_${ts}`;

    const createdUserIds: string[] = [];
    const createdAuditIds: string[] = [];

    let superAdminToken: string;
    let userAdminUser: { id: string; email: string; sub: string };
    let userAdminToken: string;
    let supportAdminToken: string; // lacks audit.read
    let normalCreatorToken: string;
    let suspendedAdminUser: { id: string; email: string; sub: string };
    let suspendedAdminToken: string;
    let deactivatedAdminToken: string;

    beforeAll(async () => {
      const testKeySet = await createTestKeySet();
      defaultJwtVerifier.setKeySet(testKeySet);

      app = await buildApp();
      await app.ready();

      const adminGlobalRole = await prisma.role.findUniqueOrThrow({
        where: { name: RoleType.ADMIN },
      });
      const creatorGlobalRole = await prisma.role.findUniqueOrThrow({
        where: { name: RoleType.CREATOR },
      });
      const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
        where: { name: 'SUPER_ADMIN' },
      });
      const userAdminRole = await prisma.adminRole.findUniqueOrThrow({
        where: { name: 'USER_ADMIN' },
      });
      const supportAdminRole = await prisma.adminRole.findUniqueOrThrow({
        where: { name: 'SUPPORT_ADMIN' },
      });

      async function makeUser(
        tag: string,
        globalRoleId: string,
        adminRoleId: string | null,
        status: UserStatus = UserStatus.ACTIVE,
      ) {
        const id = generateUuidV7();
        const sub = `sub_aud_${tag}_${ts}_${id.slice(0, 6)}`;
        const email = `aud_${tag}_${ts}@creatorconnect.test`;
        createdUserIds.push(id);

        await prisma.user.create({
          data: { id, supabaseAuthId: sub, email, firstName: tag, lastName: 'AuditTest', status },
        });
        await prisma.userRole.create({
          data: { id: generateUuidV7(), userId: id, roleId: globalRoleId },
        });
        if (adminRoleId) {
          await prisma.adminUserRole.create({
            data: { id: generateUuidV7(), userId: id, roleId: adminRoleId },
          });
        }
        const token = await createTestJwt({ sub, email });
        return { id, email, sub, token };
      }

      const sa = await makeUser('sa', adminGlobalRole.id, superAdminRole.id);
      superAdminToken = sa.token;

      userAdminUser = await makeUser('ua', adminGlobalRole.id, userAdminRole.id);
      userAdminToken = userAdminUser.token;

      const sup = await makeUser('sup', adminGlobalRole.id, supportAdminRole.id);
      supportAdminToken = sup.token;

      const creator = await makeUser('cr', creatorGlobalRole.id, null);
      normalCreatorToken = creator.token;

      suspendedAdminUser = await makeUser(
        'susp',
        adminGlobalRole.id,
        superAdminRole.id,
        UserStatus.SUSPENDED,
      );
      suspendedAdminToken = suspendedAdminUser.token;

      const deact = await makeUser(
        'deact',
        adminGlobalRole.id,
        superAdminRole.id,
        UserStatus.DEACTIVATED,
      );
      deactivatedAdminToken = deact.token;
    });

    afterAll(async () => {
      if (createdAuditIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
      }
      for (const uId of createdUserIds) {
        await prisma.auditLog.deleteMany({ where: { userId: uId } });
        await prisma.adminUserRole.deleteMany({ where: { userId: uId } });
        await prisma.userRole.deleteMany({ where: { userId: uId } });
        await prisma.user.deleteMany({ where: { id: uId } });
      }
      await app.close();
    });

    it('registers GET /api/v1/admin/audit once in OpenAPI schema without path double-prefixing', async () => {
      const spec = (app as any).swagger();
      expect(spec.paths['/api/v1/admin/audit']).toBeDefined();
      expect(spec.paths['/api/v1/admin/audit'].get).toBeDefined();
      expect(spec.paths['/api/v1/api/v1/admin/audit']).toBeUndefined();
      expect(spec.paths['/api/v1/admin/admin/audit']).toBeUndefined();

      const routesTree = app.printRoutes({ commonPrefix: false });
      const auditMatches = routesTree.match(/\/api\/v1\/admin\/audit\b/g) || [];
      expect(auditMatches.length).toBeGreaterThanOrEqual(1);

      const badPrefix1 = await app.inject({
        method: 'GET',
        url: '/api/v1/api/v1/admin/audit',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(badPrefix1.statusCode).toBe(404);
    });

    it('enforces full authentication and permission authorization matrix at API boundary', async () => {
      // 1. No token -> 401
      const noAuth = await app.inject({ method: 'GET', url: '/api/v1/admin/audit' });
      expect(noAuth.statusCode).toBe(401);

      // 2. Invalid / expired token -> 401
      const expiredToken = await createTestJwt(
        {
          sub: userAdminUser.sub,
          email: userAdminUser.email,
          exp: Math.floor(Date.now() / 1000) - 3600,
        },
        { expiresIn: '-1h' },
      );
      const expiredRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit',
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      expect(expiredRes.statusCode).toBe(401);

      // 3. Suspended SUPER_ADMIN account -> 403 USER_SUSPENDED
      const suspRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit',
        headers: { authorization: `Bearer ${suspendedAdminToken}` },
      });
      expect(suspRes.statusCode).toBe(403);
      expect(suspRes.json().code).toBe('USER_SUSPENDED');

      // 4. Deactivated SUPER_ADMIN account -> 403 USER_DEACTIVATED
      const deactRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit',
        headers: { authorization: `Bearer ${deactivatedAdminToken}` },
      });
      expect(deactRes.statusCode).toBe(403);
      expect(deactRes.json().code).toBe('USER_DEACTIVATED');

      // 5. Authenticated non-admin -> 403
      const creatorRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit',
        headers: { authorization: `Bearer ${normalCreatorToken}` },
      });
      expect(creatorRes.statusCode).toBe(403);

      // 6. Admin WITHOUT audit.read (SUPPORT_ADMIN) -> 403
      const supportRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit',
        headers: { authorization: `Bearer ${supportAdminToken}` },
      });
      expect(supportRes.statusCode).toBe(403);
      expect(supportRes.json().detail).toContain('audit.read');

      // 7. Admin WITH audit.read (USER_ADMIN) -> 200 OK
      const authorizedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit?limit=5',
        headers: { authorization: `Bearer ${userAdminToken}` },
      });
      expect(authorizedRes.statusCode).toBe(200);
    });

    it('rejects invalid query bounds, invalid date ranges, oversized cursors, and bad UUID cursors cleanly with 400 (never 500)', async () => {
      const badCases = [
        '/api/v1/admin/audit?limit=0',
        '/api/v1/admin/audit?limit=101',
        '/api/v1/admin/audit?actorId=not-a-uuid',
        '/api/v1/admin/audit?cursor=garbage',
        `/api/v1/admin/audit?cursor=${'A'.repeat(550)}`,
        `/api/v1/admin/audit?cursor=${Buffer.from('{"c":"2026-11-20T00:00:00Z","i":"not-a-uuid"}').toString('base64url')}`,
        '/api/v1/admin/audit?startDate=2026-11-25T00:00:00.000Z&endDate=2026-11-20T00:00:00.000Z',
      ];

      for (const url of badCases) {
        const res = await app.inject({
          method: 'GET',
          url,
          headers: { authorization: `Bearer ${superAdminToken}` },
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it('verifies keyset pagination: exact L, L+1, empty result, duplicate timestamps, concurrent insert/delete, and DB secret sanitization', async () => {
      const tieTs = new Date('2026-11-20T12:00:00.000Z');
      const newerTs = new Date('2026-11-21T12:00:00.000Z');
      const olderTs = new Date('2026-11-19T12:00:00.000Z');

      // Create deterministic tie-breaker UUIDs with identical createdAt
      const idTieLow = '0192a000-0000-7000-8000-000000000001';
      const idTieMid = '0192a000-0000-7000-8000-000000000002';
      const idTieHigh = '0192a000-0000-7000-8000-000000000003';
      const idOldest = generateUuidV7();
      createdAuditIds.push(idTieLow, idTieMid, idTieHigh, idOldest);

      await prisma.auditLog.createMany({
        data: [
          {
            id: idTieLow,
            userId: userAdminUser.id,
            action: testActionPrefix,
            entity: 'User',
            entityId: 'target-tie-low',
            metadata: {
              reason: 'Tie low',
              password: 'secret-in-db-password',
              nested: { refresh_token: 'secret-db-rt', conn: 'postgres://u:p@host:5432/db' },
            },
            createdAt: tieTs,
          },
          {
            id: idTieMid,
            userId: userAdminUser.id,
            action: testActionPrefix,
            entity: 'User',
            entityId: 'target-tie-mid',
            metadata: { reason: 'Tie mid' },
            createdAt: tieTs,
          },
          {
            id: idTieHigh,
            userId: userAdminUser.id,
            action: testActionPrefix,
            entity: 'User',
            entityId: 'target-tie-high',
            metadata: { reason: 'Tie high' },
            createdAt: tieTs,
          },
          {
            id: idOldest,
            userId: userAdminUser.id,
            action: testActionPrefix,
            entity: 'Refund',
            entityId: 'target-oldest',
            metadata: { reason: 'Oldest row' },
            createdAt: olderTs,
          },
        ],
      });

      // 1. Empty result test
      const emptyRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/audit?action=NONEXISTENT_ACTION_${ts}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(emptyRes.statusCode).toBe(200);
      expect(emptyRes.json().items).toEqual([]);
      expect(emptyRes.json().hasMore).toBe(false);
      expect(emptyRes.json().nextCursor).toBeNull();

      // 2. Exact L records (4 records matching action, limit=4) -> hasMore: false
      const exactRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/audit?action=${testActionPrefix}&limit=4`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(exactRes.statusCode).toBe(200);
      expect(exactRes.json().items.length).toBe(4);
      expect(exactRes.json().hasMore).toBe(false);

      // 3. Walk duplicate timestamps + UUID tie-breaking at limit=1 & simulate concurrent insertion between pages
      const p1 = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/audit?action=${testActionPrefix}&limit=1`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(p1.json().items[0].id).toBe(idTieHigh);
      expect(p1.json().hasMore).toBe(true);

      // Concurrent INSERT of a newer record while user pages forward
      const idConcurrentNew = generateUuidV7();
      createdAuditIds.push(idConcurrentNew);
      await prisma.auditLog.create({
        data: {
          id: idConcurrentNew,
          userId: userAdminUser.id,
          action: testActionPrefix,
          entity: 'User',
          entityId: 'target-concurrent-new',
          metadata: { reason: 'Inserted during pagination' },
          createdAt: newerTs,
        },
      });

      // Concurrent DELETE of idTieLow shouldn't crash or duplicate page 2
      const p2 = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/audit?action=${testActionPrefix}&limit=1&cursor=${p1.json().nextCursor}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(p2.json().items[0].id).toBe(idTieMid);
      expect(p2.json().hasMore).toBe(true);

      const p3 = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/audit?action=${testActionPrefix}&limit=1&cursor=${p2.json().nextCursor}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(p3.json().items[0].id).toBe(idTieLow);
      expect(p3.json().hasMore).toBe(true);

      // Verify nested DB secret sanitization on p3 item (idTieLow)
      expect(p3.json().items[0].metadata.password).toBe('[REDACTED]');
      expect(p3.json().items[0].metadata.nested.refresh_token).toBe('[REDACTED]');
      expect(p3.json().items[0].metadata.nested.conn).toBe('[REDACTED_CONNECTION_STRING]');

      // Concurrent deletion of oldest row AFTER p3 cursor obtained, then p4 yields empty gracefully
      await prisma.auditLog.delete({ where: { id: idOldest } });
      const p4 = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/audit?action=${testActionPrefix}&limit=1&cursor=${p3.json().nextCursor}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(p4.statusCode).toBe(200);
      expect(p4.json().items).toEqual([]);
      expect(p4.json().hasMore).toBe(false);
    });

    it('denies access immediately when audit.read role is revoked (stale claim resistance)', async () => {
      // Confirm USER_ADMIN currently succeeds
      const beforeRevoke = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit?limit=1',
        headers: { authorization: `Bearer ${userAdminToken}` },
      });
      expect(beforeRevoke.statusCode).toBe(200);

      // Super Admin revokes USER_ADMIN role from userAdminUser (cache invalidated in Redis)
      const saRecord = await prisma.user.findFirstOrThrow({
        where: {
          id: { in: createdUserIds },
          adminUserRoles: { some: { role: { name: 'SUPER_ADMIN' } } },
        },
      });
      await adminRbacService.revokeRole(userAdminUser.id, 'USER_ADMIN', {
        id: saRecord.id,
        adminRoles: ['SUPER_ADMIN'],
      });

      // Same valid JWT must now immediately fail with 403
      const afterRevoke = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit?limit=1',
        headers: { authorization: `Bearer ${userAdminToken}` },
      });
      expect(afterRevoke.statusCode).toBe(403);
    });
  });

  // ============================================================================
  // 4. Service Unit Check (Exact Keyset <= Bound Verification)
  // ============================================================================
  describe('4. Service Keyset Query Composition Check', () => {
    it('includes createdAt <= cursor.createdAt upper bound alongside tie-breaker OR condition for B-Tree seek', async () => {
      const mockFindMany = { findMany: async () => [] };
      const spyCalls: any[] = [];
      const mockPrisma: any = {
        auditLog: {
          findMany: async (args: any) => {
            spyCalls.push(args);
            return mockFindMany.findMany();
          },
        },
      };

      const svc = new AdminAuditService(mockPrisma);
      const cursorDate = new Date('2026-11-24T10:00:00.000Z');
      const cursorId = '0192a0e2-0001-7000-8000-000000000099';
      await svc.listAuditLogs({ cursor: encodeAuditCursor(cursorDate, cursorId), limit: 10 });

      expect(spyCalls.length).toBe(1);
      expect(spyCalls[0].take).toBe(11);
      expect(spyCalls[0].where.AND).toContainEqual({ createdAt: { lte: cursorDate } });
      expect(spyCalls[0].where.AND).toContainEqual({
        OR: [{ createdAt: { lt: cursorDate } }, { createdAt: cursorDate, id: { lt: cursorId } }],
      });
    });

    it('binds cursors to query filter fingerprint and rejects cross-filter cursor reuse with 400', async () => {
      const mockPrisma: any = {
        auditLog: {
          findMany: async () => [
            {
              id: '0192a000-0000-7000-8000-000000000002',
              userId: null,
              user: null,
              action: 'LOGIN_FAILED',
              entity: 'Session',
              entityId: null,
              ipAddress: null,
              userAgent: null,
              metadata: null,
              createdAt: new Date('2026-11-24T10:00:00.000Z'),
            },
            {
              id: '0192a000-0000-7000-8000-000000000001',
              userId: null,
              user: null,
              action: 'LOGIN_FAILED',
              entity: 'Session',
              entityId: null,
              ipAddress: null,
              userAgent: null,
              metadata: null,
              createdAt: new Date('2026-11-24T09:59:00.000Z'),
            },
          ],
        },
      };

      const svc = new AdminAuditService(mockPrisma);
      const page1 = await svc.listAuditLogs({ action: 'LOGIN_FAILED', limit: 1 });
      expect(page1.nextCursor).toBeTruthy();

      // Reusing LOGIN_FAILED cursor on a different filter (USER_REGISTERED) must throw InvalidAuditCursorError
      await expect(
        svc.listAuditLogs({
          action: 'USER_REGISTERED',
          limit: 1,
          cursor: page1.nextCursor!,
        }),
      ).rejects.toThrow(/filter parameters/i);

      // Reusing same cursor with an added search query must also throw InvalidAuditCursorError
      await expect(
        svc.listAuditLogs({
          action: 'LOGIN_FAILED',
          search: 'different',
          limit: 1,
          cursor: page1.nextCursor!,
        }),
      ).rejects.toThrow(/filter parameters/i);

      // Passing same filter succeeds cleanly
      const page2 = await svc.listAuditLogs({
        action: 'LOGIN_FAILED',
        limit: 1,
        cursor: page1.nextCursor!,
      });
      expect(page2.items.length).toBe(1);
    });
  });

  // ============================================================================
  // 5. Deterministic Property-Based Keyset Pagination Verification
  // ============================================================================
  describe('5. Deterministic Property-Based Keyset Pagination Checks', () => {
    it('maintains 100% completeness, zero duplicates, strict (createdAt DESC, id DESC) ordering across random seeded distributions', async () => {
      // Deterministic Xorshift32 PRNG so test is 100% reproducible
      const createPrng = (initialSeed: number) => {
        let state = initialSeed >>> 0 || 1;
        return () => {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          return (state >>> 0) / 0x100000000;
        };
      };

      const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 2026, 31337, 424242];
      for (const seed of seeds) {
        const rand = createPrng(seed);
        const totalRows = Math.floor(rand() * 35); // covers 0, 1, exact boundary, and multi-page
        const pageSize = 1 + Math.floor(rand() * 8);
        const baseMs = Date.UTC(2026, 10, 1, 0, 0, 0);

        // Intentionally cluster timestamps into narrow buckets to force equal-timestamp UUIDv7 ties
        const dataset = Array.from({ length: totalRows }, (_, idx) => {
          const tsBucket = Math.floor(rand() * Math.max(1, Math.ceil(totalRows / 3)));
          const randHigh = Math.floor(rand() * 0xffffff)
            .toString(16)
            .padStart(6, '0');
          const uniqueLow = (idx + 1).toString(16).padStart(6, '0');
          return {
            id: `0192a000-0000-7000-8000-${randHigh}${uniqueLow}`,
            userId: null,
            user: null,
            action: 'PROP_TEST',
            entity: 'AuditLog',
            entityId: `e-${idx}`,
            ipAddress: null,
            userAgent: null,
            metadata: { seq: idx },
            createdAt: new Date(baseMs + tsBucket * 1000),
          };
        });

        const oracleSort = (a: (typeof dataset)[number], b: (typeof dataset)[number]) => {
          const dt = b.createdAt.getTime() - a.createdAt.getTime();
          if (dt !== 0) return dt;
          return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
        };

        const mockPrisma: any = {
          auditLog: {
            findMany: async ({ where, take }: { where: any; take: number }) => {
              let filtered = [...dataset].sort(oracleSort);
              const andArr: any[] = where?.AND || [];
              for (const cond of andArr) {
                if (cond.action) {
                  filtered = filtered.filter((r) => r.action === cond.action);
                }
                if (cond.OR && Array.isArray(cond.OR) && cond.OR.length === 2) {
                  const ltDate: Date = cond.OR[0].createdAt.lt;
                  const eqDate: Date = cond.OR[1].createdAt;
                  const ltId: string = cond.OR[1].id.lt;
                  filtered = filtered.filter(
                    (r) =>
                      r.createdAt.getTime() < ltDate.getTime() ||
                      (r.createdAt.getTime() === eqDate.getTime() && r.id < ltId),
                  );
                }
              }
              return filtered.slice(0, take);
            },
          },
        };

        const svc = new AdminAuditService(mockPrisma);
        const collected: string[] = [];
        let cursor: string | undefined;
        let guard = 0;

        while (true) {
          guard += 1;
          expect(guard).toBeLessThanOrEqual(totalRows + 2);
          const page = await svc.listAuditLogs({
            action: 'PROP_TEST',
            limit: pageSize,
            ...(cursor ? { cursor } : {}),
          });

          expect(page.items.length).toBeLessThanOrEqual(pageSize);
          for (const item of page.items) {
            collected.push(item.id);
          }

          if (!page.hasMore) {
            expect(page.nextCursor).toBeNull();
            break;
          }
          expect(page.nextCursor).not.toBeNull();
          cursor = page.nextCursor!;
        }

        const expectedOrder = [...dataset].sort(oracleSort).map((r) => r.id);
        expect(collected).toEqual(expectedOrder);
        expect(new Set(collected).size).toBe(expectedOrder.length);
      }
    });
  });
});
