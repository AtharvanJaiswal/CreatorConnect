import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:creatorconnect/features/settings/domain/entities/settings_entities.dart';
import 'package:creatorconnect/features/settings/domain/repositories/settings_repository.dart';
import 'package:creatorconnect/features/settings/presentation/controllers/settings_controllers.dart';
import 'package:creatorconnect/features/settings/presentation/dialogs/logout_confirmation_dialog.dart';
import 'package:creatorconnect/features/settings/presentation/dialogs/remove_role_dialog.dart';
import 'package:creatorconnect/features/settings/presentation/dialogs/unblock_user_dialog.dart';
import 'package:creatorconnect/features/settings/presentation/dialogs/active_escrow_conflict_dialog.dart';
import 'package:creatorconnect/features/settings/presentation/dialogs/security_reauth_dialog.dart';
import 'package:creatorconnect/features/settings/presentation/dialogs/revoke_other_sessions_dialog.dart';
import 'package:creatorconnect/features/settings/presentation/screens/settings_home_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/account_details_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/notification_preferences_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/privacy_visibility_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/blocked_users_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/manage_roles_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/security_devices_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/help_center_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/contact_support_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/legal_policies_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/about_creatorconnect_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/deactivate_account_screen.dart';
import 'package:creatorconnect/features/settings/presentation/screens/delete_account_screen.dart';

class MockSettingsRepository implements SettingsRepository {
  List<BlockedUserModel> blockedList = [
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

  NotificationPreferenceSetting preferences = const NotificationPreferenceSetting();
  PrivacySettingsModel privacySettings = const PrivacySettingsModel();

  @override
  Future<List<BlockedUserModel>> getBlockedUsers() async => blockedList;

  @override
  Future<void> unblockUser(String blockIdOrUserId) async {
    blockedList.removeWhere((u) => u.id == blockIdOrUserId || u.blockedUserId == blockIdOrUserId);
  }

  @override
  Future<BlockedUserModel> blockUser({required String targetUserId, String? reason}) async {
    final b = BlockedUserModel(
      id: 'blk-new',
      blockedUserId: targetUserId,
      displayName: 'Blocked Account',
      blockedAt: DateTime.now(),
      reason: reason,
    );
    blockedList.add(b);
    return b;
  }

  @override
  Future<NotificationPreferenceSetting> getNotificationPreferences() async => preferences;

  @override
  Future<void> updateNotificationPreferences(NotificationPreferenceSetting prefs) async {
    preferences = prefs;
  }

  @override
  Future<SupportTicketModel> createSupportTicket({
    required SupportCategory category,
    required String subject,
    required String description,
    String? linkedAssignmentId,
    int? escrowAmount,
  }) async {
    return SupportTicketModel(
      id: 'tkt-test-1',
      ticketNumber: 'TKT-2026-00412',
      category: category,
      status: 'OPEN',
      subject: subject,
      description: description,
      linkedAssignmentId: linkedAssignmentId,
      escrowAmount: escrowAmount,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<List<SupportTicketModel>> getMyTickets() async => [];

  @override
  Future<void> deactivateAccount({String? reason}) async {}

  @override
  Future<void> reactivateAccount() async {}

  @override
  Future<ErasureRequestStatusModel> requestAccountErasure({String? reason}) async {
    return ErasureRequestStatusModel(
      id: 'ers-test-1',
      status: 'PENDING',
      currentStage: 'COOLING_OFF_PERIOD',
      coolingOffEndsAt: DateTime.now().add(const Duration(days: 7)),
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<ErasureRequestStatusModel?> getErasureStatus() async => null;

  @override
  Future<void> confirmErasure(String confirmationCode) async {}

  @override
  Future<void> cancelErasure(String reason) async {}

  @override
  Future<List<DeviceSessionModel>> getActiveSessions() async => const [
        DeviceSessionModel(
          id: 'sess-1',
          deviceName: 'iPhone 15 Pro',
          clientName: 'CreatorPeep Mobile',
          location: 'Mumbai, India',
          lastActive: 'Active Now',
          isCurrent: true,
        ),
        DeviceSessionModel(
          id: 'sess-2',
          deviceName: 'MacBook Pro 16"',
          clientName: 'Chrome',
          location: 'Mumbai, India',
          lastActive: '2 hours ago',
          isCurrent: false,
        ),
      ];

  @override
  Future<void> revokeOtherSessions() async {}

  @override
  Future<void> revokeSession(String sessionId) async {}

  @override
  Future<PrivacySettingsModel> getPrivacySettings() async => privacySettings;

  @override
  Future<void> updatePrivacySettings(PrivacySettingsModel settings) async {
    privacySettings = settings;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockSettingsRepository mockRepo;

  setUp(() {
    mockRepo = MockSettingsRepository();
  });

  Widget buildTestApp(Widget child) {
    return ProviderScope(
      overrides: [
        settingsRepositoryProvider.overrideWithValue(mockRepo),
      ],
      child: MaterialApp(
        home: child,
      ),
    );
  }

  group('Module N: Domain Entities & Mapping', () {
    test('BlockedUserModel fromJson deserializes properly', () {
      final json = {
        'id': 'blk-1',
        'blockedId': 'usr-2',
        'displayName': 'Test User',
        'role': 'Brand Account',
        'createdAt': '2026-10-14T10:00:00.000Z',
      };
      final model = BlockedUserModel.fromJson(json);
      expect(model.id, 'blk-1');
      expect(model.blockedUserId, 'usr-2');
      expect(model.displayName, 'Test User');
      expect(model.role, 'Brand Account');
    });

    test('NotificationPreferenceSetting mapping and roundtrip', () {
      final apiList = [
        {'type': 'ASSIGNMENT_OFFER', 'channel': 'PUSH', 'enabled': true},
        {'type': 'APPLICATION_ACCEPTED', 'channel': 'PUSH', 'enabled': true},
        {'type': 'PROJECT_CREATED', 'channel': 'EMAIL', 'enabled': false},
        {'type': 'MESSAGE_RECEIVED', 'channel': 'PUSH', 'enabled': true},
      ];
      final prefs = NotificationPreferenceSetting.fromApiList(apiList);
      expect(prefs.assignmentAlerts, isTrue);
      expect(prefs.matchingBriefsDigest, isFalse);

      final updateList = prefs.toApiUpdateItems();
      expect(updateList.length, 4);
      expect(updateList.any((e) => e['type'] == 'ASSIGNMENT_OFFER'), isTrue);
    });

    test('SupportTicketModel and ErasureRequestStatusModel serialization', () {
      final tktJson = {
        'id': 'tkt-123',
        'ticketNumber': 'TKT-2026-00412',
        'category': 'ESCROW_RECONCILIATION',
        'status': 'OPEN',
        'subject': 'Milestone issue',
        'description': 'Payment delayed',
      };
      final ticket = SupportTicketModel.fromJson(tktJson);
      expect(ticket.ticketNumber, 'TKT-2026-00412');
      expect(ticket.category, SupportCategory.escrowReconciliation);

      final erasureJson = {
        'id': 'ers-1',
        'status': 'PENDING',
        'currentStage': 'COOLING_OFF_PERIOD',
        'createdAt': '2026-11-20T12:00:00.000Z',
      };
      final erasure = ErasureRequestStatusModel.fromJson(erasureJson);
      expect(erasure.currentStage, 'COOLING_OFF_PERIOD');
    });
  });

  group('Module N: Dialogs Verification', () {
    testWidgets('DLG-06 LogoutConfirmationDialog renders and dismisses', (tester) async {
      await tester.pumpWidget(buildTestApp(const LogoutConfirmationDialog()));
      await tester.pumpAndSettle();

      expect(find.text('Log Out of CreatorConnect?'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Log Out'), findsOneWidget);

      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
    });

    testWidgets('DLG-19 RemoveRoleDialog renders correctly', (tester) async {
      await tester.pumpWidget(buildTestApp(const RemoveRoleDialog(roleTitle: 'Production Professional')));
      await tester.pumpAndSettle();

      expect(find.text('Remove Production Professional Role?'), findsOneWidget);
      expect(find.text('Keep Role'), findsOneWidget);
      expect(find.text('Remove'), findsOneWidget);
    });

    testWidgets('DLG-30 UnblockUserDialog renders correctly', (tester) async {
      await tester.pumpWidget(buildTestApp(const UnblockUserDialog(userName: 'Zara India')));
      await tester.pumpAndSettle();

      expect(find.text('Unblock Zara India?'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Unblock'), findsOneWidget);
    });

    testWidgets('DLG-91 ActiveEscrowConflictDialog renders liability block', (tester) async {
      await tester.pumpWidget(buildTestApp(const ActiveEscrowConflictDialog()));
      await tester.pumpAndSettle();

      expect(find.text('Cannot Delete Account'), findsOneWidget);
      expect(find.text('View Active Briefs →'), findsOneWidget);
    });

    testWidgets('DLG-92 SecurityReauthDialog renders password input', (tester) async {
      await tester.pumpWidget(buildTestApp(const SecurityReauthDialog()));
      await tester.pumpAndSettle();

      expect(find.text('Security Verification'), findsOneWidget);
      expect(find.text('Verify & Continue →'), findsOneWidget);
    });

    testWidgets('DLG-93 RevokeOtherSessionsDialog renders warning', (tester) async {
      await tester.pumpWidget(buildTestApp(const RevokeOtherSessionsDialog(count: 2)));
      await tester.pumpAndSettle();

      expect(find.text('Revoke All Other Sessions?'), findsOneWidget);
      expect(find.text('Revoke All'), findsOneWidget);
    });
  });

  group('Module N: Screens Rendering & Interactions', () {
    testWidgets('N01 SettingsHomeScreen renders groups and items', (tester) async {
      await tester.pumpWidget(buildTestApp(const SettingsHomeScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('ACCOUNT & IDENTITY'), findsOneWidget);
      expect(find.text('PREFERENCES'), findsOneWidget);
      expect(find.text('SUPPORT & LEGAL'), findsOneWidget);
      expect(find.text('Log Out of CreatorConnect'), findsOneWidget);
    });

    testWidgets('N02 AccountDetailsScreen renders form fields', (tester) async {
      await tester.pumpWidget(buildTestApp(const AccountDetailsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Account Details'), findsOneWidget);
      expect(find.text('Full Legal Name'), findsOneWidget);
      expect(find.text('Email Address'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });

    testWidgets('N03 NotificationPreferencesScreen renders switches and saves', (tester) async {
      await tester.pumpWidget(buildTestApp(const NotificationPreferencesScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Brief Selection / Hire'), findsOneWidget);
      expect(find.text('Save Preferences'), findsOneWidget);

      await tester.ensureVisible(find.text('Save Preferences'));
      await tester.tap(find.text('Save Preferences'));
      await tester.pumpAndSettle();
      expect(find.text('Notification preferences saved successfully'), findsOneWidget);
    });

    testWidgets('N04 PrivacyVisibilityScreen renders privacy controls', (tester) async {
      await tester.pumpWidget(buildTestApp(const PrivacyVisibilityScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Privacy & Visibility'), findsOneWidget);
      expect(find.text('Show Profile in Discovery'), findsOneWidget);
      expect(find.text('Display Verified Commercial Rates'), findsOneWidget);
      expect(find.text('Escrow Protection Rule'), findsOneWidget);
    });

    testWidgets('N05 BlockedUsersScreen displays list and allows unblocking', (tester) async {
      await tester.pumpWidget(buildTestApp(const BlockedUsersScreen()));
      await tester.pumpAndSettle();

      expect(find.textContaining('Blocked Accounts'), findsOneWidget);
      expect(find.text('Zara India'), findsOneWidget);
      expect(find.text('Rahul Mehta'), findsOneWidget);
    });

    testWidgets('N06 ManageRolesScreen displays primary and secondary roles', (tester) async {
      await tester.pumpWidget(buildTestApp(const ManageRolesScreen()));
      await tester.pumpAndSettle();

      expect(find.text('My Roles (SOW §2)'), findsOneWidget);
      expect(find.text('Content Creator'), findsOneWidget);
      expect(find.text('Primary Role Active'), findsOneWidget);
      expect(find.text('Production Professional'), findsOneWidget);
      expect(find.text('Podcaster Profile'), findsOneWidget);
    });

    testWidgets('N07 SecurityDevicesScreen displays sessions', (tester) async {
      await tester.pumpWidget(buildTestApp(const SecurityDevicesScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Security & Devices'), findsOneWidget);
      expect(find.text('Two-Factor Authentication (2FA)'), findsOneWidget);
      expect(find.text('Sign Out from All Other Devices'), findsOneWidget);
    });

    testWidgets('N08 HelpCenterScreen search and FAQs', (tester) async {
      await tester.pumpWidget(buildTestApp(const HelpCenterScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Help Centre'), findsOneWidget);
      expect(find.text('Payments & Escrow'), findsOneWidget);
      expect(find.text('Briefs & Pitches'), findsOneWidget);
      expect(find.text('How does milestone escrow release work?'), findsOneWidget);
    });

    testWidgets('N09 ContactSupportScreen validates inputs and submits', (tester) async {
      await tester.pumpWidget(buildTestApp(const ContactSupportScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Contact Support'), findsOneWidget);
      expect(find.text('Select Issue Category *'), findsOneWidget);
      expect(find.text('Submit Ticket (#TKT-NEW) →'), findsOneWidget);
    });

    testWidgets('N10 LegalPoliciesScreen renders documents list', (tester) async {
      await tester.pumpWidget(buildTestApp(const LegalPoliciesScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Legal & Policies'), findsOneWidget);
      expect(find.text('Terms of Service'), findsOneWidget);
      expect(find.text('Privacy Policy (GDPR / DPDP)'), findsOneWidget);
      expect(find.text('Escrow & Payment Agreement'), findsOneWidget);
    });

    testWidgets('N11 DeactivateAccountScreen renders reasons and actions', (tester) async {
      await tester.pumpWidget(buildTestApp(const DeactivateAccountScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Deactivate Account'), findsOneWidget);
      expect(find.text('Taking a creative break?'), findsOneWidget);
      expect(find.text('Deactivate Profile'), findsOneWidget);
      expect(find.text('Keep Profile Active'), findsOneWidget);
    });

    testWidgets('N12 DeleteAccountScreen enforces DELETE text and checks escrow', (tester) async {
      await tester.pumpWidget(buildTestApp(const DeleteAccountScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Delete Account'), findsOneWidget);
      expect(find.text('Permanent & Irreversible Action'), findsOneWidget);
      expect(find.text('Permanently Delete Account'), findsOneWidget);
    });

    testWidgets('N13 AboutCreatorConnectScreen renders version and credits', (tester) async {
      await tester.pumpWidget(buildTestApp(const AboutCreatorConnectScreen()));
      await tester.pumpAndSettle();

      expect(find.text('About'), findsOneWidget);
      expect(find.text('CreatorPeep'), findsOneWidget);
      expect(find.text('Version 2.4.1 (Build 824)'), findsOneWidget);
      expect(find.text("What's New in v2.4.1"), findsOneWidget);
    });
  });
}
