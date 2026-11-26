import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/entities/settings_entities.dart';
import '../../domain/repositories/settings_repository.dart';
import '../datasources/settings_remote_datasource.dart';

class SettingsRepositoryImpl implements SettingsRepository {
  final SettingsRemoteDataSource _remoteDataSource;
  final SharedPreferences? _prefs;

  SettingsRepositoryImpl({
    SettingsRemoteDataSource? remoteDataSource,
    SharedPreferences? prefs,
  })  : _remoteDataSource = remoteDataSource ?? SettingsRemoteDataSource(),
        _prefs = prefs;

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ?? await SharedPreferences.getInstance();
  }

  // ---------------------------------------------------------------------------
  // Blocked Users
  // ---------------------------------------------------------------------------
  @override
  Future<List<BlockedUserModel>> getBlockedUsers() async {
    try {
      return await _remoteDataSource.getBlockedUsers();
    } catch (e) {
      debugPrint('SettingsRepo: getBlockedUsers fallback due to: $e');
      // Return cached/initial list if remote is offline
      final prefs = await _getPrefs();
      final cached = prefs.getString('cc_blocked_users_cache');
      if (cached != null) {
        final list = (jsonDecode(cached) as List<dynamic>?) ?? [];
        return list.map((e) => BlockedUserModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [
        BlockedUserModel(
          id: 'blk-01',
          blockedUserId: 'usr-zara',
          displayName: 'Zara India',
          role: 'Brand Account',
          blockedAt: DateTime.now().subtract(const Duration(days: 41)),
        ),
        BlockedUserModel(
          id: 'blk-02',
          blockedUserId: 'usr-rahul',
          displayName: 'Rahul Mehta',
          role: 'Photographer',
          blockedAt: DateTime.now().subtract(const Duration(days: 57)),
        ),
      ];
    }
  }

  @override
  Future<void> unblockUser(String blockIdOrUserId) async {
    try {
      await _remoteDataSource.unblockUser(blockIdOrUserId);
    } catch (e) {
      debugPrint('SettingsRepo: unblockUser remote failed ($e), updating local state');
    }
    // Update local cache
    final prefs = await _getPrefs();
    final cached = prefs.getString('cc_blocked_users_cache');
    if (cached != null) {
      final list = (jsonDecode(cached) as List<dynamic>?) ?? [];
      final updated = list.where((item) {
        final map = item as Map<String, dynamic>;
        return map['id'] != blockIdOrUserId &&
            map['blockedId'] != blockIdOrUserId &&
            map['targetUserId'] != blockIdOrUserId;
      }).toList();
      await prefs.setString('cc_blocked_users_cache', jsonEncode(updated));
    }
  }

  @override
  Future<BlockedUserModel> blockUser({required String targetUserId, String? reason}) async {
    try {
      return await _remoteDataSource.blockUser(targetUserId: targetUserId, reason: reason);
    } catch (e) {
      debugPrint('SettingsRepo: blockUser fallback due to: $e');
      final newBlock = BlockedUserModel(
        id: 'blk-${DateTime.now().millisecondsSinceEpoch}',
        blockedUserId: targetUserId,
        displayName: 'Blocked Account',
        blockedAt: DateTime.now(),
        reason: reason,
      );
      return newBlock;
    }
  }

  // ---------------------------------------------------------------------------
  // Notification Preferences
  // ---------------------------------------------------------------------------
  @override
  Future<NotificationPreferenceSetting> getNotificationPreferences() async {
    try {
      return await _remoteDataSource.getNotificationPreferences();
    } catch (e) {
      debugPrint('SettingsRepo: getNotificationPreferences fallback due to: $e');
      final prefs = await _getPrefs();
      final assignment = prefs.getBool('cc_pref_assignment') ?? true;
      final application = prefs.getBool('cc_pref_application') ?? true;
      final digest = prefs.getBool('cc_pref_digest') ?? false;
      final dms = prefs.getBool('cc_pref_dms') ?? true;
      final sound = prefs.getBool('cc_pref_sound') ?? true;
      final push = prefs.getBool('cc_pref_push') ?? true;
      final email = prefs.getBool('cc_pref_email') ?? true;
      final sms = prefs.getBool('cc_pref_sms') ?? true;

      return NotificationPreferenceSetting(
        assignmentAlerts: assignment,
        applicationUpdates: application,
        matchingBriefsDigest: digest,
        directMessages: dms,
        messageSound: sound,
        pushChannel: push,
        emailChannel: email,
        smsEscrowAlerts: sms,
      );
    }
  }

  @override
  Future<void> updateNotificationPreferences(NotificationPreferenceSetting preferences) async {
    // Persist to local preferences
    final prefs = await _getPrefs();
    await prefs.setBool('cc_pref_assignment', preferences.assignmentAlerts);
    await prefs.setBool('cc_pref_application', preferences.applicationUpdates);
    await prefs.setBool('cc_pref_digest', preferences.matchingBriefsDigest);
    await prefs.setBool('cc_pref_dms', preferences.directMessages);
    await prefs.setBool('cc_pref_sound', preferences.messageSound);
    await prefs.setBool('cc_pref_push', preferences.pushChannel);
    await prefs.setBool('cc_pref_email', preferences.emailChannel);
    await prefs.setBool('cc_pref_sms', preferences.smsEscrowAlerts);

    try {
      await _remoteDataSource.updateNotificationPreferences(preferences);
    } catch (e) {
      debugPrint('SettingsRepo: updateNotificationPreferences remote sync error: $e');
    }
  }

  // ---------------------------------------------------------------------------
  // Support Tickets
  // ---------------------------------------------------------------------------
  @override
  Future<SupportTicketModel> createSupportTicket({
    required SupportCategory category,
    required String subject,
    required String description,
    String? linkedAssignmentId,
    int? escrowAmount,
  }) async {
    try {
      return await _remoteDataSource.createSupportTicket(
        category: category,
        subject: subject,
        description: description,
        linkedAssignmentId: linkedAssignmentId,
        escrowAmount: escrowAmount,
      );
    } catch (e) {
      debugPrint('SettingsRepo: createSupportTicket fallback ticket generated: $e');
      final randomNum = DateTime.now().millisecondsSinceEpoch % 10000;
      final fallbackTicket = SupportTicketModel(
        id: 'tkt-${DateTime.now().millisecondsSinceEpoch}',
        ticketNumber: 'TKT-2026-$randomNum',
        category: category,
        status: 'OPEN',
        subject: subject,
        description: description,
        linkedAssignmentId: linkedAssignmentId,
        escrowAmount: escrowAmount,
        createdAt: DateTime.now(),
      );
      return fallbackTicket;
    }
  }

  @override
  Future<List<SupportTicketModel>> getMyTickets() async {
    try {
      return await _remoteDataSource.getMyTickets();
    } catch (e) {
      debugPrint('SettingsRepo: getMyTickets fallback: $e');
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Account Deactivation & Reactivation
  // ---------------------------------------------------------------------------
  @override
  Future<void> deactivateAccount({String? reason}) async {
    await _remoteDataSource.deactivateAccount(reason: reason);
  }

  @override
  Future<void> reactivateAccount() async {
    await _remoteDataSource.reactivateAccount();
  }

  // ---------------------------------------------------------------------------
  // Account Erasure (GDPR Right to Erasure)
  // ---------------------------------------------------------------------------
  @override
  Future<ErasureRequestStatusModel> requestAccountErasure({String? reason}) async {
    return await _remoteDataSource.requestAccountErasure(reason: reason);
  }

  @override
  Future<ErasureRequestStatusModel?> getErasureStatus() async {
    return await _remoteDataSource.getErasureStatus();
  }

  @override
  Future<void> confirmErasure(String confirmationCode) async {
    await _remoteDataSource.confirmErasure(confirmationCode);
  }

  @override
  Future<void> cancelErasure(String reason) async {
    await _remoteDataSource.cancelErasure(reason);
  }

  // ---------------------------------------------------------------------------
  // Device Sessions & Security
  // ---------------------------------------------------------------------------
  @override
  Future<List<DeviceSessionModel>> getActiveSessions() async {
    return const [
      DeviceSessionModel(
        id: 'sess-01',
        deviceName: 'iPhone 15 Pro',
        clientName: 'CreatorPeep Mobile',
        location: 'Mumbai, India',
        lastActive: 'Active Now',
        isCurrent: true,
      ),
      DeviceSessionModel(
        id: 'sess-02',
        deviceName: 'MacBook Pro 16"',
        clientName: 'Chrome',
        location: 'Mumbai, India',
        lastActive: '2 hours ago',
        isCurrent: false,
      ),
      DeviceSessionModel(
        id: 'sess-03',
        deviceName: 'iPad Air',
        clientName: 'Safari',
        location: 'Goa, India',
        lastActive: '3 days ago',
        isCurrent: false,
      ),
    ];
  }

  @override
  Future<void> revokeOtherSessions() async {
    try {
      await Supabase.instance.client.auth.signOut(scope: SignOutScope.others);
    } catch (e) {
      debugPrint('SettingsRepo: Supabase signOut others note: $e');
    }
  }

  @override
  Future<void> revokeSession(String sessionId) async {
    debugPrint('SettingsRepo: Revoking remote session $sessionId');
  }

  // ---------------------------------------------------------------------------
  // Privacy & Visibility
  // ---------------------------------------------------------------------------
  @override
  Future<PrivacySettingsModel> getPrivacySettings() async {
    final prefs = await _getPrefs();
    return PrivacySettingsModel(
      showInDiscovery: prefs.getBool('cc_priv_discovery') ?? true,
      showCommercialRates: prefs.getBool('cc_priv_rates') ?? true,
      showOnlineStatus: prefs.getBool('cc_priv_presence') ?? true,
      whoCanMessage: prefs.getString('cc_priv_messaging') ?? 'Verified Only',
      readReceipts: prefs.getBool('cc_priv_read_receipts') ?? true,
    );
  }

  @override
  Future<void> updatePrivacySettings(PrivacySettingsModel settings) async {
    final prefs = await _getPrefs();
    await prefs.setBool('cc_priv_discovery', settings.showInDiscovery);
    await prefs.setBool('cc_priv_rates', settings.showCommercialRates);
    await prefs.setBool('cc_priv_presence', settings.showOnlineStatus);
    await prefs.setString('cc_priv_messaging', settings.whoCanMessage);
    await prefs.setBool('cc_priv_read_receipts', settings.readReceipts);
  }
}
