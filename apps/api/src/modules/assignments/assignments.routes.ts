import type { FastifyPluginAsync } from 'fastify';
import {
  CreateAssignmentInputSchema,
  UpdateAssignmentInputSchema,
  AssignmentResponseSchema,
  type CreateAssignmentInput,
  type UpdateAssignmentInput,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { assignmentsService, AssignmentsService } from './assignments.service.js';

export interface AssignmentsRoutesOptions {
  assignmentsSvc?: AssignmentsService;
}

export const assignmentsRoutes: FastifyPluginAsync<AssignmentsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.assignmentsSvc || assignmentsService;

  // POST /api/v1/assignments
  fastify.post<{ Body: CreateAssignmentInput }>(
    '/api/v1/assignments',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Creates a new assignment (BRAND role required)',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        body: CreateAssignmentInputSchema,
        response: {
          201: AssignmentResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.createAssignment(
        request.user.id,
        request.user.roles,
        request.body,
      );
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/assignments/mine
  fastify.get(
    '/api/v1/assignments/mine',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists all assignments owned by the authenticated brand',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(AssignmentResponseSchema),
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getBrandAssignments(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/assignments/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/assignments/:id',
    {
      schema: {
        description: 'Retrieves an assignment by ID (side-effect free)',
        tags: ['Assignments'],
        params: IdParamSchema,
        response: {
          200: AssignmentResponseSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = (request as any).user?.id;
      const isAdmin = (request as any).user?.roles?.includes('ADMIN') ?? false;
      const result = await service.getAssignment(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

  // PUT /api/v1/assignments/:id
  fastify.put<{ Params: IdParam; Body: UpdateAssignmentInput }>(
    '/api/v1/assignments/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Updates an assignment with optimistic concurrency check',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: UpdateAssignmentInputSchema,
        response: {
          200: AssignmentResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updateAssignment(
        request.user.id,
        request.params.id,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // DELETE /api/v1/assignments/:id
  fastify.delete<{ Params: IdParam }>(
    '/api/v1/assignments/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Soft-deletes an owned assignment',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          204: Type.Null(),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      await service.deleteAssignment(request.user.id, request.params.id);
      return reply.status(204).send();
    },
  );

  // POST /api/v1/assignments/:id/publish
  fastify.post<{ Params: IdParam; Body: { version: number } }>(
    '/api/v1/assignments/:id/publish',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Transitions an assignment to PUBLISHED status',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: Type.Object({ version: Type.Integer({ minimum: 1 }) }),
        response: {
          200: AssignmentResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.publishAssignment(
        request.user.id,
        request.params.id,
        request.body.version,
      );
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/assignments/:id/close
  fastify.post<{ Params: IdParam; Body: { version: number } }>(
    '/api/v1/assignments/:id/close',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Transitions an assignment to CLOSED status',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: Type.Object({ version: Type.Integer({ minimum: 1 }) }),
        response: {
          200: AssignmentResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.closeAssignment(
        request.user.id,
        request.params.id,
        request.body.version,
      );
      return reply.status(200).send(result);
    },
  );
};
