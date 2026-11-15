import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/module_d_controllers.dart';
import '../widgets/dashboard_category_strip.dart';
import '../widgets/offline_banner_widget.dart';
import '../widgets/profile_discovery_card.dart';
import '../../../../core/network/api_client.dart';
import '../dialogs/pop_dialogs.dart';

class D02BrandHomeScreen extends ConsumerWidget {
  final VoidCallback onNavigateToNotifications;
  final VoidCallback onNavigateToChat;
  final ValueChanged<String> onOpenProfile;
  final ValueChanged<String> onManageApplicants;
  final ValueChanged<String>? onQuickAction;
  final VoidCallback? onEditCategories;

  const D02BrandHomeScreen({
    super.key,
    required this.onNavigateToNotifications,
    required this.onNavigateToChat,
    required this.onOpenProfile,
    required this.onManageApplicants,
    this.onQuickAction,
    this.onEditCategories,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeDashboardProvider);
    final notifier = ref.read(homeDashboardProvider.notifier);
    final unreadCount = ref.watch(notificationCenterProvider).unreadCount;
    final remainingQuota = ref.watch(connectionQuotaProvider);
    final persona = state.persona;
    final visibleCampaigns = state.filteredCampaigns;
    final visibleFeatured = state.filteredFeaturedCreators;
    final primaryCategory =
        state.activeCategoryFilter ??
        (state.selectedCategories.isNotEmpty
            ? state.selectedCategories.first
            : 'Fashion & Lifestyle');
    final applicantsTotal =
        state.stats['totalApplicants'] ??
        state.stats['applicationsReceivedCount'] ??
        0;
    final activeBriefsTotal =
        state.stats['activeBriefs'] ??
        state.stats['openBriefsCount'] ??
        visibleCampaigns.length;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.textPrimary,
          backgroundColor: AppColors.primary,
          onRefresh: () async {
            await notifier.loadDashboard('BRAND');
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
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
                          color: AppColors.textPrimary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.business_rounded,
                          color: AppColors.primary,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    state.greeting.isNotEmpty
                                        ? state.greeting
                                        : 'Brand Hub',
                                    style: AppTypography.headingMedium()
                                        .copyWith(fontSize: 16),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(
                                  Icons.verified_rounded,
                                  size: 14,
                                  color: Color(0xFF2E7CF6),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEBF3FE),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFA6CCF7), width: 1),
                                  ),
                                  child: const Text(
                                    'Brand Scale',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF1B66C9),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${persona.dashboardSubtitle} · ${state.city}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: onNavigateToNotifications,
                        icon: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            const Icon(
                              Icons.notifications_none_rounded,
                              color: AppColors.textPrimary,
                              size: 24,
                            ),
                            if (unreadCount > 0)
                              Positioned(
                                top: -2,
                                right: -2,
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(
                                    color: AppColors.error,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Text(
                                    '$unreadCount',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: onNavigateToChat,
                        icon: const Icon(
                          Icons.chat_bubble_outline_rounded,
                          color: AppColors.textPrimary,
                          size: 22,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              if (state.isOfflineFallback)
                SliverToBoxAdapter(
                  child: OfflineBannerWidget(
                    onRetry: () async {
                      await ApiClient.probeBestLocalHost();
                      notifier.loadDashboard('BRAND');
                    },
                  ),
                ),

              // Brand Role Badge, Quick Actions & Campaign Pipeline Banner
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DashboardRoleBadge(
                        persona: persona,
                        specialty: state.roleSpecialty,
                        onTap: onQuickAction != null
                            ? () => onQuickAction!('role_details')
                            : null,
                      ),
                      const SizedBox(height: 12),
                      Container(
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
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Chip(
                                  label: Text(
                                    '$activeBriefsTotal Active',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  backgroundColor: AppColors.primary,
                                  padding: EdgeInsets.zero,
                                  materialTapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              '${state.stats['pendingReviewCount'] ?? applicantsTotal} Applicants Across $primaryCategory',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              persona.buildAlertSubtitle(
                                primaryCategory: primaryCategory,
                                city: state.city,
                                specialty: state.roleSpecialty,
                              ),
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.08),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.account_balance_wallet_outlined, size: 16, color: AppColors.primary),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Budget: ₹${state.stats['allocatedBudget'] ?? '45,000'} (₹${state.stats['escrowLockup'] ?? '15,000'} in escrow)',
                                        style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                  InkWell(
                                    onTap: () => onManageApplicants('active-brief-1'),
                                    child: const Text('Review →', style: TextStyle(color: AppColors.primary, fontSize: 11.5, fontWeight: FontWeight.w800)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (state.selectedCategories.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        DashboardCategoryFilterBar(
                          categories: state.selectedCategories,
                          selectedCategory: state.activeCategoryFilter,
                          onSelectCategory: notifier.selectCategoryFilter,
                          onEditCategories: onEditCategories,
                        ),
                      ],
                      const SizedBox(height: 12),
                      DashboardQuickActionsRow(
                        persona: persona,
                        onActionTap: (actionId) {
                          if (onQuickAction != null) {
                            onQuickAction!(actionId);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),

              // Metrics Row: Total Applicants, Active Briefs, Hired Count
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 4,
                  ),
                  child: Row(
                    children: [
                      _buildMetricBox(
                        '$applicantsTotal',
                        'APPLICANTS',
                        AppColors.primary,
                      ),
                      const SizedBox(width: 8),
                      _buildMetricBox(
                        '$activeBriefsTotal',
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
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Active Briefs Pipeline',
                        style: AppTypography.headingLarge().copyWith(
                          fontSize: 17,
                        ),
                      ),
                      if (onQuickAction != null)
                        GestureDetector(
                          onTap: () => onQuickAction!('create_brief'),
                          child: const Text(
                            '+ Post Brief',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              if (visibleCampaigns.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.border, width: 1.5),
                      ),
                      child: Column(
                        children: [
                          Text(
                            state.activeCategoryFilter != null
                                ? 'No active briefs in "${state.activeCategoryFilter}"'
                                : 'No active briefs published yet',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Create a collaboration brief to receive applications from verified creators & pros.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: state.activeCategoryFilter != null
                                ? () => notifier.selectCategoryFilter(null)
                                : () => onQuickAction?.call('create_brief'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: AppColors.textPrimary,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                            child: Text(
                              state.activeCategoryFilter != null
                                  ? 'Show All Briefs'
                                  : 'Create Campaign Brief',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate((context, idx) {
                      final brief = visibleCampaigns[idx];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: AppColors.border,
                            width: 1.5,
                          ),
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
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  brief.deadline,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFFC98A16),
                                  ),
                                ),
                              ],
                            ),
                            if (brief.category.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.accentSky.withValues(
                                    alpha: 0.3,
                                  ),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  brief.category,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${brief.applicantsCount} / ${brief.targetApplicants} applicants',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                Text(
                                  '${(brief.progressRatio * 100).toInt()}% filled',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w800,
                                  ),
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
                                valueColor: const AlwaysStoppedAnimation<Color>(
                                  AppColors.primary,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Align(
                              alignment: Alignment.centerRight,
                              child: ElevatedButton(
                                onPressed: () => onManageApplicants(brief.id),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.textPrimary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  minimumSize: const Size(0, 32),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                ),
                                child: const Text(
                                  'Manage Applicants →',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }, childCount: visibleCampaigns.length),
                  ),
                ),

              // Featured Available Creators Section
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          persona.recommendedSectionTitle,
                          style: AppTypography.headingLarge().copyWith(
                            fontSize: 17,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Online Now 🟢',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.success,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (visibleFeatured.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.border, width: 1.5),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.search_rounded,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              state.activeCategoryFilter != null
                                  ? 'No featured talent in "${state.activeCategoryFilter}" right now.'
                                  : 'Tap Scout Talent to explore verified creators, pros & podcasters.',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                          if (state.activeCategoryFilter != null)
                            TextButton(
                              onPressed: () =>
                                  notifier.selectCategoryFilter(null),
                              child: const Text('Reset'),
                            ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate((context, idx) {
                      final creator = visibleFeatured[idx];
                      return ProfileDiscoveryCard(
                        profile: creator,
                        onTap: () => onOpenProfile(creator.id),
                        onConnect: () {
                          if (remainingQuota <= 0) {
                            PopDialogs.showQuotaPaywall(context);
                          } else {
                            ref
                                .read(connectionQuotaProvider.notifier)
                                .requestConnection(creator.id);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Campaign invite sent to ${creator.handle}!',
                                ),
                              ),
                            );
                          }
                        },
                      );
                    }, childCount: visibleFeatured.length),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 88)),
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
              decoration: BoxDecoration(
                color: accentColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
