import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/repositories/applications_invites_repository.dart';
import '../../domain/entities/application_entities.dart';
import '../dialogs/dlg_50_withdraw_application_dialog.dart';
import '../widgets/status_timeline_widget.dart';

/// H03: Application Detail & Status Timeline Screen (Master Catalogue §H, Page 9 & 23)
class H03ApplicationDetailScreen extends ConsumerStatefulWidget {
  final String applicationId;

  const H03ApplicationDetailScreen({
    super.key,
    required this.applicationId,
  });

  @override
  ConsumerState<H03ApplicationDetailScreen> createState() =>
      _H03ApplicationDetailScreenState();
}

class _H03ApplicationDetailScreenState
    extends ConsumerState<H03ApplicationDetailScreen> {
  ApplicationModel? _application;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    final repo = ref.read(applicationsInvitesRepositoryProvider);
    final detail = await repo.getApplicationDetail(widget.applicationId);
    if (mounted) {
      setState(() {
        _application = detail;
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

    final app = _application;
    if (app == null) {
      return Scaffold(
        backgroundColor: AppColors.backgroundPrimary,
        appBar: AppBar(title: const Text('Application Not Found')),
        body: const Center(child: Text('This application could not be found.')),
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
          'Application Details',
          style: AppTypography.headingMedium().copyWith(fontSize: 16),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: _buildStatusPill(app.status),
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
                app.assignmentTitle,
                style: AppTypography.headingLarge().copyWith(fontSize: 22),
              ),
              const SizedBox(height: 4),
              Text(
                'Posted by ${app.brandName} · ${app.location} · Budget ₹${app.assignmentBudget.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                style: AppTypography.bodyMedium(color: AppColors.textSecondary)
                    .copyWith(fontSize: 13),
              ),

              const SizedBox(height: 18),

              // Status Timeline Stepper
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
                      'APPLICATION TIMELINE',
                      style: AppTypography.label(color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 16),
                    StatusTimelineWidget(events: app.timeline),
                  ],
                ),
              ),

              // Feedback if available
              if (app.brandFeedback != null && app.brandFeedback!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFDF7),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFFE486), width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.star_rounded,
                              size: 18, color: Color(0xFF9A6700)),
                          const SizedBox(width: 6),
                          Text(
                            'MESSAGE FROM ${app.brandName.toUpperCase()}',
                            style: AppTypography.label(
                                color: const Color(0xFF9A6700)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '"${app.brandFeedback}"',
                        style: AppTypography.bodyMedium(
                          color: AppColors.textPrimary,
                        ).copyWith(fontSize: 13, fontStyle: FontStyle.italic),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 16),

              // Your Quoted Fee & Terms
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border, width: 1.5),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'YOUR QUOTED RATE',
                          style: AppTypography.label(color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '₹${app.proposedRate.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                          style: AppTypography.headingLarge().copyWith(fontSize: 20),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'ESTIMATED TIME',
                          style: AppTypography.label(color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${app.estimatedDays} Days delivery',
                          style: AppTypography.headingMedium().copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Submitted Pitch Box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border, width: 1.5),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'YOUR SUBMITTED COVER PITCH',
                      style: AppTypography.label(color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      app.coverLetter,
                      style: AppTypography.bodyMedium(
                        color: AppColors.textPrimary,
                      ).copyWith(fontSize: 13, height: 1.5),
                    ),
                  ],
                ),
              ),

              if (app.attachments.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SUBMITTED PORTFOLIO PROOFS',
                        style: AppTypography.label(color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 10),
                      for (final att in app.attachments) ...[
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: AppColors.accentMint,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                      color: AppColors.textPrimary, width: 1),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  att.type == 'video' ? '🎬' : '🔗',
                                  style: const TextStyle(fontSize: 11),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  att.title,
                                  style: AppTypography.caption(
                                    color: AppColors.textPrimary,
                                  ).copyWith(fontWeight: FontWeight.w700),
                                ),
                              ),
                              const Icon(Icons.open_in_new,
                                  size: 14, color: AppColors.textMuted),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // Direct Chat CTA
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pushNamed(context, '/conversations');
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
                    'Chat with ${app.brandName} →',
                    style: AppTypography.buttonLarge().copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),

              if (app.isActive || app.isShortlisted) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 40,
                  child: TextButton(
                    onPressed: () {
                      final navigator = Navigator.of(context);
                      Dlg50WithdrawApplicationDialog.show(
                        context,
                        brandName: app.brandName,
                        isShortlisted: app.isShortlisted,
                        onConfirmWithdraw: () async {
                          final repo =
                              ref.read(applicationsInvitesRepositoryProvider);
                          await repo.withdrawApplication(app.id);
                          if (mounted) {
                            navigator.pop();
                          }
                        },
                      );
                    },
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.error,
                    ),
                    child: Text(
                      'Withdraw This Proposal',
                      style: AppTypography.buttonLarge(color: AppColors.error)
                          .copyWith(fontSize: 13),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusPill(ApplicationStatus status) {
    Color bg;
    Color fg;
    String text;

    switch (status) {
      case ApplicationStatus.submitted:
      case ApplicationStatus.underReview:
        bg = const Color(0xFFEBF3FF);
        fg = const Color(0xFF1E66D0);
        text = 'In Review';
        break;
      case ApplicationStatus.shortlisted:
        bg = const Color(0xFFFBF1DC);
        fg = const Color(0xFF9A6700);
        text = 'Shortlisted';
        break;
      case ApplicationStatus.accepted:
        bg = const Color(0xFFE6F4EC);
        fg = AppColors.success;
        text = 'Accepted';
        break;
      case ApplicationStatus.rejected:
      case ApplicationStatus.withdrawn:
        bg = AppColors.backgroundSecondary;
        fg = AppColors.textMuted;
        text = 'Closed';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
