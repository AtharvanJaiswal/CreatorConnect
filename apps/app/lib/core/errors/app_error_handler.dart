import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_exception.dart';
import '../widgets/dialogs/app_error_dialog.dart';

class AppErrorHandler {
  AppErrorHandler._();

  /// Converts any dynamic exception (DioException, HttpException, SocketException, AuthException)
  /// into a strongly-typed, human-understandable [AppException] adhering to RFC 7807 Problem Details.
  static AppException parse(dynamic error, [StackTrace? stackTrace]) {
    if (error is AppException) return error;

    if (error is DioException) {
      final res = error.response;
      final status = res?.statusCode;
      final data = res?.data;

      String? rfcTitle;
      String? rfcDetail;
      String? rfcCode;
      String? rfcReqId;

      if (data is Map) {
        rfcTitle = data['title'] as String?;
        rfcDetail = data['detail'] as String? ?? data['message'] as String? ?? data['error'] as String?;
        rfcCode = data['code'] as String?;
        rfcReqId = data['requestId'] as String?;
      }

      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return NetworkTimeoutException(
            message: rfcDetail ?? 'Server took too long to respond. Please check your connection.',
            statusCode: status,
            requestId: rfcReqId,
            originalError: error,
          );

        case DioExceptionType.connectionError:
          return OfflineException(
            message: 'Unable to reach the CreatorConnect server. Please verify your internet connection.',
            originalError: error,
          );

        case DioExceptionType.badResponse:
          if (status == 401) {
            return UnauthorizedException(
              title: rfcTitle ?? 'Session Expired',
              message: rfcDetail ?? 'Your session has expired. Please sign in again.',
              code: rfcCode ?? 'AUTH_TOKEN_EXPIRED',
              requestId: rfcReqId,
              originalError: error,
            );
          }
          if (status == 403) {
            return ForbiddenException(
              title: rfcTitle ?? 'Access Restricted',
              message: rfcDetail ?? 'You do not have permission or your daily action limit was reached.',
              code: rfcCode ?? 'FORBIDDEN',
              requestId: rfcReqId,
              originalError: error,
            );
          }
          if (status == 404) {
            return ResourceNotFoundException(
              title: rfcTitle ?? 'Not Found',
              message: rfcDetail ?? 'The requested resource could not be found.',
              code: rfcCode ?? 'NOT_FOUND',
              requestId: rfcReqId,
              originalError: error,
            );
          }
          if (status == 409) {
            return ConflictException(
              title: rfcTitle ?? 'Account Conflict',
              message: rfcDetail ?? 'An account with this email already exists under another login method.',
              code: rfcCode ?? 'CONFLICT',
              requestId: rfcReqId,
              originalError: error,
            );
          }
          if (status != null && status >= 500) {
            return ServerException(
              title: rfcTitle ?? 'Server Unavailable',
              message: rfcDetail ?? 'The server encountered an error. Please try again shortly.',
              statusCode: status,
              code: rfcCode ?? 'INTERNAL_SERVER_ERROR',
              requestId: rfcReqId,
              originalError: error,
            );
          }
          return ValidationException(
            title: rfcTitle ?? 'Invalid Request',
            message: rfcDetail ?? 'Please verify your information and try again.',
            statusCode: status,
            code: rfcCode ?? 'VALIDATION_ERROR',
            requestId: rfcReqId,
            originalError: error,
          );

        case DioExceptionType.cancel:
          return const ValidationException(
            title: 'Request Cancelled',
            message: 'The operation was cancelled.',
            code: 'CANCELLED',
          );

        default:
          return ServerException(
            message: rfcDetail ?? error.message ?? 'An unexpected network error occurred.',
            statusCode: status,
            originalError: error,
          );
      }
    }

    if (error is SocketException) {
      return OfflineException(
        message: 'No active internet connection. Please verify your network.',
        originalError: error,
      );
    }

    if (error is HttpException) {
      return ServerException(
        message: error.message,
        originalError: error,
      );
    }

    if (error is AuthException) {
      return UnauthorizedException(
        message: error.message,
        code: error.statusCode,
        originalError: error,
      );
    }

    return ServerException(
      title: 'Unexpected Error',
      message: error.toString(),
      originalError: error,
    );
  }

  /// Displays the standardized [AppErrorDialog] modal with RFC 7807 details and 1-tap Retry.
  static Future<void> showErrorDialog(
    BuildContext context,
    dynamic error, {
    VoidCallback? onRetry,
    VoidCallback? onDismiss,
  }) async {
    final appEx = parse(error);
    await AppErrorDialog.show(
      context,
      exception: appEx,
      onRetry: onRetry,
      onDismiss: onDismiss,
    );
  }
}

