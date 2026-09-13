import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import { createProblemDetails } from '@creatorconnect/validation';
import { loggerConfig } from './plugins/logger.js';
import { errorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: loggerConfig,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
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
    },
  });

  await app.register(scalar, {
    routePrefix: '/docs',
  });

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

  return app;
}
