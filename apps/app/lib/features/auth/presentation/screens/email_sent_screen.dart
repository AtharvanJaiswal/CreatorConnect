import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../domain/entities/user_role.dart';
import '../../domain/repositories/auth_repository.dart';

class EmailSentScreen extends StatefulWidget {
  final String email;
  final UserRole selectedRole;
  final AuthRepository? authRepository;

  const EmailSentScreen({
    super.key,
    required this.email,
    required this.selectedRole,
    this.authRepository,
  });

  @override
  State<EmailSentScreen> createState() => _EmailSentScreenState();
}

class _EmailSentScreenState extends State<EmailSentScreen> {
  Timer? _resendTimer;
  int _secondsRemaining = 60;
  bool _isResending = false;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  void _startCooldown() {
    setState(() => _secondsRemaining = 60);
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() => _secondsRemaining--);
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    super.dispose();
  }

  void _onOpenEmailApp() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.textPrimary,
        content: Text(
          'Please check inbox at ${widget.email}',
          style: AppTypography.caption(color: AppColors.surface),
        ),
      ),
    );
  }

  void _onResendEmail() {
    if (_secondsRemaining > 0 || _isResending) return;

    setState(() => _isResending = true);
    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      setState(() => _isResending = false);
      _startCooldown();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.textPrimary,
          content: Text(
            'New confirmation email sent to ${widget.email}',
            style: AppTypography.caption(color: AppColors.surface),
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, size: 24),
          onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.md),

                  // Hero Floating Mail Icon
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x14000000),
                          blurRadius: 18,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.mark_email_unread_outlined,
                        size: 36,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),

                  const SizedBox(height: AppSpacing.xl),

                  // Headline
                  Text(
                    'Check your email',
                    style: AppTypography.headingLarge(
                      color: AppColors.textPrimary,
                    ).copyWith(fontSize: 28),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Subtitle with Email
                  RichText(
                    text: TextSpan(
                      text: "We've sent a verification link to\n",
                      style: AppTypography.bodyMedium(color: AppColors.textSecondary),
                      children: [
                        TextSpan(
                          text: widget.email,
                          style: AppTypography.bodyMedium(
                            color: AppColors.textPrimary,
                          ).copyWith(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // 24-Hour Expiry Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.backgroundSecondary,
                      borderRadius: BorderRadius.circular(AppRadii.chip),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.schedule_rounded, size: 14, color: AppColors.textSecondary),
                        const SizedBox(width: 6),
                        Text(
                          'Link expires in 24 hours',
                          style: AppTypography.caption(color: AppColors.textSecondary).copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Primary Button: Open Email App
                  AppButton(
                    width: double.infinity,
                    text: 'Open Email App',
                    onPressed: _onOpenEmailApp,
                    variant: AppButtonVariant.primary,
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Resend email with cooldown
                  Center(
                    child: _secondsRemaining > 0
                        ? Text(
                            'Resend email in 00:${_secondsRemaining.toString().padLeft(2, '0')}',
                            style: AppTypography.caption(color: AppColors.textSecondary).copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          )
                        : TextButton(
                            onPressed: _isResending ? null : _onResendEmail,
                            child: Text(
                              'Resend email',
                              style: AppTypography.buttonLarge(
                                color: AppColors.textPrimary,
                              ).copyWith(
                                fontSize: 14,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                  ),

                  // Wrong address? Change email
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: Text(
                        'Wrong address? Change email',
                        style: AppTypography.caption(color: AppColors.textSecondary).copyWith(
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),

                  // Already verified? Log in to Dashboard
                  Center(
                    child: TextButton(
                      onPressed: () {
                        Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
                      },
                      child: Text(
                        'Already verified? Log in to Dashboard',
                        style: AppTypography.buttonLarge(
                          color: AppColors.textPrimary,
                        ).copyWith(
                          fontSize: 13,
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
    );
  }
}
