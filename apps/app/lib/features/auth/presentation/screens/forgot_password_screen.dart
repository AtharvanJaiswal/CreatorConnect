import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/repositories/auth_repository.dart';
import 'reset_password_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final String? initialEmail;
  final AuthRepository? authRepository;

  const ForgotPasswordScreen({
    super.key,
    this.initialEmail,
    this.authRepository,
  });

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  late final TextEditingController _emailController;
  late final AuthRepository _authRepository;

  bool _isLoading = false;
  bool _isSent = false;
  String? _errorMessage;
  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail ?? '');
    _authRepository = widget.authRepository ?? AuthRepositoryImpl();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _animController.dispose();
    super.dispose();
  }

  bool get _isEmailValid {
    final email = _emailController.text.trim();
    return email.contains('@') && email.contains('.');
  }

  Future<void> _onSendResetLink() async {
    final email = _emailController.text.trim();
    if (!_isEmailValid) {
      setState(() {
        _errorMessage = 'Please enter a valid email address';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await _authRepository.sendPasswordResetEmail(email);

      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _isSent = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  void _onEnterNewPassword() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            ResetPasswordScreen(
          authRepository: _authRepository,
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(1.0, 0.0),
              end: Offset.zero,
            ).chain(CurveTween(curve: Curves.easeOutCubic)).animate(animation),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 300),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.sm),

                    // Heading & Subtitle (SCR-12 Spec)
                    Text(
                      'Forgot your\npassword?',
                      style: AppTypography.headingLarge(
                        color: AppColors.textPrimary,
                      ).copyWith(fontSize: 28, height: 1.15),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      "Enter your registered email address and we'll send you a reset link.",
                      style: AppTypography.bodyMedium(
                        color: AppColors.textSecondary,
                      ),
                    ),

                    const SizedBox(height: AppSpacing.xl),

                    if (!_isSent) ...[
                      // Email Input Field
                      AppTextField(
                        label: 'EMAIL',
                        hintText: 'you@email.com',
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.done,
                        onChanged: (_) {
                          if (_errorMessage != null) {
                            setState(() => _errorMessage = null);
                          } else {
                            setState(() {});
                          }
                        },
                      ),

                      if (_errorMessage != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          _errorMessage!,
                          style: AppTypography.caption(
                            color: AppColors.error,
                          ).copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],

                      const SizedBox(height: AppSpacing.xl),

                      // Primary Button: Send Reset Link
                      AppButton(
                        width: double.infinity,
                        text: 'Send Reset Link',
                        isLoading: _isLoading,
                        onPressed: _isEmailValid && !_isLoading
                            ? _onSendResetLink
                            : null,
                        variant: AppButtonVariant.primary,
                      ),
                    ] else ...[
                      // Link Sent Success State
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(AppRadii.card),
                          border: Border.all(color: AppColors.border),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.textPrimary.withValues(alpha: 0.04),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: const BoxDecoration(
                                color: AppColors.accentMint,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.mark_email_read_rounded,
                                color: AppColors.textPrimary,
                                size: 24,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              'Reset Link Sent',
                              style: AppTypography.headingMedium(
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              "We've sent a password reset link to\n${_emailController.text.trim()}",
                              textAlign: TextAlign.center,
                              style: AppTypography.bodyMedium(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: AppSpacing.lg),

                      // Have a reset code? Set New Password CTA
                      AppButton(
                        width: double.infinity,
                        text: 'Enter New Password',
                        onPressed: _onEnterNewPassword,
                        variant: AppButtonVariant.primary,
                      ),
                    ],

                    const SizedBox(height: AppSpacing.lg),

                    // Back to Login Link
                    Center(
                      child: TextButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        child: Text(
                          'Back to Login',
                          style: AppTypography.buttonLarge(
                            color: AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 14,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: AppSpacing.lg),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
