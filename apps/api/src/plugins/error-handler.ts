import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { createProblemDetails } from '@creatorconnect/validation';
import { AppError } from '../errors/app-error.js';

export function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    request.log.warn(
      { code: error.code, statusCode: error.statusCode, reqId: request.id, detail: error.detail },
      'Application Security/Domain Rejection',
    );

    const problem = createProblemDetails({
      type: `https://api.creatorconnect.com/errors/${error.code.toLowerCase().replace(/_/g, '-')}`,
      title: error.title,
      status: error.statusCode,
      detail: error.detail,
      code: error.code,
      instance: request.url,
      requestId: request.id,
    });

    return reply.status(error.statusCode).type('application/problem+json').send(problem);
  }

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
    requestId: request.id,
  });

  return reply.status(statusCode).type('application/problem+json').send(problem);
}
