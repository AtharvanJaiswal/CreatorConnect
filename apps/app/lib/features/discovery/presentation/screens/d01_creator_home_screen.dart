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
    final primaryCategory =
        state.activeCategoryFilter ??
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
                      : 'P',
                  subtitle: '${persona.badgeLabel.toLowerCase()} dashboard',
                  onNotificationsTap: onNavigateToNotifications,
                  onChatTap: onNavigateToChat,
                  onAvatarTap: () => onOpenProfile('self'),
                ),
              ),

              if (state.isOfflineFallback ||
                  !ref.watch(networkConnectivityProvider).isOnline)
                SliverToBoxAdapter(
                  child: OfflineBannerWidget(
                    onRetry: () async {
                      await ref
                          .read(networkConnectivityProvider.notifier)
                          .probeConnectivity();
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
                        style: AppTypography.displayLarge().copyWith(
                          fontSize: 24,
                        ),
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
                          border: Border.all(
                            color: const Color(0xFFFFE486),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: persona.accentColor,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                persona.roleIcon,
                                size: 20,
                                color: AppColors.textPrimary,
                              ),
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
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
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
                                    style: AppTypography.bodyMedium().copyWith(
                                      fontSize: 11.5,
                                    ),
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
                                backgroundColor: const Color(0xFF14110F),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 8,
                                ),
                                minimumSize: const Size(0, 34),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(999),
                                ),
                              ),
                              child: const Text(
                                'Review →',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
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
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'YOUR PERFORMANCE',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: Color(0xFF8C827A),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _buildStatCard(
                            value: (state.stats['profileViews'] ?? 248).toString(),
                            label: 'PROFILE VIEWS',
                            subtext: (state.stats['profileViewsTrend'] ?? '+12 today').toString(),
                            subtextColor: AppColors.success,
                          ),
                          const SizedBox(width: 8),
                          _buildStatCard(
                            value: () {
                              final rating = state.stats['avgRating'] ?? state.stats['rating'];
                              if (rating == null || rating == 0 || rating == '0') return '4.9 ★';
                              return '$rating ★';
                            }(),
                            label: 'AVG RATING',
                            subtext: (state.stats['reviewsCount'] != null
                                ? '${state.stats['reviewsCount']} reviews'
                                : (persona.stat2FallbackSub.isNotEmpty ? persona.stat2FallbackSub : '18 reviews')),
                            subtextColor: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          _buildStatCard(
                            value: state.stats['escrowAmount'] != null
                                ? '₹${state.stats['escrowAmount']}'
                                : (state.stats['assignments'] ??
                                        state.stats['collabCalls'] ??
                                        state.stats['collabRequests'] ??
                                        state.stats['openBriefs'] ??
                                        state.stats['openBriefsCount'] ??
                                        3)
                                    .toString(),
                            label: state.stats['escrowAmount'] != null
                                ? 'IN ESCROW'
                                : 'COLLAB CALLS',
                            subtext: state.stats['escrowAmount'] != null
                                ? '2 active'
                                : '2 active',
                            subtextColor: const Color(0xFFC98A16),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // 4. Role-Matched Recommendations Horizontal Carousel
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 22, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          persona.recommendedSectionTitle,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Color(0xFF8C827A),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.pushNamed(context, '/recommendations');
                        },
                        child: const Text(
                          'See all',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
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
                            border: Border.all(
                              color: AppColors.border,
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.explore_outlined,
                                color: AppColors.textSecondary,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  state.activeCategoryFilter != null
                                      ? 'No ${state.activeCategoryFilter} matches in this snapshot yet.'
                                      : 'Discover verified collaborators matched to your profile.',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              if (state.activeCategoryFilter != null)
                                TextButton(
                                  onPressed: () =>
                                      notifier.selectCategoryFilter(null),
                                  child: const Text(
                                    'Show All',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      )
                    : SizedBox(
                        height: 232,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          scrollDirection: Axis.horizontal,
                          itemCount: visibleRecs.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 12),
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
                                index: idx,
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
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Color(0xFF8C827A),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          if (onOpenDiscoverTab != null) {
                            onOpenDiscoverTab!();
                          } else {
                            Navigator.pushNamed(context, '/discover');
                          }
                        },
                        child: const Text(
                          'Browse',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
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
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Try switching categories or browse verified peers in Discovery.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (state.activeCategoryFilter != null)
                            OutlinedButton(
                              onPressed: () =>
                                  notifier.selectCategoryFilter(null),
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
                    delegate: SliverChildBuilderDelegate((context, idx) {
                      final opp = visibleOpps[idx];
                      return _buildOpportunityCard(opp, onApplyOpportunity);
                    }, childCount: visibleOpps.length),
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFECE6DA), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
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
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                  letterSpacing: -0.5,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              subtext,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: subtextColor,
              ),
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
    int index = 0,
  }) {
    final pastelColors = [
      const Color(0xFFA6CCF7), // Soft blue (like Studio Frame in Image 4)
      const Color(0xFFB6E09B), // Soft green (like Kabir Sen in Image 4)
      const Color(0xFFFFC9A3), // Soft peach
      const Color(0xFFC9B6F7), // Soft lavender
      const Color(0xFFFFD64A), // Soft yellow
    ];
    final avatarBg = pastelColors[index % pastelColors.length];

    final tagText = profile.matchReasons.isNotEmpty
        ? profile.matchReasons.first.label
        : (profile.matchReason.isNotEmpty
            ? profile.matchReason
            : (index % 2 == 0 ? 'Fashion Match' : 'Top Rated'));

    final roleCity = '${profile.role == "BRAND" ? "D2C Brand" : (profile.niche.isNotEmpty ? profile.niche : "Creator")} · ${profile.city.isNotEmpty ? profile.city : "Mumbai"}';

    return GestureDetector(
      onTap: () => onOpenProfile(profile.id),
      onLongPress: () {
        D15ProfileQuickViewSheet.show(
          context,
          profile: profile,
          onViewFullProfile: () => onOpenProfile(profile.id),
          onConnect: () =>
              _handleConnect(context, ref, profile, remainingQuota),
        );
      },
      child: Container(
        width: 158,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFECE6DA), width: 1.3),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.035),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: avatarBg,
              backgroundImage: safeNetworkImage(profile.avatarUrl),
              child: safeNetworkImage(profile.avatarUrl) == null
                  ? Text(
                      profile.name.isNotEmpty ? profile.name[0].toUpperCase() : 'U',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                        color: AppColors.textPrimary,
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 10),
            Text(
              profile.name,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13.5,
                color: AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 2),
            Text(
              roleCity,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9E6),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0xFFFFE486), width: 1),
              ),
              child: Text(
                tagText,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF8C6A0A),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 32,
              child: ElevatedButton(
                onPressed: () =>
                    _handleConnect(context, ref, profile, remainingQuota),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                child: const Text(
                  'Connect',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 11.5,
                    color: AppColors.textPrimary,
                  ),
                ),
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

    final success = await ref
        .read(connectionQuotaProvider.notifier)
        .requestConnection(profile.id);
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

  Widget _buildOpportunityCard(
    OpportunityBrief opp,
    ValueChanged<String> onApply,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFECE6DA), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEDD5),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  opp.category.isNotEmpty ? opp.category : 'Fashion',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF9A3412),
                  ),
                ),
              ),
              Text(
                opp.deadline.isNotEmpty ? opp.deadline : '2 days left',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFFDC2626),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            opp.title,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 16,
              color: AppColors.textPrimary,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Posted by ${opp.brandName} · ${opp.location}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                opp.budget > 0 ? '${opp.currency}${opp.budget}' : '₹8,000 – ₹15,000',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: AppColors.textPrimary,
                ),
              ),
              ElevatedButton(
                onPressed: () => onApply(opp.id),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                child: const Text(
                  'Apply Now',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    color: AppColors.textPrimary,
                  ),
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
            Text(
              'Switch Active Role',
              style: AppTypography.headingLarge().copyWith(fontSize: 18),
            ),
            const SizedBox(height: 4),
            const Text(
              'Switch your dashboard persona and collaboration mode',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 18),
            _roleOption(
              context,
              ref,
              'CREATOR',
              'Fashion Creator',
              Icons.person_pin_rounded,
              const Color(0xFFFFD64A),
            ),
            _roleOption(
              context,
              ref,
              'PRODUCTION_PRO',
              'Production Professional',
              Icons.videocam_rounded,
              const Color(0xFFB6E09B),
            ),
            _roleOption(
              context,
              ref,
              'PODCASTER',
              'Podcaster / Host',
              Icons.mic_rounded,
              const Color(0xFFC9B6F7),
            ),
            _roleOption(
              context,
              ref,
              'BRAND',
              'Brand / Client Hub',
              Icons.business_rounded,
              const Color(0xFFA6CCF7),
            ),
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
      title: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      ),
      trailing: isSelected
          ? const Icon(
              Icons.check_circle_rounded,
              color: AppColors.success,
              size: 20,
            )
          : null,
    );
  }
}

class _StickyCreatorHeaderDelegate extends SliverPersistentHeaderDelegate {
  final int unreadCount;
  final Color accentColor;
  final String avatarInitial;
  final String subtitle;
  final VoidCallback onNotificationsTap;
  final VoidCallback onChatTap;
  final VoidCallback onAvatarTap;

  _StickyCreatorHeaderDelegate({
    required this.unreadCount,
    this.accentColor = AppColors.primary,
    this.avatarInitial = 'P',
    this.subtitle = 'Creator dashboard',
    required this.onNotificationsTap,
    required this.onChatTap,
    required this.onAvatarTap,
  });

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
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
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: accentColor,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.textPrimary, width: 1.5),
              ),
              child: Center(
                child: Text(
                  avatarInitial,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'CreatorPeep',
                style: AppTypography.headingLarge().copyWith(fontSize: 17, height: 1.1),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const Spacer(),
          // Notification Bell with Red Dot Badge
          GestureDetector(
            onTap: onNotificationsTap,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFECE6DA), width: 1.5),
              ),
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  const Icon(
                    Icons.notifications_none_rounded,
                    color: AppColors.textPrimary,
                    size: 20,
                  ),
                  Positioned(
                    top: 3,
                    right: 3,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Chat Icon with Yellow Dot Badge
          GestureDetector(
            onTap: onChatTap,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFECE6DA), width: 1.5),
              ),
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  const Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: AppColors.textPrimary,
                    size: 18,
                  ),
                  Positioned(
                    top: 3,
                    right: 3,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),
            ),
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
