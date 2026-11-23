import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/repositories/applications_invites_repository.dart';
import '../../domain/entities/invitation_entities.dart';
import '../bottom_sheets/dlg_54_decline_invite_sheet.dart';
import '../controllers/applications_invites_controllers.dart';
import '../dialogs/dlg_53_accept_invite_dialog.dart';
import '../widgets/countdown_badge_widget.dart';

/// H06: Direct Invite Detail & Acceptance Flow (Master Catalogue §H, Page 9 & 23)
class H06InviteDetailScreen extends ConsumerStatefulWidget {
  final String inviteId;

  const H06InviteDetailScreen({
    super.key,
    required this.inviteId,
  });

  @override
  ConsumerState<H06InviteDetailScreen> createState() =>
      _H06InviteDetailScreenState();
}

class _H06InviteDetailScreenState extends ConsumerState<H06InviteDetailScreen> {
  InvitationModel? _invitation;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    final repo = ref.read(applicationsInvitesRepositoryProvider);
    final detail = await repo.getInviteDetail(widget.inviteId);
    if (mounted) {
      setState(() {
        _invitation = detail;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.backgroundPrimary,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.textPrimary),
        ),
      );
    }

    final inv = _invitation;
    if (inv == null) {
      return Scaffold(
        backgroundColor: AppColors.backgroundPrimary,
        appBar: AppBar(title: const Text('Invite Not Found')),
        body: const Center(child: Text('This invitation could not be found.')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Private Brief',
          style: AppTypography.headingMedium().copyWith(fontSize: 16),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CountdownBadgeWidget(
              daysRemaining: inv.daysRemaining,
              isExpired: inv.isExpired,
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Card
              Text(
                inv.projectTitle,
                style: AppTypography.headingLarge().copyWith(fontSize: 22),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Text(
                    'From ${inv.senderName} · ${inv.senderRole}',
                    style: AppTypography.bodyMedium(
                      color: AppColors.textSecondary,
                    ).copyWith(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.verified, size: 14, color: AppColors.success),
                ],
              ),

              const SizedBox(height: 18),

              // Offered Compensation Box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFDF7),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFFFE486), width: 1.5),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'OFFERED COMPENSATION',
                          style: AppTypography.label(
                            color: const Color(0xFF8C6A0A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          inv.budgetOffered > 0
                              ? '₹${inv.budgetOffered.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}'
                              : 'Unpaid Peer Exchange',
                          style: AppTypography.headingLarge().copyWith(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE6F4EC),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'Escrow Ready',
                        style: AppTypography.caption(color: AppColors.success)
                            .copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Deliverables Scope of Work
              if (inv.deliverables.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SCOPE OF WORK',
                        style: AppTypography.label(color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 12),
                      for (final d in inv.deliverables) ...[
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(
                                padding: EdgeInsets.only(top: 2),
                                child: Icon(Icons.check_circle_rounded,
                                    size: 16, color: AppColors.success),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  d,
                                  style: AppTypography.bodyMedium(
                                    color: AppColors.textPrimary,
                                  ).copyWith(fontSize: 13, height: 1.4),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Message from Sender
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border, width: 1.5),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PERSONAL MESSAGE FROM ${inv.senderName.toUpperCase()}',
                      style: AppTypography.label(color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      inv.message,
                      style: AppTypography.bodyMedium(
                        color: AppColors.textPrimary,
                      ).copyWith(fontSize: 13, height: 1.5),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Terms Notice
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.backgroundSecondary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '* By accepting, a dedicated project workspace (G10) will be created and ₹${inv.budgetOffered} will be secured in platform escrow.',
                  style: AppTypography.caption(color: AppColors.textSecondary)
                      .copyWith(height: 1.4),
                ),
              ),

              const SizedBox(height: 24),

              // Actions
              if (inv.isPending) ...[
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: SizedBox(
                        height: 46,
                        child: ElevatedButton(
                          onPressed: () {
                            Dlg53AcceptInviteDialog.show(
                              context,
                              senderName: inv.senderName,
                              budgetOffered: inv.budgetOffered,
                              onConfirmAccept: () async {
                                final ok = await ref
                                    .read(invitationsProvider.notifier)
                                    .acceptInvite(inv.id);
                                if (context.mounted && ok) {
                                  Navigator.pop(context);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                          'Collaboration accepted! Project workspace created 🎉'),
                                      backgroundColor: AppColors.success,
                                    ),
                                  );
                                }
                              },
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.textPrimary,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                          child: Text(
                            'Accept & Start Project →',
                            style: AppTypography.buttonLarge().copyWith(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 1,
                      child: SizedBox(
                        height: 46,
                        child: OutlinedButton(
                          onPressed: () {
                            Dlg54DeclineInviteSheet.show(
                              context,
                              senderName: inv.senderName,
                              onConfirmDecline: (reason) async {
                                final ok = await ref
                                    .read(invitationsProvider.notifier)
                                    .declineInvite(inv.id, reason);
                                if (context.mounted && ok) {
                                  Navigator.pop(context);
                                }
                              },
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.textPrimary,
                            side: const BorderSide(
                                color: AppColors.border, width: 1.5),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                          child: Text(
                            'Decline',
                            style: AppTypography.buttonLarge().copyWith(
                              fontSize: 13.5,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
