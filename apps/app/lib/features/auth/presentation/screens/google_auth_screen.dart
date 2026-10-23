import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../domain/repositories/auth_repository.dart';

class GoogleAuthScreen extends StatefulWidget {
  final AuthRepository? authRepository;

  const GoogleAuthScreen({super.key, this.authRepository});

  @override
  State<GoogleAuthScreen> createState() => _GoogleAuthScreenState();
}

class _GoogleAuthScreenState extends State<GoogleAuthScreen> {
  @override
  void initState() {
    super.initState();
    _initiateGoogleOAuth();
  }

  void _initiateGoogleOAuth() async {
    try {
      if (widget.authRepository != null) {
        await widget.authRepository!.signInWithGoogle();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.textPrimary,
            content: Text(
              'Notice: $e',
              style: AppTypography.caption(color: AppColors.surface),
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(),

                  // Google 'G' Mark Container
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      shape: BoxShape.circle,
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x10000000),
                          blurRadius: 18,
                          offset: Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        'G',
                        style: AppTypography.headingLarge(
                          color: const Color(0xFF4285F4),
                        ).copyWith(fontSize: 32, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Headline
                  Text(
                    'Connecting to Google…',
                    style: AppTypography.headingLarge(
                      color: AppColors.textPrimary,
                    ).copyWith(fontSize: 24),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Subtitle
                  Text(
                    "You'll be returned to CreatorConnect\nonce you've signed in.",
                    style: AppTypography.bodyMedium(
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Subtle Activity Indicator
                  const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.textPrimary),
                    ),
                  ),

                  const Spacer(),

                  // Cancel Button
                  AppButton(
                    width: double.infinity,
                    text: 'Cancel',
                    variant: AppButtonVariant.outlined,
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
