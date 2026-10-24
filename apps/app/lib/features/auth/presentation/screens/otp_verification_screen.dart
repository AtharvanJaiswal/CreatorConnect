import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/otp_input_field.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_role.dart';
import '../../domain/repositories/auth_repository.dart';

class OtpVerificationScreen extends StatefulWidget {
  final String fullPhoneNumber;
  final String displayPhone;
  final UserRole selectedRole;
  final AuthRepository? authRepository;

  const OtpVerificationScreen({
    super.key,
    required this.fullPhoneNumber,
    required this.displayPhone,
    required this.selectedRole,
    this.authRepository,
  });

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  late final AuthRepository _authRepository;
  String _otpCode = '';
  bool _isLoading = false;
  String? _errorMessage;
  int _remainingAttempts = 3;

  Timer? _resendTimer;
  int _secondsRemaining = 30;

  @override
  void initState() {
    super.initState();
    _authRepository = widget.authRepository ?? AuthRepositoryImpl();
    _startResendTimer();
  }

  void _startResendTimer() {
    _secondsRemaining = 30;
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

  Future<void> _onVerify() async {
    if (_otpCode.length != 6) {
      setState(() {
        _errorMessage = 'Please enter the complete 6-digit verification code.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await _authRepository.verifyPhoneOtp(
        fullPhoneNumber: widget.fullPhoneNumber,
        token: _otpCode,
        selectedRole: widget.selectedRole,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      _onVerificationSuccess();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _remainingAttempts = (_remainingAttempts - 1).clamp(0, 3);

        if (_remainingAttempts > 0) {
          _errorMessage =
              "That code isn't correct. Please try again.\n$_remainingAttempts attempts remaining";
        } else {
          _errorMessage =
              'Too many failed attempts. Please request a new verification code.';
        }
      });
    }
  }

  void _onResendCode() async {
    if (_secondsRemaining > 0) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _remainingAttempts = 3;
    });

    try {
      await _authRepository.sendPhoneOtp(widget.fullPhoneNumber);
      if (!mounted) return;
      setState(() => _isLoading = false);
      _startResendTimer();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.textPrimary,
          content: Text(
            'New verification code sent to ${widget.displayPhone}',
            style: AppTypography.caption(color: AppColors.surface),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  void _onVerificationSuccess() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.modal)),
        contentPadding: const EdgeInsets.all(AppSpacing.xl),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFE8F7ED),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 40),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Verified Successfully!',
              style: AppTypography.headingLarge(),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Identity confirmed. Your profile is assigned as ${widget.selectedRole.title}.',
              style: AppTypography.bodyMedium(),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              width: double.infinity,
              text: 'Go to Dashboard',
              onPressed: () {
                Navigator.of(context).pop();
                Navigator.of(context).pushNamedAndRemoveUntil('/home', (route) => false);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final timerText =
        '00:${_secondsRemaining.toString().padLeft(2, '0')}';

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
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.sm),

                  // Headline
                  Text(
                    'Verify your\nnumber',
                    style: AppTypography.headingLarge(
                      color: AppColors.textPrimary,
                    ).copyWith(fontSize: 28, height: 1.15),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Subtitle with Change Action
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          'Enter the 6-digit code sent to\n${widget.displayPhone}',
                          style: AppTypography.bodyMedium(color: AppColors.textSecondary),
                        ),
                      ),
                      TextButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        child: Text(
                          'Change',
                          style: AppTypography.buttonLarge(
                            color: AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 13,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // 6 Digit OTP Input Field
                  OtpInputField(
                    length: 6,
                    hasError: _errorMessage != null,
                    onChanged: (val) {
                      setState(() {
                        _otpCode = val;
                        if (_errorMessage != null) _errorMessage = null;
                      });
                    },
                    onCompleted: (val) {
                      setState(() => _otpCode = val);
                      _onVerify();
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Error Text & Remaining Attempts (SCR-07b)
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded, size: 16, color: AppColors.error),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: AppTypography.caption(color: AppColors.error).copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],

                  // Resend Timer / Button
                  Center(
                    child: _secondsRemaining > 0
                        ? Text(
                            'Resend code in $timerText',
                            style: AppTypography.caption(color: AppColors.textSecondary).copyWith(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          )
                        : TextButton(
                            onPressed: _isLoading ? null : _onResendCode,
                            child: Text(
                              'Resend code',
                              style: AppTypography.buttonLarge(
                                color: AppColors.textPrimary,
                              ).copyWith(
                                fontSize: 14,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                  ),

                  const SizedBox(height: AppSpacing.xl),

                  // Primary Button: Verify (Pill)
                  AppButton(
                    width: double.infinity,
                    text: 'Verify',
                    isLoading: _isLoading,
                    onPressed: _otpCode.length == 6 ? _onVerify : null,
                    variant: AppButtonVariant.primary,
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
