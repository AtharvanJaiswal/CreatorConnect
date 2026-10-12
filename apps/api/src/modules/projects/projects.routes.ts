import type { FastifyPluginAsync } from 'fastify';
import {
  ProjectResponseSchema,
  ProjectDeliverableResponseSchema,
  CreateProjectInputSchema,
  SubmitDeliverableInputSchema,
  ReviewDeliverableInputSchema,
  ProjectStatusSchema,
  type CreateProjectInput,
  type SubmitDeliverableInput,
  type ReviewDeliverableInput,
} from '@creatorconnect/contracts';
import { Type, type Static } from '@sinclair/typebox';
import {
  IdParamSchema,
  type IdParam,
  ProblemDetailsSchema,
  UuidSchema,
} from '@creatorconnect/validation';
import { projectsService, ProjectsService } from './projects.service.js';

export interface ProjectsRoutesOptions {
  projectsSvc?: ProjectsService;
}

const ProjectDeliverableParamsSchema = Type.Object({
  id: UuidSchema,
  deliverableId: UuidSchema,
});
type ProjectDeliverableParams = Static<typeof ProjectDeliverableParamsSchema>;

const ListProjectsQuerySchema = Type.Object({
  role: Type.Optional(Type.Union([Type.Literal('client'), Type.Literal('talent')])),
  status: Type.Optional(ProjectStatusSchema),
});
type ListProjectsQuery = Static<typeof ListProjectsQuerySchema>;

export const projectsRoutes: FastifyPluginAsync<ProjectsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.projectsSvc || projectsService;

  // GET /api/v1/projects
  fastify.get<{ Querystring: ListProjectsQuery }>(
    '/api/v1/projects',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists projects involving the authenticated user',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        querystring: ListProjectsQuerySchema,
        response: {
          200: Type.Array(ProjectResponseSchema),
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const results = await service.listProjects(request.user.id, request.query);
      return reply.send(results);
    },
  );

  // POST /api/v1/projects
  fastify.post<{ Body: CreateProjectInput }>(
    '/api/v1/projects',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'project-create',
          max: 20,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Initializes a project contract for an accepted application',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        body: CreateProjectInputSchema,
        response: {
          201: ProjectResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.createProject(request.user.id, request.body, isAdmin);
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/projects/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/projects/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves project contract details, milestones, and deliverables',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: ProjectResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.getProject(request.user.id, request.params.id, isAdmin);
      return reply.send(result);
    },
  );

  // POST /api/v1/projects/:id/deliverables/:deliverableId/submit
  fastify.post<{ Params: ProjectDeliverableParams; Body: SubmitDeliverableInput }>(
    '/api/v1/projects/:id/deliverables/:deliverableId/submit',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'deliverable-submit',
          max: 30,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Submits a project deliverable for review (talent only)',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        params: ProjectDeliverableParamsSchema,
        body: SubmitDeliverableInputSchema,
        response: {
          200: ProjectDeliverableResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.submitDeliverable(
        request.user.id,
        request.params.id,
        request.params.deliverableId,
        request.body,
      );
      return reply.send(result);
    },
  );

  // POST /api/v1/projects/:id/deliverables/:deliverableId/review
  fastify.post<{ Params: ProjectDeliverableParams; Body: ReviewDeliverableInput }>(
    '/api/v1/projects/:id/deliverables/:deliverableId/review',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'deliverable-review',
          max: 30,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description:
          'Reviews a submitted deliverable: approves or requests revisions (client only)',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        params: ProjectDeliverableParamsSchema,
        body: ReviewDeliverableInputSchema,
        response: {
          200: ProjectDeliverableResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.reviewDeliverable(
        request.user.id,
        request.params.id,
        request.params.deliverableId,
        request.body,
      );
      return reply.send(result);
    },
  );
};
