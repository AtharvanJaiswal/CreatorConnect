import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class D03EmptyHomeScreen extends StatelessWidget {
  final VoidCallback onContinueProfileSetup;
  final VoidCallback onExploreDiscovery;

  const D03EmptyHomeScreen({
    super.key,
    required this.onContinueProfileSetup,
    required this.onExploreDiscovery,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Welcome to CreatorConnect 👋', style: AppTypography.displayLarge().copyWith(fontSize: 24)),
              const SizedBox(height: 6),
              Text(
                'Complete your profile setup to unlock direct collaborations and briefs.',
                style: AppTypography.bodyMedium().copyWith(fontSize: 13),
              ),
              const SizedBox(height: 24),

              // 40% Completion Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: AppColors.border, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 64,
                          height: 64,
                          child: CircularProgressIndicator(
                            value: 0.40,
                            strokeWidth: 6,
                            backgroundColor: AppColors.backgroundSecondary,
                            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                          ),
                        ),
                        const Text(
                          '40%',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                        ),
                      ],
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Your profile is 40% complete',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Add your commercial rates and social handles to show up in brand searches.',
                            style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: onContinueProfileSetup,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: AppColors.textPrimary,
                              elevation: 0,
                              minimumSize: const Size(0, 34),
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                            ),
                            child: const Text('Continue Profile Setup →', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Dashed Empty Recommendation Card
              Text('Recommended Collaborators', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
              const SizedBox(height: 10),
              _buildDashedEmptyCard(
                icon: Icons.people_outline_rounded,
                title: 'No recommendations yet',
                subtitle: 'Once you select your primary niche and location, matched creators will appear here.',
                buttonText: 'Set Preferences',
                onAction: onContinueProfileSetup,
              ),
              const SizedBox(height: 24),

              // Dashed Empty Opportunities Card
              Text('Nearby Opportunities', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
              const SizedBox(height: 10),
              _buildDashedEmptyCard(
                icon: Icons.work_outline_rounded,
                title: 'No open briefs in your inbox',
                subtitle: 'Browse all brand campaigns and pitch directly via Discovery.',
                buttonText: 'Explore Discover →',
                onAction: onExploreDiscovery,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDashedEmptyCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required String buttonText,
    required VoidCallback onAction,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.backgroundSecondary.withOpacity(0.5),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: AppColors.border,
          width: 1.5,
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.textSecondary, size: 24),
          ),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 4),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: onAction,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.textPrimary,
              side: const BorderSide(color: AppColors.textPrimary, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              minimumSize: const Size(0, 36),
            ),
            child: Text(buttonText, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
