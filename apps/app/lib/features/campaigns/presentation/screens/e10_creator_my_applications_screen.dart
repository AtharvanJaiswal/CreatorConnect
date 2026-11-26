import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/campaign_controllers.dart';
import '../widgets/status_badge_widget.dart';

class E10CreatorMyApplicationsScreen extends ConsumerWidget {
  const E10CreatorMyApplicationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(creatorApplicationsProvider);
    final notifier = ref.read(creatorApplicationsProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'My Applications & Pitches',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Tabs: All | Shortlisted | Hired | Submitted
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: Colors.white,
              child: Row(
                children: [
                  _tabChip('All', state.selectedTab == 'ALL', () => notifier.setTab('ALL')),
                  const SizedBox(width: 8),
                  _tabChip('Shortlisted', state.selectedTab == 'SHORTLISTED', () => notifier.setTab('SHORTLISTED')),
                  const SizedBox(width: 8),
                  _tabChip('Hired', state.selectedTab == 'ACCEPTED', () => notifier.setTab('ACCEPTED')),
                  const SizedBox(width: 8),
                  _tabChip('Pending', state.selectedTab == 'SUBMITTED', () => notifier.setTab('SUBMITTED')),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),

            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.textPrimary))
                  : state.filteredApplications.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.assignment_outlined, size: 52, color: AppColors.textMuted),
                              SizedBox(height: 12),
                              Text('No proposals submitted yet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: state.filteredApplications.length,
                          itemBuilder: (context, idx) {
                            final app = state.filteredApplications[idx];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.surfacePure,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: AppColors.borderLight, width: 1.5),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(app.brandName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textMuted)),
                                      StatusBadgeWidget.fromApplicationStatus(app.status),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(app.briefTitle, style: AppTypography.headingMedium(color: AppColors.textPrimary).copyWith(fontSize: 15)),
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('Proposed: ${app.proposedRateFormatted}', style: const TextStyle(fontFamily: 'Archivo', fontWeight: FontWeight.w900, fontSize: 14)),
                                      Text('Submitted ${app.submittedAt}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabChip(String label, bool isSelected, VoidCallback onTap) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.surfaceWarm,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: isSelected ? AppColors.primaryDark : AppColors.borderLight),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
