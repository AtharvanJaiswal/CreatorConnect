import 'package:flutter/foundation.dart';

/// Base class for all application-level errors conforming to RFC 7807 Problem Details.
@immutable
abstract class AppException implements Exception {
  final String title;
  final String message;
  final int? statusCode;
  final String? code;
  final String? requestId;
  final dynamic originalError;

  const AppException({
    required this.title,
    required this.message,
    this.statusCode,
    this.code,
    this.requestId,
    this.originalError,
  });

  @override
  String toString() => '$title: $message (code: $code, status: $statusCode, reqId: $requestId)';
}

/// Network timeout or socket latency failure
class NetworkTimeoutException extends AppException {
  const NetworkTimeoutException({
    super.title = 'Connection Timeout',
    super.message = 'The server took too long to respond. Please check your internet connection.',
    super.statusCode,
    super.code = 'TIMEOUT',
    super.requestId,
    super.originalError,
  });
}

/// Device is offline or server host is unreachable
class OfflineException extends AppException {
  const OfflineException({
    super.title = 'No Internet Connection',
    super.message = 'You appear to be offline. Showing cached data where available.',
    super.statusCode,
    super.code = 'OFFLINE',
    super.requestId,
    super.originalError,
  });
}

/// HTTP 401: Invalid, expired, or unsynced authentication token
class UnauthorizedException extends AppException {
  const UnauthorizedException({
    super.title = 'Session Expired',
    super.message = 'Your login session has expired. Please sign in again to continue.',
    super.statusCode = 401,
    super.code = 'UNAUTHORIZED',
    super.requestId,
    super.originalError,
  });
}

/// HTTP 403: Action forbidden or quota exceeded
class ForbiddenException extends AppException {
  const ForbiddenException({
    super.title = 'Access Restricted',
    super.message = 'You do not have permission for this resource or your daily action limit was reached.',
    super.statusCode = 403,
    super.code = 'FORBIDDEN',
    super.requestId,
    super.originalError,
  });
}

/// HTTP 404: Resource or endpoint not found
class ResourceNotFoundException extends AppException {
  const ResourceNotFoundException({
    super.title = 'Resource Not Found',
    super.message = 'The requested profile, brief, or endpoint could not be found.',
    super.statusCode = 404,
    super.code = 'NOT_FOUND',
    super.requestId,
    super.originalError,
  });
}

/// HTTP 409: Identity collision or duplicate record
class ConflictException extends AppException {
  const ConflictException({
    super.title = 'Account / Record Conflict',
    super.message = 'An account or record with these details already exists.',
    super.statusCode = 409,
    super.code = 'CONFLICT',
    super.requestId,
    super.originalError,
  });
}

/// HTTP 500/502/503: Backend server errors
class ServerException extends AppException {
  const ServerException({
    super.title = 'Server Unavailable',
    super.message = 'The server encountered an unexpected error. Your data is safe; please try again shortly.',
    super.statusCode = 500,
    super.code = 'INTERNAL_ERROR',
    super.requestId,
    super.originalError,
  });
}

/// HTTP 400: Validation or payload formatting error
class ValidationException extends AppException {
  const ValidationException({
    super.title = 'Invalid Request',
    super.message = 'Please check the information entered and try again.',
    super.statusCode = 400,
    super.code = 'VALIDATION_ERROR',
    super.requestId,
    super.originalError,
  });
}

