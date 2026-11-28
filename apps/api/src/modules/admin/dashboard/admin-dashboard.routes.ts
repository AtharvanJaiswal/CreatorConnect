import type { FastifyPluginAsync } from 'fastify';
import {
  DashboardOverviewResponseSchema,
  DashboardDateRangeQuerySchema,
  type DashboardDateRangeQuery,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminDashboardService, AdminDashboardService } from './admin-dashboard.service.js';

export interface AdminDashboardRoutesOptions {
  dashboardSvc?: AdminDashboardService;
}

export const adminDashboardRoutes: FastifyPluginAsync<AdminDashboardRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.dashboardSvc || adminDashboardService;

  // GET /api/v1/admin/dashboard/overview
  fastify.get<{ Querystring: DashboardDateRangeQuery }>(
    '/api/v1/admin/dashboard/overview',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('analytics.read')],
      schema: {
        description:
          'Aggregated platform dashboard metrics, user growth, revenue, and active operations',
        tags: ['Admin Dashboard'],
        security: [{ bearerAuth: [] }],
        querystring: DashboardDateRangeQuerySchema,
        response: {
          200: DashboardOverviewResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const overview = await service.getOverview(request.query);
      return reply.status(200).send(overview);
    },
  );

  // GET /api/v1/admin/dashboard/registrations
  fastify.get<{ Querystring: DashboardDateRangeQuery }>(
    '/api/v1/admin/dashboard/registrations',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('analytics.read')],
      schema: {
        description: 'User registration statistics and growth metrics across time windows',
        tags: ['Admin Dashboard'],
        security: [{ bearerAuth: [] }],
        querystring: DashboardDateRangeQuerySchema,
        response: {
          200: Type.Object({
            period: Type.String(),
            totalUsers: Type.Integer(),
            activeUsers: Type.Integer(),
            newRegistrations: Type.Integer(),
            registrationGrowthPercent: Type.Number(),
            suspendedAccounts: Type.Integer(),
            activeCreators: Type.Integer(),
            activeClients: Type.Integer(),
          }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const overview = await service.getOverview(request.query);
      return reply.status(200).send({
        period: overview.period,
        totalUsers: overview.metrics.totalUsers,
        activeUsers: overview.metrics.activeUsers,
        newRegistrations: overview.metrics.newRegistrations,
        registrationGrowthPercent: overview.metrics.registrationGrowthPercent,
        suspendedAccounts: overview.metrics.suspendedAccounts,
        activeCreators: overview.metrics.activeCreators,
        activeClients: overview.metrics.activeClients,
      });
    },
  );

  // GET /api/v1/admin/dashboard/transactions
  fastify.get<{ Querystring: DashboardDateRangeQuery }>(
    '/api/v1/admin/dashboard/transactions',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('analytics.read')],
      schema: {
        description:
          'Financial transactions, platform fee revenue, and payment success rate metrics',
        tags: ['Admin Dashboard'],
        security: [{ bearerAuth: [] }],
        querystring: DashboardDateRangeQuerySchema,
        response: {
          200: Type.Object({
            period: Type.String(),
            totalTransactions: Type.Integer(),
            successfulPayments: Type.Integer(),
            failedPayments: Type.Integer(),
            paymentSuccessRate: Type.Number(),
            totalTransactionVolumeMinor: Type.String(),
            platformRevenueMinor: Type.String(),
            pendingRefundsCount: Type.Integer(),
            pendingRefundsVolumeMinor: Type.String(),
          }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const overview = await service.getOverview(request.query);
      return reply.status(200).send({
        period: overview.period,
        totalTransactions: overview.metrics.totalTransactions,
        successfulPayments: overview.metrics.successfulPayments,
        failedPayments: overview.metrics.failedPayments,
        paymentSuccessRate: overview.metrics.paymentSuccessRate,
        totalTransactionVolumeMinor: overview.metrics.totalTransactionVolumeMinor,
        platformRevenueMinor: overview.metrics.platformRevenueMinor,
        pendingRefundsCount: overview.metrics.pendingRefundsCount,
        pendingRefundsVolumeMinor: overview.metrics.pendingRefundsVolumeMinor,
      });
    },
  );

  // GET /api/v1/admin/dashboard/projects
  fastify.get<{ Querystring: DashboardDateRangeQuery }>(
    '/api/v1/admin/dashboard/projects',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('analytics.read')],
      schema: {
        description: 'Marketplace project volume, completion rates, and active progress status',
        tags: ['Admin Dashboard'],
        security: [{ bearerAuth: [] }],
        querystring: DashboardDateRangeQuerySchema,
        response: {
          200: Type.Object({
            period: Type.String(),
            projectsCreated: Type.Integer(),
            projectsInProgress: Type.Integer(),
            projectsCompleted: Type.Integer(),
            projectsDisputed: Type.Integer(),
            projectCompletionRate: Type.Number(),
          }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const overview = await service.getOverview(request.query);
      return reply.status(200).send({
        period: overview.period,
        projectsCreated: overview.metrics.projectsCreated,
        projectsInProgress: overview.metrics.projectsInProgress,
        projectsCompleted: overview.metrics.projectsCompleted,
        projectsDisputed: overview.metrics.projectsDisputed,
        projectCompletionRate: overview.metrics.projectCompletionRate,
      });
    },
  );

  // GET /api/v1/admin/dashboard/moderation
  fastify.get<{ Querystring: DashboardDateRangeQuery }>(
    '/api/v1/admin/dashboard/moderation',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('analytics.read')],
      schema: {
        description: 'Trust, safety, moderation queue backlog, and support response times',
        tags: ['Admin Dashboard'],
        security: [{ bearerAuth: [] }],
        querystring: DashboardDateRangeQuerySchema,
        response: {
          200: Type.Object({
            period: Type.String(),
            openSupportTickets: Type.Integer(),
            pendingModerationReports: Type.Integer(),
            averageSupportResponseMinutes: Type.Number(),
          }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const overview = await service.getOverview(request.query);
      return reply.status(200).send({
        period: overview.period,
        openSupportTickets: overview.metrics.openSupportTickets,
        pendingModerationReports: overview.metrics.pendingModerationReports,
        averageSupportResponseMinutes: overview.metrics.averageSupportResponseMinutes,
      });
    },
  );
};
