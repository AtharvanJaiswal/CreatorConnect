import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:creatorconnect/features/applications_invites/domain/entities/application_entities.dart';
import 'package:creatorconnect/features/applications_invites/domain/entities/invitation_entities.dart';
import 'package:creatorconnect/features/applications_invites/data/repositories/applications_invites_repository.dart';
import 'package:creatorconnect/features/applications_invites/presentation/screens/h01_apply_assignment_screen.dart';
import 'package:creatorconnect/features/applications_invites/presentation/screens/h02_my_applications_screen.dart';
import 'package:creatorconnect/features/applications_invites/presentation/screens/h03_application_detail_screen.dart';
import 'package:creatorconnect/features/applications_invites/presentation/screens/h04_send_invite_screen.dart';
import 'package:creatorconnect/features/applications_invites/presentation/screens/h05_invites_inbox_screen.dart';
import 'package:creatorconnect/features/applications_invites/presentation/screens/h06_invite_detail_screen.dart';
import 'package:creatorconnect/features/applications_invites/presentation/screens/h07_sent_invites_screen.dart';
import 'package:creatorconnect/features/applications_invites/presentation/bottom_sheets/dlg_48_application_sent_sheet.dart';
import 'package:creatorconnect/features/applications_invites/presentation/bottom_sheets/dlg_49_quota_reached_sheet.dart';
import 'package:creatorconnect/features/applications_invites/presentation/dialogs/dlg_50_withdraw_application_dialog.dart';
import 'package:creatorconnect/features/applications_invites/presentation/dialogs/dlg_51_already_applied_dialog.dart';
import 'package:creatorconnect/features/applications_invites/presentation/bottom_sheets/dlg_52_invite_sent_sheet.dart';
import 'package:creatorconnect/features/applications_invites/presentation/dialogs/dlg_53_accept_invite_dialog.dart';
import 'package:creatorconnect/features/applications_invites/presentation/bottom_sheets/dlg_54_decline_invite_sheet.dart';
import 'package:creatorconnect/features/applications_invites/presentation/dialogs/dlg_55_cancel_invite_dialog.dart';

void main() {
  group('Module H: Domain Entity & State Machine Tests', () {
    test('ApplicationStatus enum parsing and state transitions', () {
      expect(ApplicationStatus.fromString('SUBMITTED'), ApplicationStatus.submitted);
      expect(ApplicationStatus.fromString('under_review'), ApplicationStatus.underReview);
      expect(ApplicationStatus.fromString('SHORTLISTED'), ApplicationStatus.shortlisted);
      expect(ApplicationStatus.fromString('ACCEPTED'), ApplicationStatus.accepted);
      expect(ApplicationStatus.fromString('rejected'), ApplicationStatus.rejected);
      expect(ApplicationStatus.fromString('WITHDRAWN'), ApplicationStatus.withdrawn);
      expect(ApplicationStatus.fromString(null), ApplicationStatus.submitted);
    });

    test('ApplicationModel state inspection helpers', () {
      final appActive = ApplicationModel(
        id: 'test-1',
        assignmentId: 'asg-1',
        assignmentTitle: 'Test Brief',
        brandName: 'Brand A',
        location: 'Mumbai',
        assignmentBudget: 10000,
        applicantId: 'usr-1',
        coverLetter: 'A valid proposal pitch here.',
        proposedRate: 9000,
        status: ApplicationStatus.submitted,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(appActive.isActive, isTrue);
      expect(appActive.isShortlisted, isFalse);
      expect(appActive.isAccepted, isFalse);
      expect(appActive.isClosed, isFalse);

      final appShortlisted = appActive.copyWith(status: ApplicationStatus.shortlisted);
      expect(appShortlisted.isShortlisted, isTrue);
      expect(appShortlisted.isActive, isFalse);

      final appClosed = appActive.copyWith(status: ApplicationStatus.withdrawn);
      expect(appClosed.isClosed, isTrue);
    });

    test('MonthlyQuotaInfo calculation and exhaustion', () {
      final availableQuota = MonthlyQuotaInfo(
        remaining: 3,
        total: 5,
        resetDate: DateTime.now().add(const Duration(days: 10)),
        isPro: false,
      );
      expect(availableQuota.isExhausted, isFalse);

      final exhaustedFree = MonthlyQuotaInfo(
        remaining: 0,
        total: 5,
        resetDate: DateTime.now().add(const Duration(days: 5)),
        isPro: false,
      );
      expect(exhaustedFree.isExhausted, isTrue);

      final proUser = MonthlyQuotaInfo(
        remaining: 0,
        total: 0,
        resetDate: DateTime.now(),
        isPro: true,
      );
      expect(proUser.isExhausted, isFalse);
    });

    test('InvitationStatus and 7-Day Auto-Expiry Countdown logic', () {
      expect(InvitationStatus.fromString('PENDING'), InvitationStatus.pending);
      expect(InvitationStatus.fromString('ACCEPTED'), InvitationStatus.accepted);
      expect(InvitationStatus.fromString('DECLINED'), InvitationStatus.declined);
      expect(InvitationStatus.fromString('WITHDRAWN'), InvitationStatus.withdrawn);
      expect(InvitationStatus.fromString('EXPIRED'), InvitationStatus.expired);

      final inv = InvitationModel(
        id: 'inv-test-1',
        projectId: 'p-1',
        projectTitle: 'Collab Campaign',
        senderId: 's-1',
        senderName: 'Nike India',
        senderRole: 'Brand Partner',
        recipientId: 'r-1',
        recipientName: 'Priya Patel',
        recipientRole: 'Creator',
        inviteType: InviteType.paidHire,
        message: 'Looking forward to working together!',
        budgetOffered: 35000,
        status: InvitationStatus.pending,
        expiresAt: DateTime.now().add(const Duration(days: 4, hours: 2)),
        createdAt: DateTime.now(),
      );

      expect(inv.isPending, isTrue);
      expect(inv.isExpired, isFalse);
      expect(inv.daysRemaining, 4);

      final expiredInv = inv.copyWith(status: InvitationStatus.expired);
      expect(expiredInv.isExpired, isTrue);
    });
  });

  group('Module H: Repository Operations Tests', () {
    late MockApplicationsInvitesRepository repo;

    setUp(() {
      repo = MockApplicationsInvitesRepository();
    });

    test('Submit application decrements quota and inserts proposal', () async {
      final quotaBefore = await repo.getMonthlyQuota();
      expect(quotaBefore.remaining, 4);

      final newApp = await repo.submitApplication(
        assignmentId: 'asg-test-99',
        assignmentTitle: 'Festive Video Production',
        brandName: 'Puma India',
        location: 'Delhi',
        assignmentBudget: 20000,
        coverLetter: 'Experienced cinematic video editor with fast 48h turnaround.',
        proposedRate: 18000,
        estimatedDays: 3,
      );

      expect(newApp.status, ApplicationStatus.submitted);
      expect(newApp.proposedRate, 18000);

      final quotaAfter = await repo.getMonthlyQuota();
      expect(quotaAfter.remaining, 3);

      final isApplied = await repo.checkAlreadyApplied('asg-test-99');
      expect(isApplied, isTrue);
    });

    test('Withdraw application updates status to WITHDRAWN and records event', () async {
      final ok = await repo.withdrawApplication('app-002');
      expect(ok, isTrue);

      final detail = await repo.getApplicationDetail('app-002');
      expect(detail?.status, ApplicationStatus.withdrawn);
      expect(detail?.timeline.last.title, 'Application Withdrawn');
    });

    test('Send, Accept, Decline and Cancel direct invitations', () async {
      // 1. Send Invite
      final invite = await repo.sendDirectInvite(
        recipientId: 'usr-karan',
        recipientName: 'Karan Mehra',
        recipientRole: 'Photographer',
        projectTitle: 'Lookbook Shoot',
        inviteType: InviteType.paidHire,
        budgetOffered: 15000,
        message: 'Studio shoot next Wednesday.',
        deliverables: ['30 Edited High-Res Photos'],
        expiresInDays: 7,
      );
      expect(invite.status, InvitationStatus.pending);
      expect(invite.budgetOffered, 15000);

      // 2. Accept received invite
      final acceptOk = await repo.acceptInvite('inv-001');
      expect(acceptOk, isTrue);
      final acceptedDetail = await repo.getInviteDetail('inv-001');
      expect(acceptedDetail?.status, InvitationStatus.accepted);

      // 3. Decline received invite with reason
      final declineOk = await repo.declineInvite('inv-002', 'Fully booked');
      expect(declineOk, isTrue);
      final declinedDetail = await repo.getInviteDetail('inv-002');
      expect(declinedDetail?.status, InvitationStatus.declined);
      expect(declinedDetail?.declineReason, 'Fully booked');

      // 4. Cancel sent invite
      final cancelOk = await repo.cancelInvite('inv-sent-001');
      expect(cancelOk, isTrue);
      final cancelledDetail = await repo.getInviteDetail('inv-sent-001');
      expect(cancelledDetail?.status, InvitationStatus.withdrawn);
    });
  });

  group('Module H: Widget & Screen Presentation Tests', () {
    testWidgets('H01ApplyAssignmentScreen renders brief info and proposal fields', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: H01ApplyAssignmentScreen(
              assignmentId: 'asg-demo-1',
              assignmentTitle: 'Summer Reels Campaign',
              brandName: 'Zara India',
              assignmentBudget: 15000,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Submit Proposal'), findsOneWidget);
      expect(find.text('Summer Reels Campaign'), findsOneWidget);
      expect(find.text('Zara India · Mumbai'), findsOneWidget);
      expect(find.text('Within Budget'), findsOneWidget);
      expect(find.textContaining('Proposals remaining this month:'), findsOneWidget);
      expect(find.text('Submit Proposal →'), findsOneWidget);
    });

    testWidgets('H02MyApplicationsScreen renders segmented tabs and application cards', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: H02MyApplicationsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('My Applications'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);
      expect(find.text('Shortlisted'), findsOneWidget);
      expect(find.text('Accepted'), findsOneWidget);
      expect(find.text('Closed'), findsOneWidget);
    });

    testWidgets('H03ApplicationDetailScreen renders timeline and proposal details', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: H03ApplicationDetailScreen(applicationId: 'app-001'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Application Details'), findsOneWidget);
      expect(find.text('Summer Festive Lookbook Reels'), findsOneWidget);
      expect(find.text('APPLICATION TIMELINE'), findsOneWidget);
      expect(find.text('Proposal Submitted'), findsOneWidget);
      expect(find.text('Shortlisted for Hiring'), findsOneWidget);
      expect(find.text('Chat with Zara India →'), findsOneWidget);
    });

    testWidgets('H04SendInviteScreen renders recipient card, toggle and 7-day badge', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: H04SendInviteScreen(
              recipientId: 'usr-p',
              recipientName: 'Priya Patel',
              recipientRole: 'Fashion Creator',
            ),
          ),
        ),
      );

      expect(find.text('Send Direct Invite'), findsOneWidget);
      expect(find.text('Priya Patel'), findsOneWidget);
      expect(find.text('Paid Hire'), findsOneWidget);
      expect(find.text('Peer Collab'), findsOneWidget);
      expect(find.textContaining('Direct invitations auto-expire after 7 days'), findsOneWidget);
      expect(find.text('Send Private Invitation →'), findsOneWidget);
    });

    testWidgets('H05InvitesInboxScreen renders received invites and action buttons', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: H05InvitesInboxScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Direct Invites'), findsOneWidget);
      expect(find.textContaining('Received'), findsOneWidget);
      expect(find.textContaining('Sent'), findsOneWidget);
      expect(find.text('Monsoon Trail Run Campaign'), findsOneWidget);
      expect(find.text('Review & Accept →'), findsNWidgets(2));
      expect(find.text('Decline'), findsNWidgets(2));
    });

    testWidgets('H06InviteDetailScreen renders brief deliverables and escrow status', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: H06InviteDetailScreen(inviteId: 'inv-001'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Private Brief'), findsOneWidget);
      expect(find.text('Monsoon Trail Run Campaign'), findsOneWidget);
      expect(find.text('Escrow Ready'), findsOneWidget);
      expect(find.text('SCOPE OF WORK'), findsOneWidget);
      expect(find.text('Accept & Start Project →'), findsOneWidget);
    });

    testWidgets('H07SentInvitesScreen renders outbound invitations list', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: H07SentInvitesScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sent Invites'), findsOneWidget);
      expect(find.text('Monsoon Activewear Dedicated Reel'), findsOneWidget);
      expect(find.text('Cancel Invite'), findsOneWidget);
    });
  });

  group('Module H: Modal Dialogs & Sheets Tests (DLG-48 to DLG-55)', () {
    testWidgets('DLG-48 Application Sent Confirmation Sheet renders properly', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg48ApplicationSentSheet(
              brandName: 'Zara India',
              onViewApplication: () {},
              onKeepBrowsing: () {},
            ),
          ),
        ),
      );

      expect(find.text('Proposal Submitted!'), findsOneWidget);
      expect(find.textContaining('Zara India has received your pitch'), findsOneWidget);
      expect(find.text('View My Application →'), findsOneWidget);
      expect(find.text('Keep Browsing Briefs'), findsOneWidget);
    });

    testWidgets('DLG-49 Quota Reached Sheet renders paywall message and reset time', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg49QuotaReachedSheet(
              daysUntilReset: 12,
              onUpgradePro: () {},
            ),
          ),
        ),
      );

      expect(find.text('Monthly Quota Reached'), findsOneWidget);
      expect(find.textContaining('resets in 12 days'), findsOneWidget);
      expect(find.text('Upgrade to Pro (Unlimited) →'), findsOneWidget);
    });

    testWidgets('DLG-50 Withdraw Application Dialog renders warning message', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg50WithdrawApplicationDialog(
              brandName: 'Cult.Fit',
              isShortlisted: true,
              onConfirmWithdraw: () {},
            ),
          ),
        ),
      );

      expect(find.text('Withdraw Proposal?'), findsOneWidget);
      expect(find.textContaining('currently shortlisted by Cult.Fit'), findsOneWidget);
      expect(find.text('Withdraw Proposal'), findsOneWidget);
      expect(find.text('Keep Active'), findsOneWidget);
    });

    testWidgets('DLG-51 Already Applied Guard Dialog renders duplicate warning', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg51AlreadyAppliedDialog(
              assignmentTitle: 'Summer Reels',
              brandName: 'Zara India',
              onViewApplication: () {},
            ),
          ),
        ),
      );

      expect(find.text('Already Submitted'), findsOneWidget);
      expect(find.textContaining('Multiple pitches for the same assignment are not permitted'), findsOneWidget);
      expect(find.text('View My Application →'), findsOneWidget);
    });

    testWidgets('DLG-52 Invite Sent Confirmation Sheet renders dispatched notice', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg52InviteSentSheet(
              recipientName: 'Priya Patel',
              budgetOffered: 22000,
              onTrackSentInvites: () {},
            ),
          ),
        ),
      );

      expect(find.text('Private Invite Dispatched!'), findsOneWidget);
      expect(find.textContaining('delivered to Priya Patel'), findsOneWidget);
      expect(find.text('Track in Sent Invites →'), findsOneWidget);
    });

    testWidgets('DLG-53 Accept Invite Dialog renders escrow binding notice', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg53AcceptInviteDialog(
              senderName: 'Nike India',
              budgetOffered: 35000,
              onConfirmAccept: () {},
            ),
          ),
        ),
      );

      expect(find.text('Accept Collaboration?'), findsOneWidget);
      expect(find.textContaining('protected in secure escrow'), findsOneWidget);
      expect(find.text('Accept & Start Project →'), findsOneWidget);
    });

    testWidgets('DLG-54 Decline Invite Sheet renders feedback chips and decline button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg54DeclineInviteSheet(
              senderName: 'Nike India',
              onConfirmDecline: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('Decline Invitation'), findsNWidgets(2));
      expect(find.text('Fully booked'), findsOneWidget);
      expect(find.text('Budget below rate'), findsOneWidget);
      expect(find.text('Timeline conflict'), findsOneWidget);
    });

    testWidgets('DLG-55 Cancel Sent Invite Dialog renders confirmation notice', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Dlg55CancelInviteDialog(
              recipientName: 'Priya Patel',
              onConfirmCancel: () {},
            ),
          ),
        ),
      );

      expect(find.text('Cancel Pending Invite?'), findsOneWidget);
      expect(find.textContaining('revoke your private offer to Priya Patel'), findsOneWidget);
      expect(find.text('Cancel Invite'), findsOneWidget);
    });
  });
}
