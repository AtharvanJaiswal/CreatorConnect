import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../controllers/campaign_controllers.dart';
import '../widgets/brief_card_widget.dart';

class E01BrandBriefsDashboardScreen extends ConsumerWidget {
  const E01BrandBriefsDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(brandBriefsProvider);
    final notifier = ref.read(brandBriefsProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Brand Campaigns & Briefs',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_rounded, color: AppColors.primaryDark, size: 28),
            onPressed: () => Navigator.pushNamed(context, '/campaigns/create'),
            tooltip: 'Create Brief',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Segmented Tabs: Active | Drafts | Past
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: Colors.white,
              child: Row(
                children: [
                  _tabChip(
                    label: 'Active',
                    isSelected: state.selectedTab == 'ACTIVE',
                    onTap: () => notifier.setTab('ACTIVE'),
                  ),
                  const SizedBox(width: 8),
                  _tabChip(
                    label: 'Drafts',
                    isSelected: state.selectedTab == 'DRAFTS',
                    onTap: () => notifier.setTab('DRAFTS'),
                  ),
                  const SizedBox(width: 8),
                  _tabChip(
                    label: 'Past',
                    isSelected: state.selectedTab == 'PAST',
                    onTap: () => notifier.setTab('PAST'),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),

            // Briefs Feed
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.textPrimary))
                  : state.filteredBriefs.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.campaign_outlined, size: 52, color: AppColors.textMuted),
                              const SizedBox(height: 12),
                              const Text('No briefs found in this view', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                              const SizedBox(height: 8),
                              ElevatedButton(
                                onPressed: () => Navigator.pushNamed(context, '/campaigns/create'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: AppColors.textPrimary,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                ),
                                child: const Text('Post Collaboration Brief', style: TextStyle(fontWeight: FontWeight.w800)),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: state.filteredBriefs.length,
                          itemBuilder: (context, idx) {
                            final brief = state.filteredBriefs[idx];
                            return BriefCardWidget(
                              brief: brief,
                              showBrandView: true,
                              onTap: () {
                                if (brief.status == CampaignStatus.draft) {
                                  Navigator.pushNamed(context, '/campaigns/create', arguments: brief);
                                } else {
                                  Navigator.pushNamed(context, '/campaigns/manage-applicants', arguments: brief.id);
                                }
                              },
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/campaigns/create'),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textPrimary,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Create Brief', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
    );
  }

  Widget _tabChip({required String label, required bool isSelected, required VoidCallback onTap}) {
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
              fontSize: 12.5,
              fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
