import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';
import '../widgets/profile_discovery_card.dart';
import '../bottom_sheets/d07_filter_bottom_sheet.dart';
import '../bottom_sheets/d15_profile_quick_view_sheet.dart';
import '../dialogs/pop_dialogs.dart';
import '../widgets/d16_connect_sent_overlay.dart';

class D06SearchResultsScreen extends ConsumerStatefulWidget {
  final String? initialQuery;
  final ValueChanged<String> onOpenProfile;

  const D06SearchResultsScreen({
    super.key,
    this.initialQuery,
    required this.onOpenProfile,
  });

  @override
  ConsumerState<D06SearchResultsScreen> createState() => _D06SearchResultsScreenState();
}

class _D06SearchResultsScreenState extends ConsumerState<D06SearchResultsScreen> {
  late TextEditingController _searchController;
  bool _showAutocomplete = false;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: widget.initialQuery ?? '');
    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(discoveryFeedProvider.notifier).searchWithDebounce(widget.initialQuery!);
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filterState = ref.watch(filterStateProvider);
    final feedAsync = ref.watch(discoveryFeedProvider);
    final autocompleteList = ref.watch(autocompleteProvider);
    final remainingQuota = ref.watch(connectionQuotaProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: Column(
          children: [
            // Header: Back Button + Search Input + Clear Button + Filter Trigger
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 16, 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Expanded(
                    child: Container(
                      height: 48,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: AppColors.textPrimary, width: 1.5),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.search_rounded, size: 20, color: AppColors.textSecondary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              autofocus: widget.initialQuery == null,
                              decoration: const InputDecoration(
                                hintText: 'Search creators, niches, or cities...',
                                hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 13),
                                border: InputBorder.none,
                                isDense: true,
                              ),
                              onChanged: (text) {
                                setState(() {
                                  _showAutocomplete = text.trim().isNotEmpty;
                                });
                                ref.read(autocompleteProvider.notifier).onQueryChanged(text);
                                ref.read(discoveryFeedProvider.notifier).searchWithDebounce(text);
                              },
                              onSubmitted: (text) {
                                setState(() => _showAutocomplete = false);
                                ref.read(discoveryFeedProvider.notifier).searchWithDebounce(text);
                              },
                            ),
                          ),
                          if (_searchController.text.isNotEmpty)
                            GestureDetector(
                              onTap: () {
                                _searchController.clear();
                                setState(() => _showAutocomplete = false);
                                ref.read(autocompleteProvider.notifier).clear();
                                ref.read(discoveryFeedProvider.notifier).searchWithDebounce('');
                              },
                              child: const Icon(Icons.close_rounded, size: 18, color: AppColors.textSecondary),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        const Icon(Icons.tune_rounded, color: AppColors.textPrimary),
                        if (filterState.activeFilterCount > 0)
                          Positioned(
                            top: -2,
                            right: -2,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                              child: Text(
                                '${filterState.activeFilterCount}',
                                style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900),
                              ),
                            ),
                          ),
                      ],
                    ),
                    onPressed: () => D07FilterBottomSheet.show(context),
                  ),
                ],
              ),
            ),

            // Active Dismissible Filter Chips Row
            _buildActiveFilterChips(filterState),

            // Main Content Area with Autocomplete Overlay support
            Expanded(
              child: Stack(
                children: [
                  // Results List
                  feedAsync.when(
                    data: (profiles) {
                      if (profiles.isEmpty) {
                        return _buildEmptyResultsState();
                      }
                      return ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        itemCount: profiles.length,
                        itemBuilder: (context, idx) {
                          final profile = profiles[idx];
                          return ProfileDiscoveryCard(
                            profile: profile,
                            onTap: () => widget.onOpenProfile(profile.id),
                            onLongPress: () {
                              D15ProfileQuickViewSheet.show(
                                context,
                                profile: profile,
                                onViewFullProfile: () => widget.onOpenProfile(profile.id),
                                onConnect: () => _handleConnect(profile, remainingQuota),
                              );
                            },
                            onConnect: () => _handleConnect(profile, remainingQuota),
                          );
                        },
                      );
                    },
                    loading: () => const Center(
                      child: CircularProgressIndicator(color: AppColors.textPrimary),
                    ),
                    error: (err, _) => Center(
                      child: Text('Error: $err'),
                    ),
                  ),

                  // Autocomplete Dropdown Overlay
                  if (_showAutocomplete && autocompleteList.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 20),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.border, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.12),
                            blurRadius: 16,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: autocompleteList.length,
                        separatorBuilder: (_, __) => const Divider(color: AppColors.border, height: 1),
                        itemBuilder: (context, idx) {
                          final suggestion = autocompleteList[idx];
                          return ListTile(
                            leading: Text(suggestion.icon ?? '🔍', style: const TextStyle(fontSize: 16)),
                            title: Text(suggestion.text, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.backgroundSecondary,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                suggestion.category,
                                style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                              ),
                            ),
                            onTap: () {
                              _searchController.text = suggestion.text;
                              setState(() => _showAutocomplete = false);
                              ref.read(discoveryFeedProvider.notifier).searchWithDebounce(suggestion.text);
                            },
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveFilterChips(FilterState filterState) {
    final chips = <Widget>[];

    for (final cat in filterState.categories) {
      chips.add(
        _filterChip(
          label: '$cat ✕',
          onTap: () => ref.read(filterStateProvider.notifier).toggleCategory(cat),
        ),
      );
    }

    if (filterState.city != null) {
      chips.add(
        _filterChip(
          label: '${filterState.city} ✕',
          onTap: () => ref.read(filterStateProvider.notifier).setCity(null),
        ),
      );
    }

    if (filterState.verifiedOnly) {
      chips.add(
        _filterChip(
          label: 'Verified ✕',
          onTap: () => ref.read(filterStateProvider.notifier).toggleVerifiedOnly(),
        ),
      );
    }

    if (chips.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 38,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        scrollDirection: Axis.horizontal,
        children: chips,
      ),
    );
  }

  Widget _filterChip({required String label, required VoidCallback onTap}) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.textPrimary,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyResultsState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off_rounded, size: 56, color: AppColors.textMuted),
            const SizedBox(height: 16),
            Text('No matching creators found', style: AppTypography.headingLarge().copyWith(fontSize: 18)),
            const SizedBox(height: 8),
            const Text(
              'Try adjusting your price range, widening your search city, or removing niche filters.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                _searchController.clear();
                ref.read(filterStateProvider.notifier).reset();
                ref.read(discoveryFeedProvider.notifier).searchWithDebounce('');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              child: const Text('Clear All Filters & Reset', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }

  void _handleConnect(ProfileCardModel profile, int remainingQuota) async {
    if (remainingQuota <= 0) {
      PopDialogs.showQuotaPaywall(context);
      return;
    }

    final success = await ref.read(connectionQuotaProvider.notifier).requestConnection(profile.id);
    if (success && mounted) {
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
