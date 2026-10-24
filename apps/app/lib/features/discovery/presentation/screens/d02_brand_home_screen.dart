import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/module_d_controllers.dart';
import '../widgets/profile_discovery_card.dart';
import '../dialogs/pop_dialogs.dart';

class D02BrandHomeScreen extends ConsumerWidget {
  final VoidCallback onNavigateToNotifications;
  final VoidCallback onNavigateToChat;
  final ValueChanged<String> onOpenProfile;
  final ValueChanged<String> onManageApplicants;

  const D02BrandHomeScreen({
    super.key,
    required this.onNavigateToNotifications,
    required this.onNavigateToChat,
    required this.onOpenProfile,
    required this.onManageApplicants,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeDashboardProvider);
    final unreadCount = ref.watch(notificationCenterProvider).unreadCount;
    final remainingQuota = ref.watch(connectionQuotaProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.textPrimary,
          backgroundColor: AppColors.primary,
          onRefresh: () async {
            await ref.read(homeDashboardProvider.notifier).loadDashboard('BRAND');
          },
          child: CustomScrollView(
            slivers: [
              // Sticky Brand Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.business_rounded, color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(state.greeting.isNotEmpty ? state.greeting : 'Brand Hub', style: AppTypography.headingMedium().copyWith(fontSize: 16)),
                              const SizedBox(width: 4),
                              const Icon(Icons.verified_rounded, size: 14, color: Color(0xFF2E7CF6)),
                            ],
                          ),
                          const Text('Brand Dashboard', style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: onNavigateToNotifications,
                        icon: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            const Icon(Icons.notifications_none_rounded, color: AppColors.textPrimary, size: 24),
                            if (unreadCount > 0)
                              Positioned(
                                top: -2,
                                right: -2,
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                                  child: Text('$unreadCount', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                                ),
                              ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: onNavigateToChat,
                        icon: const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textPrimary, size: 22),
                      ),
                    ],
                  ),
                ),
              ),

              // Campaign Overview Banner
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.textPrimary,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Campaign Pipeline',
                              style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700),
                            ),
                            Chip(
                              label: Text(
                                '${state.stats['openBriefsCount'] ?? state.activeCampaigns.length} Active',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                              ),
                              backgroundColor: AppColors.primary,
                              padding: EdgeInsets.zero,
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          '${state.stats['pendingReviewCount'] ?? 0} Creators Waiting for Review',
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Shortlist talent and dispatch contracts to start production.',
                          style: TextStyle(color: Colors.white60, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Metrics Row: Total Applicants, Active Briefs, Hired Count
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                  child: Row(
                    children: [
                      _buildMetricBox(
                        '${state.stats['applicationsReceivedCount'] ?? 0}',
                        'APPLICANTS',
                        AppColors.primary,
                      ),
                      const SizedBox(width: 8),
                      _buildMetricBox(
                        '${state.stats['openBriefsCount'] ?? state.activeCampaigns.length}',
                        'ACTIVE BRIEFS',
                        AppColors.secondary,
                      ),
                      const SizedBox(width: 8),
                      _buildMetricBox(
                        '${state.stats['hiredCount'] ?? 0}',
                        'HIRED SO FAR',
                        AppColors.accentMint,
                      ),
                    ],
                  ),
                ),
              ),

              // Active Briefs Pipeline Section
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
                  child: Text('Active Briefs Pipeline', style: AppTypography.headingLarge().copyWith(fontSize: 17)),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, idx) {
                      final brief = state.activeCampaigns[idx];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.border, width: 1.5),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    brief.title,
                                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  brief.deadline,
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFC98A16)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${brief.applicantsCount} / ${brief.targetApplicants} applicants',
                                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                                ),
                                Text(
                                  '${(brief.progressRatio * 100).toInt()}% filled',
                                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: LinearProgressIndicator(
                                value: brief.progressRatio,
                                minHeight: 6,
                                backgroundColor: AppColors.backgroundSecondary,
                                valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Align(
                              alignment: Alignment.centerRight,
                              child: ElevatedButton(
                                onPressed: () => Navigator.pushNamed(context, '/campaigns/manage-applicants', arguments: brief.id),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.textPrimary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  minimumSize: const Size(0, 32),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                ),
                                child: const Text('Manage Applicants →', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                    childCount: state.activeCampaigns.length,
                  ),
                ),
              ),

              // Featured Available Creators Section
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Top Verified Creators Available', style: AppTypography.headingLarge().copyWith(fontSize: 17)),
                      const Text('Online Now 🟢', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success)),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, idx) {
                      final creator = state.featuredCreators[idx];
                      return ProfileDiscoveryCard(
                        profile: creator,
                        onTap: () => onOpenProfile(creator.id),
                        onConnect: () {
                          if (remainingQuota <= 0) {
                            PopDialogs.showQuotaPaywall(context);
                          } else {
                            ref.read(connectionQuotaProvider.notifier).requestConnection(creator.id);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Campaign invite sent to ${creator.handle}!')),
                            );
                          }
                        },
                      );
                    },
                    childCount: state.featuredCreators.length,
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 80)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricBox(String value, String label, Color accentColor) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: accentColor, shape: BoxShape.circle),
            ),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
