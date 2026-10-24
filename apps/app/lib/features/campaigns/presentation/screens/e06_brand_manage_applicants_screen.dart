import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../controllers/campaign_controllers.dart';
import '../widgets/applicant_card_widget.dart';
import '../bottom_sheets/applicant_quick_review_sheet.dart';
import '../dialogs/decline_applicant_dialog.dart';

class E06BrandManageApplicantsScreen extends ConsumerStatefulWidget {
  final String briefId;

  const E06BrandManageApplicantsScreen({super.key, required this.briefId});

  @override
  ConsumerState<E06BrandManageApplicantsScreen> createState() => _E06BrandManageApplicantsScreenState();
}

class _E06BrandManageApplicantsScreenState extends ConsumerState<E06BrandManageApplicantsScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(briefApplicantsProvider(widget.briefId));
    final notifier = ref.read(briefApplicantsProvider(widget.briefId).notifier);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Manage Applicants',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Pills: All | Shortlisted | Under Review | Declined
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: Colors.white,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _filterChip(label: 'All', isSelected: state.selectedFilter == 'ALL', onTap: () => notifier.setFilter('ALL')),
                    const SizedBox(width: 8),
                    _filterChip(label: 'Shortlisted ⭐', isSelected: state.selectedFilter == 'SHORTLISTED', onTap: () => notifier.setFilter('SHORTLISTED')),
                    const SizedBox(width: 8),
                    _filterChip(label: 'Under Review', isSelected: state.selectedFilter == 'UNDER_REVIEW', onTap: () => notifier.setFilter('UNDER_REVIEW')),
                    const SizedBox(width: 8),
                    _filterChip(label: 'Declined', isSelected: state.selectedFilter == 'REJECTED', onTap: () => notifier.setFilter('REJECTED')),
                  ],
                ),
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),

            // Applicants Feed
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.textPrimary))
                  : state.filteredApplicants.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.people_outline_rounded, size: 52, color: AppColors.textMuted),
                              SizedBox(height: 12),
                              Text('No applicants match this filter', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: state.filteredApplicants.length,
                          itemBuilder: (context, idx) {
                            final applicant = state.filteredApplicants[idx];
                            return ApplicantCardWidget(
                              application: applicant,
                              onTap: () {
                                ApplicantQuickReviewSheet.show(
                                  context,
                                  application: applicant,
                                  onAccept: () => _onAccept(applicant),
                                  onDecline: () => _onDecline(applicant),
                                  onChat: () => Navigator.pushNamed(context, '/conversations'),
                                );
                              },
                              onShortlist: () => notifier.shortlistApplicant(applicant.id),
                              onAccept: () => _onAccept(applicant),
                              onDecline: () => _onDecline(applicant),
                              onChat: () => Navigator.pushNamed(context, '/conversations'),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterChip({required String label, required bool isSelected, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(99),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceWarm,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: isSelected ? AppColors.primaryDark : AppColors.borderLight),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
      ),
    );
  }

  void _onAccept(ApplicationItem applicant) {
    Navigator.pushNamed(
      context,
      '/campaigns/accept-applicant',
      arguments: applicant,
    );
  }

  Future<void> _onDecline(ApplicationItem applicant) async {
    final reason = await DeclineApplicantDialog.show(context, applicantName: applicant.applicantName);
    if (reason != null && mounted) {
      await ref.read(briefApplicantsProvider(widget.briefId).notifier).declineApplicant(
            applicant.id,
            reason: reason,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Declined proposal from ${applicant.applicantName}.')),
        );
      }
    }
  }
}
