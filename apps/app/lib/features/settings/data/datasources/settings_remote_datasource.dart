import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../../../core/config/env_config.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/settings_entities.dart';

class EscrowLiabilityConflictException extends AppException {
  final int activeAssignmentsCount;
  final int totalEscrowLocked;

  const EscrowLiabilityConflictException({
    super.title = 'Cannot Delete Account',
    super.message =
        'You have active assignments with funds locked in escrow. All assignments must be completed or closed before account termination.',
    super.statusCode = 409,
    super.code = 'ESCROW_LIABILITY_ACTIVE',
    this.activeAssignmentsCount = 1,
    this.totalEscrowLocked = 12000,
  });
}

class SettingsRemoteDataSource {
  static const Duration _timeout = Duration(seconds: 8);
  final http.Client _client;

  SettingsRemoteDataSource({http.Client? client}) : _client = client ?? http.Client();

  Uri _uri(String path, [Map<String, dynamic>? queryParams]) {
    final baseUri = EnvironmentConfig.normalizeApiUri(path);
    if (queryParams != null && queryParams.isNotEmpty) {
      return baseUri.replace(
        queryParameters: queryParams.map((k, v) => MapEntry(k, v.toString())),
      );
    }
    return baseUri;
  }

  void _handleHttpError(http.Response res, String context) {
    if (res.statusCode >= 200 && res.statusCode < 300) return;

    String title = 'Request Failed';
    String message = 'Server returned status ${res.statusCode}';
    String? code;

    try {
      final body = jsonDecode(res.body);
      if (body is Map<String, dynamic>) {
        title = body['title'] as String? ?? title;
        message = body['detail'] as String? ?? body['message'] as String? ?? message;
        code = body['code'] as String?;

        if (code == 'ESCROW_LIABILITY_ACTIVE' ||
            message.toLowerCase().contains('escrow') ||
            message.toLowerCase().contains('active assignment')) {
          throw const EscrowLiabilityConflictException();
        }
      }
    } catch (e) {
      if (e is EscrowLiabilityConflictException) rethrow;
    }

    if (res.statusCode == 401) {
      throw UnauthorizedException(
        title: 'Authentication Required',
        message: message,
      );
    }

    throw ServerException(
      title: title,
      message: message,
      statusCode: res.statusCode,
      code: code,
    );
  }

  // ---------------------------------------------------------------------------
  // Blocked Users
  // ---------------------------------------------------------------------------
  Future<List<BlockedUserModel>> getBlockedUsers() async {
    final headers = await ApiClient.buildHeaders();
    final res = await _client.get(_uri('/api/v1/blocks'), headers: headers).timeout(_timeout);
    _handleHttpError(res, 'getBlockedUsers');

    final data = jsonDecode(res.body);
    final items = (data['items'] as List<dynamic>?) ?? [];
    return items.map((e) => BlockedUserModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> unblockUser(String blockIdOrUserId) async {
    final headers = await ApiClient.buildHeaders();
    final res = await _client
        .delete(_uri('/api/v1/blocks/$blockIdOrUserId'), headers: headers)
        .timeout(_timeout);
    _handleHttpError(res, 'unblockUser');
  }

  Future<BlockedUserModel> blockUser({required String targetUserId, String? reason}) async {
    final headers = await ApiClient.buildHeaders();
    final body = jsonEncode({
      'targetUserId': targetUserId,
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
    final res = await _client
        .post(_uri('/api/v1/blocks'), headers: headers, body: body)
        .timeout(_timeout);
    _handleHttpError(res, 'blockUser');

    final data = jsonDecode(res.body);
    return BlockedUserModel.fromJson(data as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------------
  // Notification Preferences
  // ---------------------------------------------------------------------------
  Future<NotificationPreferenceSetting> getNotificationPreferences() async {
    final headers = await ApiClient.buildHeaders();
    final res = await _client
        .get(_uri('/api/v1/notification-preferences'), headers: headers)
        .timeout(_timeout);
    _handleHttpError(res, 'getNotificationPreferences');

    final data = jsonDecode(res.body);
    final items = (data['items'] as List<dynamic>?) ?? [];
    return NotificationPreferenceSetting.fromApiList(items);
  }

  Future<void> updateNotificationPreferences(NotificationPreferenceSetting preferences) async {
    final headers = await ApiClient.buildHeaders();
    final body = jsonEncode({
      'preferences': preferences.toApiUpdateItems(),
    });
    final res = await _client
        .put(_uri('/api/v1/notification-preferences'), headers: headers, body: body)
        .timeout(_timeout);
    _handleHttpError(res, 'updateNotificationPreferences');
  }

  // ---------------------------------------------------------------------------
  // Support Tickets
  // ---------------------------------------------------------------------------
  Future<SupportTicketModel> createSupportTicket({
    required SupportCategory category,
    required String subject,
    required String description,
    String? linkedAssignmentId,
    int? escrowAmount,
  }) async {
    final headers = await ApiClient.buildHeaders();
    final payload = <String, dynamic>{
      'category': category.apiValue,
      'subject': subject,
      'description': description,
      if (linkedAssignmentId != null && linkedAssignmentId.isNotEmpty)
        'linkedAssignmentId': linkedAssignmentId,
      if (escrowAmount != null && escrowAmount > 0)
        'escrowAmount': escrowAmount,
    };
    final res = await _client
        .post(_uri('/api/v1/support/tickets'), headers: headers, body: jsonEncode(payload))
        .timeout(_timeout);
    _handleHttpError(res, 'createSupportTicket');

    final data = jsonDecode(res.body);
    return SupportTicketModel.fromJson(data as Map<String, dynamic>);
  }

  Future<List<SupportTicketModel>> getMyTickets() async {
    final headers = await ApiClient.buildHeaders();
    final res = await _client
        .get(_uri('/api/v1/support/tickets'), headers: headers)
        .timeout(_timeout);
    _handleHttpError(res, 'getMyTickets');

    final data = jsonDecode(res.body);
    final items = (data['items'] as List<dynamic>?) ?? [];
    return items.map((e) => SupportTicketModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ---------------------------------------------------------------------------
  // Account Lifecycle & Erasure
  // ---------------------------------------------------------------------------
  Future<void> deactivateAccount({String? reason}) async {
    final headers = await ApiClient.buildHeaders();
    final body = jsonEncode({
      if (reason != null && reason.isNotEmpty) 'reason': reason,
      'confirmation': true,
    });
    final res = await _client
        .post(_uri('/api/v1/users/me/deactivate'), headers: headers, body: body)
        .timeout(_timeout);
    _handleHttpError(res, 'deactivateAccount');
  }

  Future<void> reactivateAccount() async {
    final headers = await ApiClient.buildHeaders();
    final body = jsonEncode({'confirmation': true});
    final res = await _client
        .post(_uri('/api/v1/users/me/reactivate'), headers: headers, body: body)
        .timeout(_timeout);
    _handleHttpError(res, 'reactivateAccount');
  }

  Future<ErasureRequestStatusModel> requestAccountErasure({String? reason}) async {
    final headers = await ApiClient.buildHeaders();
    final body = jsonEncode({
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
    final res = await _client
        .post(_uri('/api/v1/privacy/erasure-request'), headers: headers, body: body)
        .timeout(_timeout);
    _handleHttpError(res, 'requestAccountErasure');

    final data = jsonDecode(res.body);
    return ErasureRequestStatusModel.fromJson(data as Map<String, dynamic>);
  }

  Future<ErasureRequestStatusModel?> getErasureStatus() async {
    final headers = await ApiClient.buildHeaders();
    try {
      final res = await _client
          .get(_uri('/api/v1/privacy/erasure-request/status'), headers: headers)
          .timeout(_timeout);
      if (res.statusCode == 404) return null;
      _handleHttpError(res, 'getErasureStatus');

      final data = jsonDecode(res.body);
      return ErasureRequestStatusModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      debugPrint('No active erasure request found: $e');
      return null;
    }
  }

  Future<void> confirmErasure(String confirmationCode) async {
    final headers = await ApiClient.buildHeaders();
    final body = jsonEncode({'confirmationCode': confirmationCode});
    final res = await _client
        .post(_uri('/api/v1/privacy/erasure-request/confirm'), headers: headers, body: body)
        .timeout(_timeout);
    _handleHttpError(res, 'confirmErasure');
  }

  Future<void> cancelErasure(String reason) async {
    final headers = await ApiClient.buildHeaders();
    final body = jsonEncode({'reason': reason});
    final res = await _client
        .post(_uri('/api/v1/privacy/erasure-request/cancel'), headers: headers, body: body)
        .timeout(_timeout);
    _handleHttpError(res, 'cancelErasure');
  }
}
