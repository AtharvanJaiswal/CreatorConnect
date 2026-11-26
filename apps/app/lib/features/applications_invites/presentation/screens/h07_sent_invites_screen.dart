import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/applications_invites_controllers.dart';
import '../dialogs/dlg_55_cancel_invite_dialog.dart';
import '../widgets/invitation_card_widget.dart';
import 'h06_invite_detail_screen.dart';

/// H07: Sent Invites Outbox Tracker (Master Catalogue §H, Page 9 & 23)
class H07SentInvitesScreen extends ConsumerWidget {
  final bool isEmbedded;

  const H07SentInvitesScreen({
    super.key,
    this.isEmbedded = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(invitationsProvider);

    final content = RefreshIndicator(
      color: AppColors.textPrimary,
      backgroundColor: AppColors.primary,
      onRefresh: () async {
        await ref.read(invitationsProvider.notifier).loadAll();
      },
      child: state.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.textPrimary),
            )
          : state.sent.isEmpty
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
                        child: const Text('📤', style: TextStyle(fontSize: 28)),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'No sent invitations',
                        style: AppTypography.headingMedium().copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Direct invitations you send to creators and partners will appear here.',
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
                  itemCount: state.sent.length,
                  itemBuilder: (context, index) {
                    final inv = state.sent[index];
                    return InvitationCardWidget(
                      invitation: inv,
                      isSentView: true,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                H06InviteDetailScreen(inviteId: inv.id),
                          ),
                        );
                      },
                      onCancel: () {
                        Dlg55CancelInviteDialog.show(
                          context,
                          recipientName: inv.recipientName,
                          onConfirmCancel: () async {
                            final ok = await ref
                                .read(invitationsProvider.notifier)
                                .cancelInvite(inv.id);
                            if (context.mounted && ok) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Invitation cancelled.')),
                              );
                            }
                          },
                        );
                      },
                    );
                  },
                ),
    );

    if (isEmbedded) {
      return content;
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Sent Invites',
          style: AppTypography.headingLarge().copyWith(fontSize: 20),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
      ),
      body: SafeArea(child: content),
    );
  }
}
