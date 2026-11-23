import type { FastifyPluginAsync } from 'fastify';
import {
  UserResponseSchema,
  UserSelfDeactivateRequestSchema,
  UserSelfReactivateRequestSchema,
  CreateLegalHoldRequestSchema,
  ReleaseLegalHoldRequestSchema,
  LegalHoldResponseSchema,
  CreateErasureRequestSchema,
  ConfirmErasureRequestSchema,
  CancelErasureRequestSchema,
  PrivacyRequestResponseSchema,
  VerifyPrivacyReceiptRequestSchema,
  type UserSelfDeactivateRequest,
  type UserSelfReactivateRequest,
  type CreateLegalHoldRequest,
  type ReleaseLegalHoldRequest,
  type CreateErasureRequest,
  type ConfirmErasureRequest,
  type CancelErasureRequest,
  type VerifyPrivacyReceiptRequest,
} from '@creatorconnect/contracts';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { Type } from '@sinclair/typebox';
import { defaultJwtVerifier, JwtVerifier } from '@creatorconnect/auth';
import { accountLifecycleService, AccountLifecycleService } from './account-lifecycle.service.js';
import { legalHoldService, LegalHoldService } from './legal-hold.service.js';
import { privacyRequestService, PrivacyRequestService } from './privacy-request.service.js';
import { dataErasureOrchestrator, DataErasureOrchestrator } from './data-erasure-orchestrator.js';
import { privacyAuditService, PrivacyAuditService } from './privacy-audit.service.js';
import { userRepository, IUserRepository } from '../../repositories/user.repository.js';
import {
  AuthInvalidTokenError,
  UserSuspendedError,
  IdentityNotSyncedError,
  NotFoundError,
} from '../../errors/app-error.js';

export const HoldIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  holdId: Type.String({ format: 'uuid' }),
});
export type HoldIdParam = { id: string; holdId: string };

export interface LifecycleRoutesOptions {
  lifecycleSvc?: AccountLifecycleService;
  holdSvc?: LegalHoldService;
  privacySvc?: PrivacyRequestService;
  erasureOrchestrator?: DataErasureOrchestrator;
  auditSvc?: PrivacyAuditService;
  userRepo?: IUserRepository;
  jwtVerifier?: JwtVerifier;
}

export const lifecycleRoutes: FastifyPluginAsync<LifecycleRoutesOptions> = async (
  fastify,
  options,
) => {
  const lifecycleSvc = options.lifecycleSvc || accountLifecycleService;
  const holdSvc = options.holdSvc || legalHoldService;
  const privacySvc = options.privacySvc || privacyRequestService;
  const erasureOrchestrator = options.erasureOrchestrator || dataErasureOrchestrator;
  const auditSvc = options.auditSvc || privacyAuditService;
  const userRepo = options.userRepo || userRepository;
  const jwtVerifier = options.jwtVerifier || defaultJwtVerifier;

  // ============================================================================
  // 1. User Self-Service Account Lifecycle
  // ============================================================================

  // POST /api/v1/users/me/deactivate
  fastify.post<{ Body: UserSelfDeactivateRequest }>(
    '/api/v1/users/me/deactivate',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Self-service account deactivation for authenticated user',
        tags: ['Lifecycle'],
        security: [{ bearerAuth: [] }],
        body: UserSelfDeactivateRequestSchema,
        response: {
          200: UserResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await lifecycleSvc.selfDeactivate(
        request.user.id,
        request.body.reason,
        request.ip,
        request.headers['user-agent'],
      );
      return reply.status(200).send({
        ...user,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  );

  // POST /api/v1/users/me/reactivate
  // Special auth: validates JWT for currently DEACTIVATED user
  fastify.post<{ Body: UserSelfReactivateRequest }>(
    '/api/v1/users/me/reactivate',
    {
      schema: {
        description: 'Self-service account reactivation for deactivated account owner',
        tags: ['Lifecycle'],
        security: [{ bearerAuth: [] }],
        body: UserSelfReactivateRequestSchema,
        response: {
          200: UserResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthInvalidTokenError('Bearer token required for reactivation.');
      }
      const token = authHeader.substring(7).trim();
      const payload = await jwtVerifier.verifyToken(token);

      const statusRecord = await userRepo.getStatusBySub(payload.sub);
      if (!statusRecord) {
        throw new IdentityNotSyncedError('User record not found.');
      }

      if (statusRecord.status === 'SUSPENDED') {
        throw new UserSuspendedError('Suspended accounts cannot self-reactivate. Contact support.');
      }

      const reactivated = await lifecycleSvc.selfReactivate(
        statusRecord.id,
        request.ip,
        request.headers['user-agent'],
      );

      return reply.status(200).send({
        ...reactivated,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  );

  // ============================================================================
  // 2. User Privacy & Right to Erasure (DSAR)
  // ============================================================================

  // POST /api/v1/privacy/erasure-request
  fastify.post<{ Body: CreateErasureRequest }>(
    '/api/v1/privacy/erasure-request',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Initiate Right to Erasure request under parent-row lock',
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        body: CreateErasureRequestSchema,
        response: {
          202: Type.Object({
            requestId: Type.String({ format: 'uuid' }),
            status: Type.String(),
            confirmationCode: Type.String(),
            coolingOffEndsAt: Type.String({ format: 'date-time' }),
          }),
          401: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const { request: erasureReq, rawConfirmationCode } = await privacySvc.requestErasure(
        request.user.id,
      );
      return reply.status(202).send({
        requestId: erasureReq.id,
        status: erasureReq.status,
        confirmationCode: rawConfirmationCode,
        coolingOffEndsAt: erasureReq.coolingOffEndsAt?.toISOString() || '',
      });
    },
  );

  // POST /api/v1/privacy/erasure-request/confirm
  fastify.post<{ Body: ConfirmErasureRequest }>(
    '/api/v1/privacy/erasure-request/confirm',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Confirm erasure request with CSPRNG code to begin cooling-off',
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        body: ConfirmErasureRequestSchema,
        response: {
          200: PrivacyRequestResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const confirmed = await privacySvc.confirmErasure(
        request.user.id,
        request.body.confirmationCode,
      );
      return reply.status(200).send({
        ...confirmed,
        confirmedAt: confirmed.confirmedAt?.toISOString() || null,
        coolingOffEndsAt: confirmed.coolingOffEndsAt?.toISOString() || null,
        scheduledPurgeAt: confirmed.scheduledPurgeAt?.toISOString() || null,
        completedAt: confirmed.completedAt?.toISOString() || null,
        createdAt: confirmed.createdAt.toISOString(),
        updatedAt: confirmed.updatedAt.toISOString(),
      });
    },
  );

  // POST /api/v1/privacy/erasure-request/cancel
  fastify.post<{ Body: CancelErasureRequest }>(
    '/api/v1/privacy/erasure-request/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Cancel pending erasure request during cooling-off',
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        body: CancelErasureRequestSchema,
        response: {
          200: PrivacyRequestResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const cancelled = await privacySvc.cancelErasure(request.user.id, request.body.reason);
      return reply.status(200).send({
        ...cancelled,
        confirmedAt: cancelled.confirmedAt?.toISOString() || null,
        coolingOffEndsAt: cancelled.coolingOffEndsAt?.toISOString() || null,
        scheduledPurgeAt: cancelled.scheduledPurgeAt?.toISOString() || null,
        completedAt: cancelled.completedAt?.toISOString() || null,
        createdAt: cancelled.createdAt.toISOString(),
        updatedAt: cancelled.updatedAt.toISOString(),
      });
    },
  );

  // GET /api/v1/privacy/erasure-request/status
  fastify.get(
    '/api/v1/privacy/erasure-request/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Check active privacy request status for user',
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        response: {
          200: PrivacyRequestResponseSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const status = await privacySvc.getStatus(request.user.id);
      if (!status) {
        throw new NotFoundError('No active privacy request found for this account.');
      }
      return reply.status(200).send({
        ...status,
        confirmedAt: status.confirmedAt?.toISOString() || null,
        coolingOffEndsAt: status.coolingOffEndsAt?.toISOString() || null,
        scheduledPurgeAt: status.scheduledPurgeAt?.toISOString() || null,
        completedAt: status.completedAt?.toISOString() || null,
        createdAt: status.createdAt.toISOString(),
        updatedAt: status.updatedAt.toISOString(),
      });
    },
  );

  // POST /api/v1/privacy/verify-receipt
  fastify.post<{ Body: VerifyPrivacyReceiptRequest }>(
    '/api/v1/privacy/verify-receipt',
    {
      preHandler: [
        fastify.rateLimit({
          endpoint: 'privacy-verify-receipt',
          max: 10,
          windowSeconds: 60,
          onRedisFailure: 'bounded-fallback',
          fallbackMax: 5,
        }),
      ],
      schema: {
        description: 'Verify compliance audit certificate token (Public/Auditor endpoint)',
        tags: ['Privacy'],
        body: VerifyPrivacyReceiptRequestSchema,
        response: {
          200: Type.Object({
            valid: Type.Boolean(),
            actionTaken: Type.String(),
            completedAt: Type.String({ format: 'date-time' }),
            recordsProcessed: Type.Integer(),
            mediaFilesPurged: Type.Integer(),
          }),
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const res = await auditSvc.verifyReceiptToken(request.body.certificateToken);
      return reply.status(200).send({
        valid: res.valid,
        actionTaken: res.metadata?.actionTaken || 'IN_PLACE_PSEUDONYMIZATION',
        completedAt: res.metadata?.completedAt || new Date().toISOString(),
        recordsProcessed: res.metadata?.recordsProcessed || 0,
        mediaFilesPurged: res.metadata?.mediaFilesPurged || 0,
      });
    },
  );

  // ============================================================================
  // 3. Admin Legal Hold Management (Parent-Row Locking)
  // ============================================================================

  // POST /api/v1/admin/users/:id/legal-holds
  fastify.post<{ Params: IdParam; Body: CreateLegalHoldRequest }>(
    '/api/v1/admin/users/:id/legal-holds',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(['ADMIN'])],
      schema: {
        description: 'Apply legal hold to user with parent-row locking',
        tags: ['Admin', 'LegalHold'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: CreateLegalHoldRequestSchema,
        response: {
          201: LegalHoldResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateLegalHoldRequest;
      const hold = await holdSvc.applyHold({
        userId: request.params.id,
        reason: body.reason,
        caseReference: body.caseReference,
        notes: body.notes,
        appliedById: request.user.id,
      });

      return reply.status(201).send({
        ...hold,
        appliedAt: hold.appliedAt.toISOString(),
        releasedAt: hold.releasedAt?.toISOString() || null,
      });
    },
  );

  // DELETE /api/v1/admin/users/:id/legal-holds/:holdId
  fastify.delete<{ Params: HoldIdParam; Body: ReleaseLegalHoldRequest }>(
    '/api/v1/admin/users/:id/legal-holds/:holdId',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(['ADMIN'])],
      schema: {
        description: 'Release active legal hold with parent-row locking',
        tags: ['Admin', 'LegalHold'],
        security: [{ bearerAuth: [] }],
        params: HoldIdParamSchema,
        body: ReleaseLegalHoldRequestSchema,
        response: {
          200: LegalHoldResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as ReleaseLegalHoldRequest;
      const released = await holdSvc.releaseHold({
        holdId: request.params.holdId,
        releasedById: request.user.id,
        releaseNotes: body.releaseNotes,
      });

      return reply.status(200).send({
        ...released,
        appliedAt: released.appliedAt.toISOString(),
        releasedAt: released.releasedAt?.toISOString() || null,
      });
    },
  );

  // GET /api/v1/admin/users/:id/legal-holds
  fastify.get<{ Params: IdParam }>(
    '/api/v1/admin/users/:id/legal-holds',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(['ADMIN'])],
      schema: {
        description: 'List active legal holds for user',
        tags: ['Admin', 'LegalHold'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: Type.Array(LegalHoldResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const holds = await holdSvc.getActiveHolds(request.params.id);
      return reply.status(200).send(
        holds.map((h) => ({
          ...h,
          appliedAt: h.appliedAt.toISOString(),
          releasedAt: h.releasedAt?.toISOString() || null,
        })),
      );
    },
  );

  // ============================================================================
  // 4. Admin Erasure Workflow Execution
  // ============================================================================

  // POST /api/v1/admin/privacy/requests/:id/execute
  fastify.post<{ Params: IdParam }>(
    '/api/v1/admin/privacy/requests/:id/execute',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(['ADMIN'])],
      schema: {
        description: 'Execute multi-stage erasure workflow for confirmed request',
        tags: ['Admin', 'Privacy'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: Type.Object({
            requestId: Type.String({ format: 'uuid' }),
            userId: Type.String({ format: 'uuid' }),
            status: Type.String(),
            stagesCompleted: Type.Array(Type.String()),
            recordsScrubbed: Type.Integer(),
            mediaFilesPurged: Type.Integer(),
          }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await erasureOrchestrator.executeErasure(request.params.id);
      return reply.status(200).send({
        requestId: result.requestId,
        userId: result.userId,
        status: result.status,
        stagesCompleted: result.stagesCompleted,
        recordsScrubbed: result.recordsScrubbed,
        mediaFilesPurged: result.mediaFilesPurged,
      });
    },
  );
};
