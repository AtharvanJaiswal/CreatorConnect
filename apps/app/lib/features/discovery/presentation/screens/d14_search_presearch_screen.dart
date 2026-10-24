import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class D14SearchPreSearchScreen extends StatefulWidget {
  final ValueChanged<String> onSelectQuery;

  const D14SearchPreSearchScreen({
    super.key,
    required this.onSelectQuery,
  });

  @override
  State<D14SearchPreSearchScreen> createState() => _D14SearchPreSearchScreenState();
}

class _D14SearchPreSearchScreenState extends State<D14SearchPreSearchScreen> {
  final List<String> _recentSearches = [
    'Sustainable Fashion Mumbai',
    'AI Smartphone Reviewer',
    'UGC Beauty Creator',
    'Bangalore Podcasters',
  ];

  final List<String> _trendingTags = [
    '🔥 Monsoon Fashion',
    '📱 iPhone 16 Reviews',
    '🌿 Vegan Recipes',
    '🎙️ Fintech Podcast',
    '👗 Saree Draping UGC',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: GestureDetector(
          onTap: () {
            Navigator.pop(context);
            widget.onSelectQuery('');
          },
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.textPrimary, width: 1.5),
            ),
            child: const Row(
              children: [
                Icon(Icons.search_rounded, size: 20, color: AppColors.textSecondary),
                SizedBox(width: 8),
                Text(
                  'Search talent, tags, cities...',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Recent Searches Header
            if (_recentSearches.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Recent Searches', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
                  TextButton(
                    onPressed: () => setState(() => _recentSearches.clear()),
                    child: const Text('Clear All', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ..._recentSearches.map((term) {
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.history_rounded, size: 20, color: AppColors.textMuted),
                  title: Text(term, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                  trailing: IconButton(
                    icon: const Icon(Icons.close_rounded, size: 16, color: AppColors.textMuted),
                    onPressed: () => setState(() => _recentSearches.remove(term)),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    widget.onSelectQuery(term);
                  },
                );
              }),
              const SizedBox(height: 24),
            ],

            // Trending Tags
            Text('Trending Tags', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _trendingTags.map((tag) {
                return ActionChip(
                  label: Text(tag),
                  backgroundColor: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                    side: const BorderSide(color: AppColors.border, width: 1.5),
                  ),
                  labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textPrimary),
                  onPressed: () {
                    final cleanQuery = tag.replaceFirst(RegExp(r'^[^\w\s]+'), '').trim();
                    Navigator.pop(context);
                    widget.onSelectQuery(cleanQuery);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            // Category Jump Cards
            Text('Popular Categories', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
            const SizedBox(height: 12),
            Row(
              children: [
                _categoryJumpCard('Fashion', AppColors.primary, Icons.checkroom_rounded),
                const SizedBox(width: 10),
                _categoryJumpCard('Technology', AppColors.accentSky, Icons.devices_rounded),
                const SizedBox(width: 10),
                _categoryJumpCard('Culinary', AppColors.accentMint, Icons.restaurant_rounded),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _categoryJumpCard(String title, Color bg, IconData icon) {
    return Expanded(
      child: InkWell(
        onTap: () {
          Navigator.pop(context);
          widget.onSelectQuery(title);
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.textPrimary, width: 1.5),
          ),
          child: Column(
            children: [
              Icon(icon, size: 24, color: AppColors.textPrimary),
              const SizedBox(height: 6),
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: AppColors.textPrimary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
