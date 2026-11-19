import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/dashboard_category_config.dart';
import '../widgets/dashboard_category_strip.dart';

class D03EmptyHomeScreen extends StatelessWidget {
  final VoidCallback onContinueProfileSetup;
  final VoidCallback onExploreDiscovery;
  final int completionPercentage;
  final String roleKey;
  final List<String> selectedCategories;
  final VoidCallback? onPickCategories;

  const D03EmptyHomeScreen({
    super.key,
    required this.onContinueProfileSetup,
    required this.onExploreDiscovery,
    this.completionPercentage = 40,
    this.roleKey = 'EMPTY',
    this.selectedCategories = const [],
    this.onPickCategories,
  });

  @override
  Widget build(BuildContext context) {
    final safePct = completionPercentage.clamp(0, 100);
    final persona = DashboardCategoryCatalog.personaForRole(roleKey);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DashboardRoleBadge(persona: persona),
              const SizedBox(height: 12),
              Text('Welcome to CreatorPeep 👋', style: AppTypography.displayLarge().copyWith(fontSize: 24)),
              const SizedBox(height: 6),
              Text(
                'Complete your profile setup to unlock direct collaborations and briefs.',
                style: AppTypography.bodyMedium().copyWith(fontSize: 13),
              ),
              const SizedBox(height: 24),

              // Dynamic Completion Card
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
                            value: safePct / 100.0,
                            strokeWidth: 6,
                            backgroundColor: AppColors.backgroundSecondary,
                            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                          ),
                        ),
                        Text(
                          '$safePct%',
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                        ),
                      ],
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Your profile is $safePct% complete',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
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
              const SizedBox(height: 16),

              // 4-Step Gamified Onboarding Checklist (Master Audit §2.3)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.border, width: 1.5),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Onboarding Checklist',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE6F4EC),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            'Step 2 of 4',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.success),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _checklistItem(title: 'Basic bio & location', isCompleted: true, points: 'Done'),
                    _checklistItem(title: 'Connect verified social handles', isCompleted: false, points: '+25%'),
                    _checklistItem(title: 'Upload 1st portfolio sample', isCompleted: false, points: '+25%'),
                    _checklistItem(title: 'Set rates & commercial card', isCompleted: false, points: '+10%'),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              if (selectedCategories.isNotEmpty) ...[
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: selectedCategories
                      .map(
                        (cat) => Chip(
                          label: Text(cat, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          backgroundColor: AppColors.surface,
                          side: const BorderSide(color: AppColors.border),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 20),
              ],

              // Dashed Empty Recommendation Card
              Text('Recommended Collaborators', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
              const SizedBox(height: 10),
              _buildDashedEmptyCard(
                icon: Icons.people_outline_rounded,
                title: 'No recommendations yet',
                subtitle: 'Once you select your primary niche and location, matched creators will appear here.',
                buttonText: 'Set Preferences',
                onAction: onPickCategories ?? onContinueProfileSetup,
              ),
              const SizedBox(height: 24),

              // Dashed Empty Opportunities Card
              Text('Collabs & Opportunities Nearby', style: AppTypography.headingLarge().copyWith(fontSize: 16)),
              const SizedBox(height: 10),
              _buildDashedEmptyCard(
                icon: Icons.work_outline_rounded,
                title: 'No collab calls in your inbox',
                subtitle: 'Browse verified creators & podcasters and pitch collaborations via Discovery.',
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

  Widget _checklistItem({
    required String title,
    required bool isCompleted,
    required String points,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: isCompleted ? AppColors.success : Colors.transparent,
              shape: BoxShape.circle,
              border: Border.all(
                color: isCompleted ? AppColors.success : AppColors.border,
                width: 1.5,
              ),
            ),
            child: isCompleted
                ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isCompleted ? FontWeight.w600 : FontWeight.w500,
                color: isCompleted ? AppColors.textPrimary : AppColors.textSecondary,
                decoration: isCompleted ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          Text(
            points,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: isCompleted ? AppColors.success : const Color(0xFFC98A16),
            ),
          ),
        ],
      ),
    );
  }
}
