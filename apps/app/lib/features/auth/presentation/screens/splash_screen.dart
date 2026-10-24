import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/brand_logo.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../data/repositories/auth_repository_impl.dart';
import 'onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  final AuthRepository? authRepository;

  const SplashScreen({super.key, this.authRepository});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnimation;
  late final Animation<double> _fadeAnimation;
  late final AuthRepository _authRepository;
  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();
    _authRepository = widget.authRepository ?? AuthRepositoryImpl();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _scaleAnimation = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );

    _controller.forward();

    // Auto-advance after 2 seconds per design spec
    _navigationTimer = Timer(const Duration(milliseconds: 2200), () {
      if (mounted) {
        _proceedFromSplash();
      }
    });
  }

  Future<void> _proceedFromSplash() async {
    _navigationTimer?.cancel();
    if (!mounted) return;

    // 1. If user is already authenticated (active login/registration session), bypass onboarding & login
    if (_authRepository.isAuthenticated) {
      Navigator.of(context).pushReplacementNamed('/home');
      return;
    }

    // 2. If user already completed/saw onboarding or registered previously, go straight to login
    final hasCompletedOnboarding = await _authRepository.hasCompletedOnboarding();
    if (!mounted) return;

    if (hasCompletedOnboarding) {
      Navigator.of(context).pushReplacementNamed('/login');
    } else {
      // First-time new user -> Onboarding carousel
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const OnboardingScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
          transitionDuration: const Duration(milliseconds: 400),
        ),
      );
    }
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _proceedFromSplash,
      child: Scaffold(

        backgroundColor: AppColors.primary,
        body: Stack(
          children: [
            // Top Right Organic Circle
            Positioned(
              top: -40,
              right: -50,
              child: Container(
                width: 220,
                height: 220,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFE680),
                  shape: BoxShape.circle,
                ),
              ),
            ),

            // Bottom Left Organic Peach Circle
            Positioned(
              bottom: 60,
              left: -50,
              child: Container(
                width: 190,
                height: 190,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFB6C8).withValues(alpha: 0.55),
                  shape: BoxShape.circle,
                ),
              ),
            ),

            // Center Brand Content
            Center(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Squircle App Icon with Infinity / Link
                      const BrandLogoMark(
                        size: 82,
                        borderRadius: 22,
                        backgroundColor: AppColors.textPrimary,
                        iconColor: AppColors.backgroundPrimary,
                      ),
                      const SizedBox(height: 28),

                      // Brand Title: Archivo 800
                      Text(
                        'CreatorConnect',
                        style: AppTypography.displayLarge(
                          color: AppColors.textPrimary,
                        ).copyWith(
                          fontSize: 32,
                          letterSpacing: -1.0,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Expressive Subtitle: Instrument Serif Italic
                      Text(
                        'create together',
                        style: AppTypography.displayAccent(
                          color: AppColors.textPrimary,
                        ).copyWith(
                          fontSize: 21,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Bottom 3 Dots
            Positioned(
              bottom: 40,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildBottomDot(0),
                  const SizedBox(width: 6),
                  _buildBottomDot(1),
                  const SizedBox(width: 6),
                  _buildBottomDot(2),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomDot(int index) {
    return Container(
      width: 5,
      height: 5,
      decoration: BoxDecoration(
        color: AppColors.textPrimary.withValues(alpha: index == 1 ? 0.7 : 0.35),
        shape: BoxShape.circle,
      ),
    );
  }
}
