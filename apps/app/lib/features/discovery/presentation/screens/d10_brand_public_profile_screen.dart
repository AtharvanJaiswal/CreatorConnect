import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';
import '../bottom_sheets/d11_profile_more_options_sheet.dart';
import 'd09_creator_public_profile_screen.dart';
import '../../../../core/widgets/safe_image.dart';

class D10BrandPublicProfileScreen extends ConsumerWidget {
  final String brandId;
  final VoidCallback? onBack;

  const D10BrandPublicProfileScreen({
    super.key,
    required this.brandId,
    this.onBack,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(publicProfileProvider(brandId));

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: profileAsync.when(
        data: (profile) {
          if (profile.role.toUpperCase() != 'BRAND') {
            return D09CreatorPublicProfileScreen(profileId: brandId, onBack: onBack);
          }
          return _buildBrandProfileBody(context, ref, profile);
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.textPrimary)),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
    );
  }

  Widget _buildBrandProfileBody(BuildContext context, WidgetRef ref, PublicProfileModel profile) {
    return Column(
      children: [
        Expanded(
          child: CustomScrollView(
            slivers: [
              // Dark Cover Banner
              SliverAppBar(
                expandedHeight: 200,
                pinned: true,
                backgroundColor: const Color(0xFF14110F),
                leading: CircleAvatar(
                  backgroundColor: Colors.black54,
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                    onPressed: onBack ?? () => Navigator.pop(context),
                  ),
                ),
                actions: [
                  CircleAvatar(
                    backgroundColor: Colors.black54,
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
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.network(profile.coverUrl, fit: BoxFit.cover),
                      Container(color: Colors.black.withOpacity(0.55)),
                      Positioned(
                        bottom: 20,
                        left: 20,
                        right: 20,
                        child: Row(
                          children: [
                            Container(
                              width: 60,
                              height: 60,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                image: safeDecorationImage(profile.avatarUrl),
                              ),
                              child: safeDecorationImage(profile.avatarUrl) == null
                                  ? const Center(
                                      child: Icon(Icons.business_rounded, color: AppColors.textSecondary, size: 28),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        profile.name,
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
                                      ),
                                      const SizedBox(width: 6),
                                      const Icon(Icons.verified_rounded, size: 16, color: Color(0xFF2E7CF6)),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${profile.handle} • ${profile.city}',
                                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Overview Section
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Campaign Stats Strip
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.border, width: 1.5),
                        ),
                        child: Row(
                          children: [
                            _statBox('${profile.collabsCompleted}', 'CAMPAIGNS'),
                            _divider(),
                            _statBox(profile.followersCount, 'COMMUNITY'),
                            _divider(),
                            _statBox('${profile.rating} ⭐', 'RATING'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Brand Bio
                      Text('About the Brand', style: AppTypography.headingMedium().copyWith(fontSize: 15)),
                      const SizedBox(height: 6),
                      Text(
                        profile.bio,
                        style: AppTypography.bodyMedium().copyWith(fontSize: 13, height: 1.45),
                      ),
                      const SizedBox(height: 24),

                      // Active Collaboration Briefs Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Open Collaboration Briefs', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              '${profile.activeBriefs.length} Active',
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Briefs List
                      ...profile.activeBriefs.map((brief) {
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
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
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFF9E6),
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: const Color(0xFFFFE486)),
                                    ),
                                    child: Text(
                                      brief.deadline,
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF8C6A0A)),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                brief.deliverableType,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '${brief.currency}${brief.budget}',
                                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: AppColors.textPrimary),
                                  ),
                                  ElevatedButton(
                                    onPressed: () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Pitched for "${brief.title}"!')),
                                      );
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: AppColors.textPrimary,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      minimumSize: const Size(0, 34),
                                    ),
                                    child: const Text('Apply Brief →', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // Sticky Bottom Bar: Message & Follow Brand
        Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border, width: 1)),
          ),
          child: Row(
            children: [
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
                  child: const Text('Message Brand', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Now following ${profile.name}! You will receive alerts on new briefs.')),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.textPrimary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Follow Brand', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _statBox(String val, String lbl) {
    return Expanded(
      child: Column(
        children: [
          Text(val, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
          const SizedBox(height: 2),
          Text(lbl, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
        ],
      ),
    );
  }

  Widget _divider() {
    return Container(width: 1, height: 24, color: AppColors.border);
  }
}
