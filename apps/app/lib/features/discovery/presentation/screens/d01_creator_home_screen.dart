import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';
import '../bottom_sheets/d15_profile_quick_view_sheet.dart';
import '../dialogs/pop_dialogs.dart';
import '../widgets/d16_connect_sent_overlay.dart';

class D01CreatorHomeScreen extends ConsumerWidget {
  final VoidCallback onNavigateToNotifications;
  final VoidCallback onNavigateToChat;
  final ValueChanged<String> onOpenProfile;
  final ValueChanged<String> onApplyOpportunity;

  const D01CreatorHomeScreen({
    super.key,
    required this.onNavigateToNotifications,
    required this.onNavigateToChat,
    required this.onOpenProfile,
    required this.onApplyOpportunity,
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
            await ref.read(homeDashboardProvider.notifier).loadDashboard('CREATOR');
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // 1. Sticky Header
              SliverPersistentHeader(
                pinned: true,
                delegate: _StickyCreatorHeaderDelegate(
                  unreadCount: unreadCount,
                  onNotificationsTap: onNavigateToNotifications,
                  onChatTap: onNavigateToChat,
                  onAvatarTap: () => onOpenProfile('self'),
                ),
              ),

              // 2. Greeting & Alert Banner
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        state.greeting,
                        style: AppTypography.displayLarge().copyWith(fontSize: 24),
                      ),
                      const SizedBox(height: 12),

                      // Application Review Alert Card
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
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.campaign_rounded, size: 20, color: AppColors.textPrimary),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    '1 New Brief Match Nearby',
                                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Urban Vogue matches your Mumbai fashion rates.',
                                    style: AppTypography.bodyMedium().copyWith(fontSize: 11.5),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton(
                              onPressed: () => onApplyOpportunity('opp-01'),
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
                        value: (state.stats['profileViews'] ?? '0').toString(),
                        label: 'PROFILE VIEWS',
                        subtext: 'Real-time',
                        subtextColor: AppColors.success,
                      ),
                      const SizedBox(width: 8),
                      _buildStatCard(
                        value: (state.stats['avgRating'] ?? '5.0 ⭐').toString(),
                        label: 'AVG RATING',
                        subtext: 'Verified score',
                        subtextColor: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 8),
                      _buildStatCard(
                        value: (state.stats['openBriefs'] ?? state.stats['openBriefsCount'] ?? state.nearbyOpportunities.length).toString(),
                        label: 'OPEN BRIEFS',
                        subtext: 'Apply today',
                        subtextColor: const Color(0xFFC98A16),
                      ),
                    ],
                  ),
                ),
              ),

              // 4. "Recommended for You" Horizontal Carousel
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text('Recommended for You', style: AppTypography.headingLarge().copyWith(fontSize: 17)),
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
                child: SizedBox(
                  height: 205,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    scrollDirection: Axis.horizontal,
                    itemCount: state.recommendedProfiles.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, idx) {
                      final item = state.recommendedProfiles[idx];
                      return _buildCarouselProfileCard(
                        context: context,
                        ref: ref,
                        profile: item,
                        remainingQuota: remainingQuota,
                        onOpenProfile: onOpenProfile,
                      );
                    },
                  ),
                ),
              ),

              // 5. "Opportunities Near You" Vertical List
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Opportunities Near You', style: AppTypography.headingLarge().copyWith(fontSize: 17)),
                      InkWell(
                        onTap: () => PopDialogs.showLocationPrimer(context),
                        child: const Row(
                          children: [
                            Icon(Icons.near_me_outlined, size: 14, color: AppColors.textSecondary),
                            SizedBox(width: 4),
                            Text('Mumbai MMR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, idx) {
                      final opp = state.nearbyOpportunities[idx];
                      return _buildOpportunityCard(opp, onApplyOpportunity);
                    },
                    childCount: state.nearbyOpportunities.length,
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

  Widget _buildStatCard({
    required String value,
    required String label,
    required String subtext,
    required Color subtextColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
            const SizedBox(height: 3),
            Text(subtext, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: subtextColor)),
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
                  backgroundImage: NetworkImage(profile.avatarUrl),
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
                profile.niche,
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
                backgroundImage: NetworkImage(opp.brandLogo),
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
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                '${opp.currency}${opp.budget}',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppColors.textPrimary),
              ),
              const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
              Text(
                opp.location,
                style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
              const Spacer(),
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
                child: const Text('Apply Now', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StickyCreatorHeaderDelegate extends SliverPersistentHeaderDelegate {
  final int unreadCount;
  final VoidCallback onNotificationsTap;
  final VoidCallback onChatTap;
  final VoidCallback onAvatarTap;

  _StickyCreatorHeaderDelegate({
    required this.unreadCount,
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
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: const CircleAvatar(
                radius: 17,
                backgroundImage: NetworkImage('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'),
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
    return oldDelegate.unreadCount != unreadCount;
  }
}
