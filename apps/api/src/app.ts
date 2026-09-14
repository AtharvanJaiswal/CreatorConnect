import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import { createProblemDetails } from '@creatorconnect/validation';
import { loggerConfig } from './plugins/logger.js';
import { errorHandler } from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { profilesRoutes } from './modules/profiles/profiles.routes.js';
import { portfolioRoutes } from './modules/portfolio/portfolio.routes.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { assignmentsRoutes } from './modules/assignments/assignments.routes.js';
import { applicationsRoutes } from './modules/applications/applications.routes.js';
import { discoveryRoutes } from './modules/discovery/discovery.routes.js';

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: loggerConfig,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    ajv: {
      customOptions: {
        strict: false,
      },
      plugins: [
        (ajv: any) => {
          ajv.addFormat('https-url', {
            type: 'string',
            validate: (value: string) => {
              try {
                if (typeof value !== 'string' || !value.startsWith('https://')) return false;
                const parsed = new URL(value);
                return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
              } catch {
                return false;
              }
            },
          });
        },
      ],
    },
    ...opts,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  });

  await app.register(sensible);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CreatorConnect API',
        description: 'CreatorConnect Core REST API documentation',
        version: '0.1.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Supabase-issued RS256/ES256 Access Token',
          },
        },
      },
    },
  });

  await app.register(scalar, {
    routePrefix: '/docs',
  });

  // Register Core Authentication & Identity Plugin
  await app.register(authPlugin);

  app.setErrorHandler(errorHandler);

  app.setNotFoundHandler((request, reply) => {
    const problem = createProblemDetails({
      type: 'https://api.creatorconnect.com/errors/not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: `Route ${request.method} ${request.url} not found`,
      instance: request.url,
      code: 'NOT_FOUND',
      requestId: request.id,
    });
    return reply.status(404).type('application/problem+json').send(problem);
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(profilesRoutes);
  await app.register(portfolioRoutes);
  await app.register(mediaRoutes);
  await app.register(assignmentsRoutes);
  await app.register(applicationsRoutes);
  await app.register(discoveryRoutes);

  return app;
}
