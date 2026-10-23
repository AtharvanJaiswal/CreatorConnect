import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/campaign_controllers.dart';
import '../widgets/brief_card_widget.dart';

class E12SavedBriefsScreen extends ConsumerWidget {
  const E12SavedBriefsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedBriefs = ref.watch(savedBriefsProvider);
    final notifier = ref.read(savedBriefsProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Saved Opportunities',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: savedBriefs.isEmpty
            ? const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.bookmark_border_rounded, size: 52, color: AppColors.textMuted),
                    SizedBox(height: 12),
                    Text('No saved briefs yet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    SizedBox(height: 6),
                    Text('Bookmark opportunities from the discovery feed to review them later.', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  ],
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: savedBriefs.length,
                itemBuilder: (context, idx) {
                  final brief = savedBriefs[idx];
                  return BriefCardWidget(
                    brief: brief,
                    showBrandView: false,
                    onTap: () {
                      Navigator.pushNamed(context, '/campaigns/brief-detail', arguments: brief.id);
                    },
                    onBookmark: () => notifier.toggleBookmark(brief),
                  );
                },
              ),
      ),
    );
  }
}
