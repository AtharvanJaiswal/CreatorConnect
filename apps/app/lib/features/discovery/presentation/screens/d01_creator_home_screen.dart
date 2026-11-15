import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/animations/app_animations.dart';
import '../../../../core/config/feature_flags.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../../domain/entities/dashboard_category_config.dart';
import '../controllers/module_d_controllers.dart';
import '../bottom_sheets/d15_profile_quick_view_sheet.dart';
import '../dialogs/pop_dialogs.dart';
import '../widgets/dashboard_category_strip.dart';
import '../widgets/offline_banner_widget.dart';
import '../widgets/d16_connect_sent_overlay.dart';
import '../../../../core/network/connectivity_service.dart';
import '../../../../core/widgets/safe_image.dart';

class D01CreatorHomeScreen extends ConsumerWidget {
  final VoidCallback onNavigateToNotifications;
  final VoidCallback onNavigateToChat;
  final ValueChanged<String> onOpenProfile;
  final ValueChanged<String> onApplyOpportunity;
  final VoidCallback? onEditCategories;
  final ValueChanged<String>? onQuickAction;
  final VoidCallback? onOpenDiscoverTab;

  const D01CreatorHomeScreen({
    super.key,
    required this.onNavigateToNotifications,
    required this.onNavigateToChat,
    required this.onOpenProfile,
    required this.onApplyOpportunity,
    this.onEditCategories,
    this.onQuickAction,
    this.onOpenDiscoverTab,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeDashboardProvider);
    final notifier = ref.read(homeDashboardProvider.notifier);
    final unreadCount = ref.watch(notificationCenterProvider).unreadCount;
    final remainingQuota = ref.watch(connectionQuotaProvider);
    final persona = state.persona;
    final visibleRecs = state.filteredRecommendations;
    final visibleOpps = state.filteredOpportunities;
    final primaryCategory = state.activeCategoryFilter ??
        (state.selectedCategories.isNotEmpty
            ? state.selectedCategories.first
            : 'Fashion & Lifestyle');
    final firstOpp = visibleOpps.isNotEmpty ? visibleOpps.first : null;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.textPrimary,
          backgroundColor: AppColors.primary,
          onRefresh: () async {
            await notifier.loadDashboard(state.role);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // 1. Sticky Header
              SliverPersistentHeader(
                pinned: true,
                delegate: _StickyCreatorHeaderDelegate(
                  unreadCount: unreadCount,
                  accentColor: persona.accentColor,
                  avatarInitial: persona.badgeLabel.isNotEmpty
                      ? persona.badgeLabel[0]
                      : 'C',
                  onNotificationsTap: onNavigateToNotifications,
                  onChatTap: onNavigateToChat,
                  onAvatarTap: () => onOpenProfile('self'),
                ),
              ),

              if (state.isOfflineFallback || !ref.watch(networkConnectivityProvider).isOnline)
                SliverToBoxAdapter(
                  child: OfflineBannerWidget(
                    onRetry: () async {
                      await ref.read(networkConnectivityProvider.notifier).probeConnectivity();
                      notifier.loadDashboard(state.role);
                    },
                  ),
                ),

              // 2. Role Badge, Greeting, Alert Banner & Category Controls
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DashboardRoleBadge(
                        persona: persona,
                        specialty: state.roleSpecialty,
                        onTap: () => _showRoleSwitcher(context, ref),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        state.greeting,
                        style: AppTypography.displayLarge().copyWith(fontSize: 24),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${persona.dashboardSubtitle} · ${state.city}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Profile Ongoing Optimization Nudge (Master Audit §2.1)
                      if (persona.roleKey == 'CREATOR' && state.completionPercentage >= 100) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3E8FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFD8B4FE), width: 1.2),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF6B21A8),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.rocket_launch_rounded, size: 14, color: Colors.white),
                              ),
                              const SizedBox(width: 10),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Boost discovery by 2.4x',
                                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF6B21A8)),
                                    ),
                                    Text(
                                      'Add latest portfolio video or rate card',
                                      style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              TextButton(
                                onPressed: () => onOpenProfile('self'),
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  minimumSize: const Size(0, 28),
                                  backgroundColor: const Color(0xFF6B21A8),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                ),
                                child: const Text('Optimize →', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Role & Category-Personalized Alert Card
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF9E6),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFFFE486), width: 1.5),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: persona.accentColor,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(persona.roleIcon, size: 20, color: AppColors.textPrimary),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    persona.buildAlertTitle(
                                      visibleOpps.length,
                                      primaryCategory,
                                    ),
                                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    firstOpp != null
                                        ? '${firstOpp.brandName} · ${firstOpp.category} (${firstOpp.location})'
                                        : persona.buildAlertSubtitle(
                                            primaryCategory: primaryCategory,
                                            city: state.city,
                                            specialty: state.roleSpecialty,
                                          ),
                                    style: AppTypography.bodyMedium().copyWith(fontSize: 11.5),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton(
                              onPressed: () {
                                if (firstOpp != null) {
                                  onApplyOpportunity(firstOpp.id);
                                } else if (onOpenDiscoverTab != null) {
                                  onOpenDiscoverTab!();
                                } else {
                                  onApplyOpportunity('opp-01');
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.textPrimary,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                minimumSize: const Size(0, 32),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                              ),
                              child: const Text('View', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                            ),
                          ],
                        ),
                      ),

                      if (state.selectedCategories.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        DashboardCategoryFilterBar(
                          categories: state.selectedCategories,
                          selectedCategory: state.activeCategoryFilter,
                          onSelectCategory: notifier.selectCategoryFilter,
                          onEditCategories: onEditCategories,
                        ),
                      ],

                      const SizedBox(height: 14),
                      DashboardQuickActionsRow(
                        persona: persona,
                        onActionTap: (actionId) {
                          if (onQuickAction != null) {
                            onQuickAction!(actionId);
                          } else if (actionId == 'edit_categories' &&
                              onEditCategories != null) {
                            onEditCategories!();
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),

              // 3. Quick Performance Stats Row
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      _buildStatCard(
                        value: (state.stats['profileViews'] ?? 0).toString(),
                        label: 'PROFILE VIEWS',
                        subtext: (state.stats['profileViewsTrend'] ?? persona.stat1FallbackTrend).toString(),
                        subtextColor: AppColors.success,
                      ),
                      const SizedBox(width: 8),
                      _buildStatCard(
                        value: () {
                          final rating = state.stats['avgRating'] ?? state.stats['rating'];
                          if (rating == null || rating == 0 || rating == '0') return '—';
                          return '$rating ⭐';
                        }(),
                        label: 'AVG RATING',
                        subtext: persona.stat2FallbackSub,
                        subtextColor: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 8),
                      _buildStatCard(
                        value: state.stats['escrowAmount'] != null
                            ? '₹${state.stats['escrowAmount']}'
                            : (state.stats['collabCalls'] ??
                                    state.stats['collabRequests'] ??
                                    state.stats['openBriefs'] ??
                                    state.stats['openBriefsCount'] ??
                                    visibleOpps.length)
                                .toString(),
                        label: state.stats['escrowAmount'] != null
                            ? 'IN ESCROW'
                            : 'COLLAB CALLS',
                        subtext: state.stats['escrowAmount'] != null
                            ? '2 active collabs'
                            : persona.stat3FallbackSub,
                        subtextColor: const Color(0xFFC98A16),
                      ),
                    ],
                  ),
                ),
              ),

              // 4. Role-Matched Recommendations Horizontal Carousel
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                persona.recommendedSectionTitle,
                                style: AppTypography.headingLarge().copyWith(fontSize: 17),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.secondary.withOpacity(0.4),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text('SOW §13', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800)),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pushNamed(context, '/recommendations');
                        },
                        child: const Text('See All →', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: visibleRecs.isEmpty
                    ? Padding(
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
                              const Icon(Icons.explore_outlined, color: AppColors.textSecondary),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  state.activeCategoryFilter != null
                                      ? 'No ${state.activeCategoryFilter} matches in this snapshot yet.'
                                      : 'Discover verified collaborators matched to your profile.',
                                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                                ),
                              ),
                              if (state.activeCategoryFilter != null)
                                TextButton(
                                  onPressed: () => notifier.selectCategoryFilter(null),
                                  child: const Text('Show All', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.textPrimary)),
                                ),
                            ],
                          ),
                        ),
                      )
                    : SizedBox(
                        height: 236,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          scrollDirection: Axis.horizontal,
                          itemCount: visibleRecs.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 12),
                          itemBuilder: (context, idx) {
                            final item = visibleRecs[idx];
                            return StaggeredEntrance(
                              index: idx,
                              child: _buildCarouselProfileCard(
                                context: context,
                                ref: ref,
                                profile: item,
                                remainingQuota: remainingQuota,
                                onOpenProfile: onOpenProfile,
                              ),
                            );
                          },
                        ),
                      ),
              ),

              // 5. Role & Category Opportunities Vertical List
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          persona.opportunitiesSectionTitle,
                          style: AppTypography.headingLarge().copyWith(fontSize: 17),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      InkWell(
                        onTap: () => PopDialogs.showLocationPrimer(context),
                        child: Row(
                          children: [
                            const Icon(Icons.near_me_outlined, size: 14, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(
                              state.city.isNotEmpty ? state.city : 'Mumbai MMR',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              if (visibleOpps.isEmpty)
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
                                ? 'No collab calls in "${state.activeCategoryFilter}" right now'
                                : 'No collab calls in your feed yet',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Try switching categories or browse verified peers in Discovery.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 12),
                          if (state.activeCategoryFilter != null)
                            OutlinedButton(
                              onPressed: () => notifier.selectCategoryFilter(null),
                              child: const Text('Clear Category Filter'),
                            )
                          else if (onOpenDiscoverTab != null)
                            OutlinedButton(
                              onPressed: onOpenDiscoverTab,
                              child: const Text('Explore Discovery →'),
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
                    delegate: SliverChildBuilderDelegate(
                      (context, idx) {
                        final opp = visibleOpps[idx];
                        return _buildOpportunityCard(opp, onApplyOpportunity);
                      },
                      childCount: visibleOpps.length,
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 88)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String value,
    required String label,
    required String subtext,
    required Color subtextColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                maxLines: 1,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.textMuted),
            ),
            const SizedBox(height: 3),
            Text(
              subtext,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: subtextColor),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCarouselProfileCard({
    required BuildContext context,
    required WidgetRef ref,
    required ProfileCardModel profile,
    required int remainingQuota,
    required ValueChanged<String> onOpenProfile,
  }) {
    return GestureDetector(
      onTap: () => onOpenProfile(profile.id),
      onLongPress: () {
        D15ProfileQuickViewSheet.show(
          context,
          profile: profile,
          onViewFullProfile: () => onOpenProfile(profile.id),
          onConnect: () => _handleConnect(context, ref, profile, remainingQuota),
        );
      },
      child: Container(
        width: 175,
        clipBehavior: Clip.antiAlias,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.border, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundImage: safeNetworkImage(profile.avatarUrl),
                  child: safeNetworkImage(profile.avatarUrl) == null
                      ? Text(
                          profile.name.isNotEmpty ? profile.name[0] : 'U',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                        )
                      : null,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.name,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        profile.city,
                        style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9E6),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0xFFFFE486)),
              ),
              child: Text(
                DashboardCategoryCatalog.metaFor(profile.niche)?.name ??
                    DashboardCategoryCatalog.formatCategoryName(profile.niche),
                style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Color(0xFF8C6A0A)),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Starts at ${profile.currency}${profile.startingRate}',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 32,
              child: ElevatedButton(
                onPressed: () => _handleConnect(context, ref, profile, remainingQuota),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                child: const Text('Connect', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _handleConnect(
    BuildContext context,
    WidgetRef ref,
    ProfileCardModel profile,
    int remainingQuota,
  ) async {
    if (remainingQuota <= 0) {
      PopDialogs.showQuotaPaywall(context);
      return;
    }

    final success = await ref.read(connectionQuotaProvider.notifier).requestConnection(profile.id);
    if (success && context.mounted) {
      D16ConnectSentOverlay.show(
        context,
        handle: profile.handle,
        onUndo: () {
          ref.read(connectionQuotaProvider.notifier).resetQuotaForTesting();
        },
      );
    }
  }

  Widget _buildOpportunityCard(OpportunityBrief opp, ValueChanged<String> onApply) {
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
            children: [
              CircleAvatar(
                radius: 16,
                backgroundImage: safeNetworkImage(opp.brandLogo),
                child: safeNetworkImage(opp.brandLogo) == null
                    ? const Icon(Icons.business_rounded, size: 16)
                    : null,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  opp.brandName,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.backgroundSecondary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  opp.deadline,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            opp.title,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          if (opp.category.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.28),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    opp.category,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    opp.deliverableType,
                    style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                opp.budget > 0 ? '${opp.currency}${opp.budget}' : 'Peer Collab',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppColors.textPrimary),
              ),
              const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
              Expanded(
                child: Text(
                  opp.location,
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () => onApply(opp.id),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  minimumSize: const Size(0, 32),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                child: Text(
                  FeatureFlags.enableCorporateApplications
                      ? 'Apply Now'
                      : 'Connect & Chat',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showRoleSwitcher(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text('Switch Active Role', style: AppTypography.headingLarge().copyWith(fontSize: 18)),
            const SizedBox(height: 4),
            const Text(
              'Switch your dashboard persona and collaboration mode',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 18),
            _roleOption(context, ref, 'CREATOR', 'Fashion Creator', Icons.person_pin_rounded, const Color(0xFFFFD64A)),
            _roleOption(context, ref, 'PRODUCTION_PRO', 'Production Professional', Icons.videocam_rounded, const Color(0xFFB6E09B)),
            _roleOption(context, ref, 'PODCASTER', 'Podcaster / Host', Icons.mic_rounded, const Color(0xFFC9B6F7)),
            _roleOption(context, ref, 'BRAND', 'Brand / Client Hub', Icons.business_rounded, const Color(0xFFA6CCF7)),
          ],
        ),
      ),
    );
  }

  Widget _roleOption(
    BuildContext context,
    WidgetRef ref,
    String roleKey,
    String label,
    IconData icon,
    Color color,
  ) {
    final currentRole = ref.watch(homeDashboardProvider).role;
    final isSelected = currentRole.toUpperCase() == roleKey.toUpperCase();

    return ListTile(
      onTap: () {
        Navigator.pop(context);
        ref.read(homeDashboardProvider.notifier).loadDashboard(roleKey);
      },
      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.2),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: AppColors.textPrimary, size: 20),
      ),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
      trailing: isSelected
          ? const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 20)
          : null,
    );
  }
}

class _StickyCreatorHeaderDelegate extends SliverPersistentHeaderDelegate {
  final int unreadCount;
  final Color accentColor;
  final String avatarInitial;
  final VoidCallback onNotificationsTap;
  final VoidCallback onChatTap;
  final VoidCallback onAvatarTap;

  _StickyCreatorHeaderDelegate({
    required this.unreadCount,
    this.accentColor = AppColors.primary,
    this.avatarInitial = 'C',
    required this.onNotificationsTap,
    required this.onChatTap,
    required this.onAvatarTap,
  });

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: AppColors.backgroundPrimary,
        border: Border(
          bottom: BorderSide(
            color: shrinkOffset > 5 ? AppColors.border : Colors.transparent,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: onAvatarTap,
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: accentColor,
                shape: BoxShape.circle,
              ),
              child: CircleAvatar(
                radius: 17,
                backgroundColor: AppColors.surface,
                child: Text(
                  avatarInitial,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'CreatorConnect',
            style: AppTypography.headingLarge().copyWith(fontSize: 18),
          ),
          const Spacer(),
          IconButton(
            onPressed: onNotificationsTap,
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
                      decoration: const BoxDecoration(
                        color: AppColors.error,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$unreadCount',
                        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            onPressed: onChatTap,
            icon: const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textPrimary, size: 22),
          ),
        ],
      ),
    );
  }

  @override
  double get maxExtent => 64;

  @override
  double get minExtent => 64;

  @override
  bool shouldRebuild(covariant _StickyCreatorHeaderDelegate oldDelegate) {
    return oldDelegate.unreadCount != unreadCount ||
        oldDelegate.accentColor != accentColor ||
        oldDelegate.avatarInitial != avatarInitial;
  }
}
