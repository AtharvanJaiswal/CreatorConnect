import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';
import '../widgets/category_grid_card.dart';
import '../widgets/profile_discovery_card.dart';
import '../bottom_sheets/d07_filter_bottom_sheet.dart';
import '../bottom_sheets/d08_sort_bottom_sheet.dart';
import '../bottom_sheets/d15_profile_quick_view_sheet.dart';
import '../dialogs/pop_dialogs.dart';
import '../widgets/d16_connect_sent_overlay.dart';

class D05DiscoverHomeScreen extends ConsumerWidget {
  final ValueChanged<String> onOpenProfile;
  final VoidCallback onOpenSearch;

  const D05DiscoverHomeScreen({
    super.key,
    required this.onOpenProfile,
    required this.onOpenSearch,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filterState = ref.watch(filterStateProvider);
    final feedAsync = ref.watch(discoveryFeedProvider);
    final remainingQuota = ref.watch(connectionQuotaProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.textPrimary,
          backgroundColor: AppColors.primary,
          onRefresh: () async {
            await ref.read(discoveryFeedProvider.notifier).fetchFeed();
          },
          child: CustomScrollView(
            slivers: [
              // Search Bar Header with Filter Funnel Trigger
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: onOpenSearch,
                          child: Container(
                            height: 48,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppColors.border, width: 1.5),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.search_rounded, color: AppColors.textMuted, size: 22),
                                SizedBox(width: 10),
                                Text(
                                  'Search creators, niches, or cities...',
                                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Filter Funnel Button with active badge
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            height: 48,
                            width: 48,
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.border, width: 1.5),
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.tune_rounded, color: AppColors.textPrimary, size: 20),
                              onPressed: () => D07FilterBottomSheet.show(context),
                            ),
                          ),
                          if (filterState.activeFilterCount > 0)
                            Positioned(
                              top: 0,
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(5),
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                                child: Text(
                                  '${filterState.activeFilterCount}',
                                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 9),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Role Toggle Tabs
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 38,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    scrollDirection: Axis.horizontal,
                    children: DiscoveryRole.values.map((role) {
                      final isSelected = filterState.role == role;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(role.displayName),
                          selected: isSelected,
                          onSelected: (_) {
                            ref.read(filterStateProvider.notifier).setRole(role);
                          },
                          selectedColor: AppColors.textPrimary,
                          backgroundColor: AppColors.surface,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                            side: BorderSide(color: isSelected ? AppColors.textPrimary : AppColors.border),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),

              // 2×2 Pastel Category Cards with Icons
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Explore Categories', style: AppTypography.headingLarge().copyWith(fontSize: 17)),
                      const SizedBox(height: 12),
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: 1.9,
                        children: [
                          CategoryGridCard(
                            title: 'Fashion & Styling',
                            subtitle: '1.2K Creators',
                            backgroundColor: AppColors.primary,
                            icon: Icons.checkroom_rounded,
                            onTap: () {
                              ref.read(filterStateProvider.notifier).toggleCategory('Fashion & Styling');
                            },
                          ),
                          CategoryGridCard(
                            title: 'Tech & AI Gadgets',
                            subtitle: '840 Creators',
                            backgroundColor: AppColors.accentSky,
                            icon: Icons.devices_rounded,
                            onTap: () {
                              ref.read(filterStateProvider.notifier).toggleCategory('Tech & Gadgets');
                            },
                          ),
                          CategoryGridCard(
                            title: 'Food & Culinary',
                            subtitle: '910 Creators',
                            backgroundColor: AppColors.accentMint,
                            icon: Icons.restaurant_rounded,
                            onTap: () {
                              ref.read(filterStateProvider.notifier).toggleCategory('Food & Culinary');
                            },
                          ),
                          CategoryGridCard(
                            title: 'Home & Lifestyle',
                            subtitle: '620 Creators',
                            backgroundColor: AppColors.accentPeach,
                            icon: Icons.chair_rounded,
                            onTap: () {
                              ref.read(filterStateProvider.notifier).toggleCategory('Travel & Lifestyle');
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Feed Header with Sort Trigger
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Verified Talent Feed', style: AppTypography.headingLarge().copyWith(fontSize: 17)),
                      InkWell(
                        onTap: () async {
                          final selected = await D08SortBottomSheet.show(context, filterState.sortOption);
                          if (selected != null) {
                            ref.read(filterStateProvider.notifier).setSortOption(selected);
                          }
                        },
                        child: Row(
                          children: [
                            const Icon(Icons.sort_rounded, size: 16, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(
                              filterState.sortOption == 'relevance' ? 'Sort: Relevance' : 'Sorted',
                              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Feed List
              feedAsync.when(
                data: (profiles) {
                  if (profiles.isEmpty) {
                    return SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(40),
                        child: Center(
                          child: Column(
                            children: [
                              const Icon(Icons.search_off_rounded, size: 48, color: AppColors.textMuted),
                              const SizedBox(height: 12),
                              const Text('No profiles match your filters', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                              const SizedBox(height: 10),
                              ElevatedButton(
                                onPressed: () => ref.read(filterStateProvider.notifier).reset(),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.textPrimary,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                ),
                                child: const Text('Reset Filters'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }

                  return SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, idx) {
                          final profile = profiles[idx];
                          return ProfileDiscoveryCard(
                            profile: profile,
                            onTap: () => onOpenProfile(profile.id),
                            onLongPress: () {
                              D15ProfileQuickViewSheet.show(
                                context,
                                profile: profile,
                                onViewFullProfile: () => onOpenProfile(profile.id),
                                onConnect: () => _handleConnect(context, ref, profile, remainingQuota),
                              );
                            },
                            onConnect: () => _handleConnect(context, ref, profile, remainingQuota),
                          );
                        },
                        childCount: profiles.length,
                      ),
                    ),
                  );
                },
                loading: () => const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: CircularProgressIndicator(color: AppColors.textPrimary)),
                  ),
                ),
                error: (err, _) => SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(40),
                    child: Center(child: Text('Error loading feed: $err')),
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
}
