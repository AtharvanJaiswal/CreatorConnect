import { Type, type Static } from '@sinclair/typebox';

/**
 * Standard RFC 7807 Problem Details Schema for all 4xx and 5xx API errors.
 */

export const ValidationErrorItemSchema = Type.Object({
  field: Type.String(),
  message: Type.String(),
  rule: Type.Optional(Type.String()),
});
export type ValidationErrorItem = Static<typeof ValidationErrorItemSchema>;

export const ProblemDetailsSchema = Type.Object({
  type: Type.String({ format: 'uri', description: 'Error taxonomy URI' }),
  title: Type.String({ description: 'Short summary of the problem' }),
  status: Type.Integer({ minimum: 400, maximum: 599, description: 'HTTP status code' }),
  detail: Type.String({ description: 'Human-readable explanation specific to this occurrence' }),
  instance: Type.Optional(
    Type.String({ description: 'URI reference identifying specific occurrence' }),
  ),
  code: Type.String({ description: 'Application-specific machine-readable error code' }),
  timestamp: Type.String({ format: 'date-time' }),
  requestId: Type.String({ description: 'Correlation / Request tracing identifier' }),
  errors: Type.Optional(Type.Array(ValidationErrorItemSchema)),
});
export type ProblemDetails = Static<typeof ProblemDetailsSchema>;

export function createProblemDetails(
  params: Partial<ProblemDetails> & { status: number; title: string },
): ProblemDetails {
  const result: ProblemDetails = {
    type: params.type || `https://api.creatorconnect.com/errors/${params.code || 'error'}`,
    title: params.title,
    status: params.status,
    detail: params.detail || params.title,
    code: params.code || 'ERROR',
    timestamp: params.timestamp || new Date().toISOString(),
    requestId: params.requestId || 'req_unknown',
  };

  if (params.instance !== undefined) {
    result.instance = params.instance;
  }
  if (params.errors !== undefined) {
    result.errors = params.errors;
  }

  return result;
}
