import '../entities/settings_entities.dart';

abstract class SettingsRepository {
  /// Fetches the list of blocked users and brands.
  Future<List<BlockedUserModel>> getBlockedUsers();

  /// Unblocks a user by their block ID or target user ID.
  Future<void> unblockUser(String blockIdOrUserId);

  /// Blocks a user by their target user ID.
  Future<BlockedUserModel> blockUser({required String targetUserId, String? reason});

  /// Retrieves user notification preferences.
  Future<NotificationPreferenceSetting> getNotificationPreferences();

  /// Updates user notification preferences.
  Future<void> updateNotificationPreferences(NotificationPreferenceSetting preferences);

  /// Submits a support ticket to `/api/v1/support/tickets`.
  Future<SupportTicketModel> createSupportTicket({
    required SupportCategory category,
    required String subject,
    required String description,
    String? linkedAssignmentId,
    int? escrowAmount,
  });

  /// Lists customer support tickets.
  Future<List<SupportTicketModel>> getMyTickets();

  /// Deactivates user account temporarily.
  Future<void> deactivateAccount({String? reason});

  /// Reactivates user account.
  Future<void> reactivateAccount();

  /// Initiates GDPR erasure request. Throws if active escrow exists.
  Future<ErasureRequestStatusModel> requestAccountErasure({String? reason});

  /// Retrieves current status of an erasure request.
  Future<ErasureRequestStatusModel?> getErasureStatus();

  /// Confirms staged erasure request with confirmation code.
  Future<void> confirmErasure(String confirmationCode);

  /// Cancels an erasure request during cooling-off window.
  Future<void> cancelErasure(String reason);

  /// Retrieves device sessions (real auth session + known client devices).
  Future<List<DeviceSessionModel>> getActiveSessions();

  /// Revokes remote sessions (signs out other devices).
  Future<void> revokeOtherSessions();

  /// Revokes a single remote session.
  Future<void> revokeSession(String sessionId);

  /// Retrieves current privacy and visibility settings.
  Future<PrivacySettingsModel> getPrivacySettings();

  /// Updates privacy and visibility settings.
  Future<void> updatePrivacySettings(PrivacySettingsModel settings);
}
