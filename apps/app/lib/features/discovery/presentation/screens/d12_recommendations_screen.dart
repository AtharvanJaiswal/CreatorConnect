import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';
import '../widgets/profile_discovery_card.dart';
import '../bottom_sheets/d13_how_matching_works_sheet.dart';
import '../bottom_sheets/d15_profile_quick_view_sheet.dart';
import '../dialogs/pop_dialogs.dart';
import '../widgets/d16_connect_sent_overlay.dart';

class D12RecommendationsScreen extends ConsumerWidget {
  final ValueChanged<String> onOpenProfile;

  const D12RecommendationsScreen({
    super.key,
    required this.onOpenProfile,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recsAsync = ref.watch(recommendationsProvider);
    final remainingQuota = ref.watch(connectionQuotaProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Recommended For You', style: AppTypography.headingLarge().copyWith(fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline_rounded, color: AppColors.textPrimary),
            onPressed: () => D13HowMatchingWorksSheet.show(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Info Banner with "How Matching Works" link
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9E6),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFFE486)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.hub_rounded, size: 20, color: Color(0xFFC98A16)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Matches computed using SOW §13 deterministic rules (niche overlap, location proximity, & verified reviews).',
                      style: AppTypography.bodyMedium().copyWith(fontSize: 11.5),
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: () => D13HowMatchingWorksSheet.show(context),
                    child: const Text(
                      'Learn →',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF8C6A0A)),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Recommendations List
          Expanded(
            child: recsAsync.when(
              data: (profiles) {
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  itemCount: profiles.length,
                  itemBuilder: (context, idx) {
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
                );
              },
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.textPrimary)),
              error: (err, _) => Center(child: Text('Error: $err')),
            ),
          ),
        ],
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
