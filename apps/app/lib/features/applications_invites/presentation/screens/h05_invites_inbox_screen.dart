import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../bottom_sheets/dlg_54_decline_invite_sheet.dart';
import '../controllers/applications_invites_controllers.dart';
import '../dialogs/dlg_53_accept_invite_dialog.dart';
import '../widgets/invitation_card_widget.dart';
import 'h06_invite_detail_screen.dart';
import 'h07_sent_invites_screen.dart';

/// H05: Direct Invites Inbox (Master Catalogue §H, Page 9 & 23)
class H05InvitesInboxScreen extends ConsumerWidget {
  const H05InvitesInboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(invitationsProvider);
    final tab = ref.watch(invitesTabFilterProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Direct Invites',
          style: AppTypography.headingLarge().copyWith(fontSize: 20),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        ref.read(invitesTabFilterProvider.notifier).state =
                            InvitesTabFilter.received;
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: tab == InvitesTabFilter.received
                              ? AppColors.textPrimary
                              : AppColors.backgroundSecondary,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Received (${state.received.length})',
                          style: TextStyle(
                            color: tab == InvitesTabFilter.received
                                ? Colors.white
                                : AppColors.textSecondary,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () {
                        ref.read(invitesTabFilterProvider.notifier).state =
                            InvitesTabFilter.sent;
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: tab == InvitesTabFilter.sent
                              ? AppColors.textPrimary
                              : AppColors.backgroundSecondary,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Sent (${state.sent.length})',
                          style: TextStyle(
                            color: tab == InvitesTabFilter.sent
                                ? Colors.white
                                : AppColors.textSecondary,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(color: AppColors.border, height: 1),
            ],
          ),
        ),
      ),
      body: tab == InvitesTabFilter.sent
          ? const H07SentInvitesScreen(isEmbedded: true)
          : SafeArea(
              child: RefreshIndicator(
                color: AppColors.textPrimary,
                backgroundColor: AppColors.primary,
                onRefresh: () async {
                  await ref.read(invitationsProvider.notifier).loadAll();
                },
                child: state.isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                            color: AppColors.textPrimary),
                      )
                    : state.received.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 60,
                                  height: 60,
                                  decoration: BoxDecoration(
                                    color: AppColors.backgroundSecondary,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  alignment: Alignment.center,
                                  child: const Text('✉️',
                                      style: TextStyle(fontSize: 28)),
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  'No pending invitations',
                                  style: AppTypography.headingMedium().copyWith(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Direct invitations from verified brands and creators will appear here.',
                                  style: AppTypography.bodyMedium(
                                    color: AppColors.textSecondary,
                                  ).copyWith(fontSize: 13),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: state.received.length,
                            itemBuilder: (context, index) {
                              final inv = state.received[index];
                              return InvitationCardWidget(
                                invitation: inv,
                                isSentView: false,
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          H06InviteDetailScreen(inviteId: inv.id),
                                    ),
                                  );
                                },
                                onAccept: () {
                                  Dlg53AcceptInviteDialog.show(
                                    context,
                                    senderName: inv.senderName,
                                    budgetOffered: inv.budgetOffered,
                                    onConfirmAccept: () async {
                                      final ok = await ref
                                          .read(invitationsProvider.notifier)
                                          .acceptInvite(inv.id);
                                      if (context.mounted && ok) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                                'Collaboration accepted! Project created 🎉'),
                                            backgroundColor: AppColors.success,
                                          ),
                                        );
                                      }
                                    },
                                  );
                                },
                                onDecline: () {
                                  Dlg54DeclineInviteSheet.show(
                                    context,
                                    senderName: inv.senderName,
                                    onConfirmDecline: (reason) async {
                                      final ok = await ref
                                          .read(invitationsProvider.notifier)
                                          .declineInvite(inv.id, reason);
                                      if (context.mounted && ok) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                              content: Text(
                                                  'Invitation declined.')),
                                        );
                                      }
                                    },
                                  );
                                },
                              );
                            },
                          ),
              ),
            ),
    );
  }
}
