import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';
import '../bottom_sheets/d11_profile_more_options_sheet.dart';
import '../dialogs/pop_dialogs.dart';
import '../widgets/d16_connect_sent_overlay.dart';
import 'd10_brand_public_profile_screen.dart';
import '../../../../core/widgets/safe_image.dart';

class D09CreatorPublicProfileScreen extends ConsumerWidget {
  final String profileId;
  final VoidCallback? onBack;

  const D09CreatorPublicProfileScreen({
    super.key,
    required this.profileId,
    this.onBack,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(publicProfileProvider(profileId));
    final remainingQuota = ref.watch(connectionQuotaProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: profileAsync.when(
        data: (profile) {
          if (profile.role.toUpperCase() == 'BRAND') {
            return D10BrandPublicProfileScreen(brandId: profileId, onBack: onBack);
          }
          return _buildProfileBody(context, ref, profile, remainingQuota);
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.textPrimary)),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Error loading profile: $err'),
              ElevatedButton(
                onPressed: () => ref.refresh(publicProfileProvider(profileId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileBody(
    BuildContext context,
    WidgetRef ref,
    PublicProfileModel profile,
    int remainingQuota,
  ) {
    return Column(
      children: [
        Expanded(
          child: CustomScrollView(
            slivers: [
              // Cover Banner with Back & More Options Buttons
              SliverAppBar(
                expandedHeight: 180,
                pinned: true,
                backgroundColor: AppColors.textPrimary,
                leading: CircleAvatar(
                  backgroundColor: Colors.black45,
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                    onPressed: onBack ?? () => Navigator.pop(context),
                  ),
                ),
                actions: [
                  CircleAvatar(
                    backgroundColor: Colors.black45,
                    child: IconButton(
                      icon: const Icon(Icons.more_horiz_rounded, color: Colors.white),
                      onPressed: () {
                        D11ProfileMoreOptionsSheet.show(
                          context,
                          userName: profile.name,
                          userHandle: profile.handle,
                          userId: profile.userId,
                          onUserBlocked: () {
                            ref.read(moduleDDataSourceProvider).blockUser(profile.userId);
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Blocked ${profile.name}. Removed from feed.')),
                            );
                          },
                          onUserReported: (reason) {
                            ref.read(moduleDDataSourceProvider).reportUser(
                                  profile.userId,
                                  reason,
                                  'Reported for $reason via profile options',
                                );
                          },
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Image.network(
                    profile.coverUrl,
                    fit: BoxFit.cover,
                  ),
                ),
              ),

              // Profile Overview: Overlapping 72px Avatar + Name + Badges
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Transform.translate(
                        offset: const Offset(0, -36),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Container(
                              width: 76,
                              height: 76,
                              decoration: BoxDecoration(
                                color: AppColors.surfacePure,
                                shape: BoxShape.circle,
                                border: Border.all(color: AppColors.backgroundPrimary, width: 4),
                                image: safeDecorationImage(profile.avatarUrl),
                              ),
                              child: safeDecorationImage(profile.avatarUrl) == null
                                  ? Center(
                                      child: Text(
                                        profile.name.isNotEmpty ? profile.name[0] : 'U',
                                        style: const TextStyle(
                                          fontSize: 26,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    )
                                  : null,
                            ),
                            const Spacer(),
                            if (profile.isVerified)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE6F4EC),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: AppColors.success.withOpacity(0.5)),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.check_circle_rounded, size: 14, color: AppColors.success),
                                    SizedBox(width: 4),
                                    Text(
                                      'Verified Creator ✓',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.success),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),

                      Transform.translate(
                        offset: const Offset(0, -20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(profile.name, style: AppTypography.headingLarge().copyWith(fontSize: 22)),
                            const SizedBox(height: 2),
                            Text(
                              '${profile.handle} • ${profile.city}, ${profile.state}',
                              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 16),

                            // 4-Metric Strip
                            Container(
                              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: AppColors.border, width: 1.5),
                              ),
                              child: Row(
                                children: [
                                  _metricItem(profile.followersCount, 'FOLLOWERS'),
                                  _verticalDivider(),
                                  _metricItem('${profile.rating} ⭐', '${profile.reviewCount} REVIEWS'),
                                  _verticalDivider(),
                                  _metricItem('${profile.collabsCompleted}', 'COLLABS'),
                                  _verticalDivider(),
                                  _metricItem(profile.ratePerDeliverable, 'STARTING'),
                                ],
                              ),
                            ),
                            const SizedBox(height: 18),

                            // Bio
                            Text('About', style: AppTypography.headingMedium().copyWith(fontSize: 15)),
                            const SizedBox(height: 6),
                            Text(
                              profile.bio,
                              style: AppTypography.bodyMedium().copyWith(fontSize: 13, height: 1.45),
                            ),
                            const SizedBox(height: 16),

                            // Deliverable Tags Wrap
                            Text('Deliverables & Specialties', style: AppTypography.headingMedium().copyWith(fontSize: 15)),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: profile.deliverableTags.map((tag) {
                                return Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.backgroundSecondary,
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Text(tag, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                );
                              }).toList(),
                            ),
                            const SizedBox(height: 20),

                            // Connected Social Links Strip
                            Text('Connected Channels', style: AppTypography.headingMedium().copyWith(fontSize: 15)),
                            const SizedBox(height: 8),
                            ...profile.socialLinks.map((social) {
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.camera_alt_outlined, size: 20, color: AppColors.textPrimary),
                                    const SizedBox(width: 10),
                                    Text(
                                      '@${social['handle']}',
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                    ),
                                    const Spacer(),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: AppColors.backgroundSecondary,
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        '${social['followers']} followers',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                            const SizedBox(height: 20),

                            // Horizontal Portfolio Carousel
                            Text('Portfolio Showcase', style: AppTypography.headingMedium().copyWith(fontSize: 15)),
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 140,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: profile.portfolioItems.length,
                                separatorBuilder: (_, __) => const SizedBox(width: 10),
                                itemBuilder: (context, idx) {
                                  final item = profile.portfolioItems[idx];
                                  return ClipRRect(
                                    borderRadius: BorderRadius.circular(16),
                                    child: Stack(
                                      children: [
                                        Image.network(
                                          item['mediaUrl'] as String,
                                          width: 140,
                                          height: 140,
                                          fit: BoxFit.cover,
                                        ),
                                        Positioned(
                                          bottom: 6,
                                          left: 6,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: Colors.black.withOpacity(0.6),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              '❤️ ${item['likes']}',
                                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 24),

                            // Verified Client Review Snippet
                            if (profile.latestReview != null) ...[
                              Text('Verified Client Review', style: AppTypography.headingMedium().copyWith(fontSize: 15)),
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: AppColors.border, width: 1.5),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          profile.latestReview!['brandName'] as String? ?? 'Client',
                                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                                        ),
                                        const Row(
                                          children: [
                                            Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                                            Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                                            Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                                            Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                                            Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                                          ],
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '"${profile.latestReview!['comment']}"',
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontStyle: FontStyle.italic, height: 1.4),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 32),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // Sticky Bottom Action Bar with Message Outline and Connect Yellow
        Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border, width: 1)),
          ),
          child: Row(
            children: [
            if (profileId == 'self')
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.pushNamed(context, '/profile/completion'),
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              )
            else ...[
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pushNamed(context, '/conversations');
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.textPrimary, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Message', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _handleConnect(context, ref, profile, remainingQuota),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Connect', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                ),
              ),
            ],
            ],
          ),
        ),
      ],
    );
  }

  void _handleConnect(
    BuildContext context,
    WidgetRef ref,
    PublicProfileModel profile,
    int remainingQuota,
  ) async {
    if (remainingQuota <= 0) {
      PopDialogs.showQuotaPaywall(context);
      return;
    }

    final success = await ref.read(connectionQuotaProvider.notifier).requestConnection(profile.userId);
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

  Widget _metricItem(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
        ],
      ),
    );
  }

  Widget _verticalDivider() {
    return Container(
      width: 1,
      height: 24,
      color: AppColors.border,
    );
  }
}
