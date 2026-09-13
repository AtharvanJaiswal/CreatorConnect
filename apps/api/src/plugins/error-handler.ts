import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { createProblemDetails } from '@creatorconnect/validation';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

  request.log.error({ err: error, reqId: request.id }, 'API Request Error Encountered');

  const problem = createProblemDetails({
    type: `https://api.creatorconnect.com/errors/${error.code || 'internal-server-error'}`,
    title: error.name || 'Internal Server Error',
    status: statusCode,
    detail:
      statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : error.message,
    instance: request.url,
  });

  return reply.status(statusCode).type('application/problem+json').send(problem);
}
