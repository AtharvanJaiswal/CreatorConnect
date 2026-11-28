import type { FastifyPluginAsync } from 'fastify';
import { QueueMetricsResponseSchema } from '@creatorconnect/contracts';
import { Type, type Static } from '@sinclair/typebox';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminJobsService, AdminJobsService } from './admin-jobs.service.js';

const QueueNameParamSchema = Type.Object({
  queueName: Type.String({ minLength: 2, maxLength: 64 }),
});
type QueueNameParam = Static<typeof QueueNameParamSchema>;

export interface AdminJobsRoutesOptions {
  jobsSvc?: AdminJobsService;
}

export const adminJobsRoutes: FastifyPluginAsync<AdminJobsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.jobsSvc || adminJobsService;

  // GET /api/v1/admin/jobs/queues
  fastify.get(
    '/api/v1/admin/jobs/queues',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.read')],
      schema: {
        description: 'Monitors BullMQ worker queue health, backlog sizes, and active worker counts',
        tags: ['Admin Jobs'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(QueueMetricsResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (_request, reply) => {
      const metrics = await service.getQueueMetrics();
      return reply.status(200).send(metrics);
    },
  );

  // POST /api/v1/admin/jobs/queues/:queueName/retry-failed
  fastify.post<{ Params: QueueNameParam }>(
    '/api/v1/admin/jobs/queues/:queueName/retry-failed',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.manage')],
      schema: {
        description:
          'Re-queues failed background jobs for a specific worker queue with audit trail',
        tags: ['Admin Jobs'],
        security: [{ bearerAuth: [] }],
        params: QueueNameParamSchema,
        response: {
          200: Type.Object({ retriedCount: Type.Integer() }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.retryFailedJobs(request.params.queueName, request.user.id);
      return reply.status(200).send(result);
    },
  );
};
