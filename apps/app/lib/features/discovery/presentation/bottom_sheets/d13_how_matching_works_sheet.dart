import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class D13HowMatchingWorksSheet extends StatelessWidget {
  const D13HowMatchingWorksSheet({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => const D13HowMatchingWorksSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.backgroundPrimary,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(22, 16, 22, 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.hub_rounded, size: 20, color: AppColors.textPrimary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'How Matching Works',
                  style: AppTypography.headingLarge().copyWith(fontSize: 18),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Under our verified collaboration charter (SOW §13), recommendations are 100% deterministic and rule-based to ensure transparent, unbiased creator discovery.',
            style: AppTypography.bodyMedium().copyWith(fontSize: 12.5),
          ),
          const SizedBox(height: 20),

          // Pillar 1
          _buildPillar(
            number: '1',
            title: 'Niche & Category Overlap',
            description:
                'We cross-reference creator tags against brand brief requirements (e.g. Sustainable Fashion, Tech UGC) for direct thematic compatibility.',
          ),
          const SizedBox(height: 14),

          // Pillar 2
          _buildPillar(
            number: '2',
            title: 'Geographic Proximity',
            description:
                'Prioritizes creators located in your regional hub (e.g. Mumbai MMR, Delhi NCR) for on-ground shoots and in-person events without travel logistics.',
          ),
          const SizedBox(height: 14),

          // Pillar 3
          _buildPillar(
            number: '3',
            title: 'Rating & Response Track Record',
            description:
                'Highlights creators with 4.8+ ratings, verified identity badges, and active responsive messaging history.',
          ),
          const SizedBox(height: 20),

          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, size: 18, color: AppColors.textSecondary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'No opaque AI algorithms or paid-promotion ranking. Every match badge shows the exact rule matched.',
                    style: AppTypography.bodyMedium().copyWith(fontSize: 11.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              child: const Text('Got it', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPillar({
    required String number,
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            color: AppColors.textPrimary,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            number,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
              const SizedBox(height: 3),
              Text(description, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4)),
            ],
          ),
        ),
      ],
    );
  }
}
