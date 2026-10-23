import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/step_indicator.dart';
import '../../data/datasources/auth_local_datasource.dart';

import 'account_type_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onNext() {
    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    } else {
      _onComplete();
    }
  }

  void _onSkip() {
    _onComplete();
  }

  void _onComplete() {
    AuthLocalDataSource().setOnboardingCompleted(completed: true);
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const AccountTypeScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(1.0, 0.0),
              end: Offset.zero,
            ).chain(CurveTween(curve: Curves.easeOutCubic)).animate(animation),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 320),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              children: [
                // Top Action Bar with Skip button
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.sm,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      if (_currentPage < 2)
                        TextButton(
                          onPressed: _onSkip,
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.textSecondary,
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                              vertical: AppSpacing.xs,
                            ),
                          ),
                          child: Text(
                            'Skip',
                            style: AppTypography.buttonLarge(
                              color: AppColors.textSecondary,
                            ).copyWith(fontSize: 14),
                          ),
                        )
                      else
                        const SizedBox(height: 36),
                    ],
                  ),
                ),

                // Main PageView with 3 Onboarding Slides
                Expanded(
                  child: PageView(
                    controller: _pageController,
                    onPageChanged: (page) {
                      setState(() {
                        _currentPage = page;
                      });
                    },
                    children: const [
                      _OnboardingValueSlide(),
                      _OnboardingDiscoverySlide(),
                      _OnboardingOpportunitySlide(),
                    ],
                  ),
                ),

                // Bottom Navigation Bar: StepIndicator + Next / Get Started Button
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.xs,
                    AppSpacing.lg,
                    AppSpacing.md,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // Active Step Indicators (capsule + dots)
                          StepIndicator(
                            count: 3,
                            currentIndex: _currentPage,
                          ),

                          // Next / Get Started Pill Button
                          AppButton(
                            text: _currentPage == 2 ? 'Get Started' : 'Next',
                            onPressed: _onNext,
                            variant: AppButtonVariant.primary,
                          ),
                        ],
                      ),
                      if (_currentPage == 2) ...[
                        const SizedBox(height: AppSpacing.xs),
                        TextButton(
                          onPressed: () {
                            AuthLocalDataSource().setOnboardingCompleted(completed: true);
                            Navigator.of(context).pushReplacementNamed('/login');
                          },
                          child: RichText(
                            text: TextSpan(
                              text: 'Already have an account? ',
                              style: AppTypography.bodyMedium(color: AppColors.textSecondary),
                              children: [
                                TextSpan(
                                  text: 'Log in',
                                  style: AppTypography.buttonLarge(
                                    color: AppColors.textPrimary,
                                  ).copyWith(
                                    decoration: TextDecoration.underline,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// SCR-02: Onboarding 1 — Value
/// "Create. Connect. Collaborate."
class _OnboardingValueSlide extends StatelessWidget {
  const _OnboardingValueSlide();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero Illustration Card: Yellow background + floating organic shapes & pen badge
          Expanded(
            flex: 11,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(AppRadii.card),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.card),
                child: Stack(
                  children: [
                    // Top-Left Soft Yellow Arc
                    Positioned(
                      top: -30,
                      left: -20,
                      child: Container(
                        width: 140,
                        height: 140,
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFEA8A),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),

                    // Middle-Right Lilac Circle
                    Positioned(
                      top: 130,
                      right: 90,
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: AppColors.secondary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),

                    // Bottom-Right Pink Rounded Box
                    Positioned(
                      bottom: 30,
                      right: 30,
                      child: Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                    ),

                    // Center Floating White Squircle with Pen Icon
                    Center(
                      child: Transform.rotate(
                        angle: -8 * math.pi / 180,
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x1A000000),
                                blurRadius: 18,
                                offset: Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.edit_outlined,
                              color: AppColors.textPrimary,
                              size: 26,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.xl),

          // Text Content Section
          Expanded(
            flex: 9,
            child: SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                // Headline with Italic Serif Accent on Collaborate
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: 'Create.\nConnect.\n',
                        style: AppTypography.displayLarge(
                          color: AppColors.textPrimary,
                        ).copyWith(
                          fontSize: 32,
                          height: 1.05,
                        ),
                      ),
                      TextSpan(
                        text: 'Collaborate.',
                        style: AppTypography.displayAccent(
                          color: AppColors.textPrimary,
                        ).copyWith(
                          fontSize: 35,
                          height: 1.1,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: AppSpacing.md),

                // Subtitle / Body Description
                Text(
                  'One platform where creators, professionals, podcasters and brands build together.',
                  style: AppTypography.bodyMedium(
                    color: AppColors.textSecondary,
                  ).copyWith(
                    fontSize: 14.5,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
}

/// SCR-03: Onboarding 2 — Discovery
/// "Discover the right collaborators"
class _OnboardingDiscoverySlide extends StatelessWidget {
  const _OnboardingDiscoverySlide();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero Illustration Card: Soft Lilac with overlapping avatars + "Find your people" badge
          Expanded(
            flex: 11,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.secondary,
                borderRadius: BorderRadius.circular(AppRadii.card),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.card),
                child: Stack(
                  children: [
                    // Bottom-Left Lavender Arc
                    Positioned(
                      bottom: -20,
                      left: -20,
                      child: Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          color: const Color(0xFFBAA5EC).withValues(alpha: 0.6),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),

                    // Center Composition: 3 Overlapping Circle Badges + "Find your people"
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // 3 Overlapping Circles with White Borders
                          SizedBox(
                            height: 48,
                            width: 112,
                            child: Stack(
                              children: [
                                // Left Mint Circle
                                Positioned(
                                  left: 0,
                                  child: _buildAvatarCircle(
                                    AppColors.accentMint,
                                  ),
                                ),
                                // Center Yellow Circle
                                Positioned(
                                  left: 32,
                                  child: _buildAvatarCircle(
                                    AppColors.primary,
                                  ),
                                ),
                                // Right Pink Circle
                                Positioned(
                                  left: 64,
                                  child: _buildAvatarCircle(
                                    AppColors.accent,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 24),

                          // Pill Badge: "Find your people"
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 9,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(AppRadii.chip),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x14000000),
                                  blurRadius: 14,
                                  offset: Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Text(
                              'Find your people',
                              style: AppTypography.buttonLarge(
                                color: AppColors.textPrimary,
                              ).copyWith(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.xl),

          // Text Content Section
          Expanded(
            flex: 9,
            child: SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Headline with Italic Serif Accent on "right"
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: 'Discover the\n',
                          style: AppTypography.displayLarge(
                            color: AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 32,
                            height: 1.05,
                          ),
                        ),
                        TextSpan(
                          text: 'right\n',
                          style: AppTypography.displayAccent(
                            color: AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 35,
                            height: 1.05,
                          ),
                        ),
                        TextSpan(
                          text: 'collaborators',
                          style: AppTypography.displayLarge(
                            color: AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 32,
                            height: 1.05,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: AppSpacing.md),

                  // Subtitle / Body Description
                  Text(
                    'Search verified creators and production professionals by skill, category and location.',
                    style: AppTypography.bodyMedium(
                      color: AppColors.textSecondary,
                    ).copyWith(
                      fontSize: 14.5,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarCircle(Color color) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(
          color: AppColors.surface,
          width: 3.0,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x10000000),
            blurRadius: 8,
            offset: Offset(0, 4),
          ),
        ],
      ),
    );
  }
}

/// SCR-04: Onboarding 3 — Opportunity
/// "Find work. Get hired."
class _OnboardingOpportunitySlide extends StatelessWidget {
  const _OnboardingOpportunitySlide();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero Illustration Card: Soft Pink with brief card
          Expanded(
            flex: 11,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(AppRadii.card),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.card),
                child: Stack(
                  children: [
                    // Soft background glow
                    Positioned(
                      top: -20,
                      right: -20,
                      child: Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),

                    // Brief preview card
                    Center(
                      child: Container(
                        width: 200,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x14000000),
                              blurRadius: 20,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.accentMint.withValues(alpha: 0.35),
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text(
                                'NEW BRIEF',
                                style: AppTypography.label(
                                  color: AppColors.textPrimary,
                                ).copyWith(fontSize: 9),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Summer Campaign',
                              style: AppTypography.headingMedium(
                                color: AppColors.textPrimary,
                              ).copyWith(fontSize: 15),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Reels • Delhi',
                              style: AppTypography.caption(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.xl),

          // Text Content Section
          Expanded(
            flex: 9,
            child: SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: 'Find work.\n',
                          style: AppTypography.displayLarge(
                            color: AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 32,
                            height: 1.05,
                          ),
                        ),
                        TextSpan(
                          text: 'Get hired.',
                          style: AppTypography.displayAccent(
                            color: AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 35,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: AppSpacing.md),

                  Text(
                    'Apply to brand briefs, get shortlisted and grow your professional network.',
                    style: AppTypography.bodyMedium(
                      color: AppColors.textSecondary,
                    ).copyWith(
                      fontSize: 14.5,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
