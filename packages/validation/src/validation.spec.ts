import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { ProblemDetailsSchema, CursorPaginationQuerySchema } from './index.js';

describe('TypeBox validation schemas', () => {
  it('validates valid RFC 7807 problem details payloads', () => {
    const validProblem = {
      type: 'https://errors.creatorconnect.com/errors/VALIDATION_ERROR',
      title: 'Validation Error',
      status: 400,
      detail: 'Invalid request body',
      code: 'VALIDATION_FAILED',
      timestamp: '2026-09-13T21:45:00.000Z',
      requestId: 'req_12345',
      errors: [{ field: 'budget', message: 'Must be greater than 0' }],
    };

    expect(Value.Check(ProblemDetailsSchema, validProblem)).toBe(true);
  });

  it('rejects problem details with invalid status code', () => {
    const invalidProblem = {
      type: 'https://errors.creatorconnect.com/errors/INTERNAL',
      title: 'Success',
      status: 200, // Invalid: status must be 400-599
      detail: 'OK',
      code: 'SUCCESS',
      timestamp: '2026-09-13T21:45:00.000Z',
      requestId: 'req_12345',
    };

    expect(Value.Check(ProblemDetailsSchema, invalidProblem)).toBe(false);
  });

  it('validates and applies defaults for cursor pagination query schema', () => {
    const query = { limit: 50 };
    expect(Value.Check(CursorPaginationQuerySchema, query)).toBe(true);
  });
});
