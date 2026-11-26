import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/repositories/auth_repository.dart';

class ResetPasswordScreen extends StatefulWidget {
  final AuthRepository? authRepository;

  const ResetPasswordScreen({super.key, this.authRepository});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen>
    with SingleTickerProviderStateMixin {
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();
  late final AuthRepository _authRepository;

  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  String? _errorMessage;
  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
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
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _animController.dispose();
    super.dispose();
  }

  bool get _hasMinLength => _passwordController.text.length >= 8;
  bool get _hasNumber => RegExp(r'\d').hasMatch(_passwordController.text);
  bool get _hasSpecialChar =>
      RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(_passwordController.text);

  int get _strengthScore {
    int score = 0;
    if (_hasMinLength) score++;
    if (_hasNumber) score++;
    if (_hasSpecialChar) score++;
    return score;
  }

  String get _strengthLabel {
    final score = _strengthScore;
    if (score == 0) return '';
    if (score == 1) return 'Weak';
    if (score == 2) return 'Medium';
    return 'Strong password';
  }

  Color get _strengthColor {
    final score = _strengthScore;
    if (score <= 1) return AppColors.error;
    if (score == 2) return AppColors.warning;
    return AppColors.success;
  }

  bool get _doPasswordsMatch =>
      _confirmPasswordController.text.isNotEmpty &&
      _confirmPasswordController.text == _passwordController.text;

  bool get _canSubmit =>
      _strengthScore >= 2 && _doPasswordsMatch && !_isLoading;

  Future<void> _onResetPassword() async {
    if (!_canSubmit) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await _authRepository.updatePassword(_passwordController.text);

      if (!mounted) return;
      setState(() => _isLoading = false);

      // Show success bottom notification and route back to login
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.textPrimary,
          content: Text(
            'Password updated successfully! Please log in.',
            style: AppTypography.caption(color: AppColors.surface),
          ),
          duration: const Duration(seconds: 3),
        ),
      );

      Navigator.of(context).pushNamedAndRemoveUntil(
        '/login',
        (route) => false,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
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

                    // Heading & Subtitle (SCR-13 Spec)
                    Text(
                      'Create new\npassword',
                      style: AppTypography.headingLarge(
                        color: AppColors.textPrimary,
                      ).copyWith(fontSize: 28, height: 1.15),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Your new password must be different from previous ones.',
                      style: AppTypography.bodyMedium(
                        color: AppColors.textSecondary,
                      ),
                    ),

                    const SizedBox(height: AppSpacing.xl),

                    // New Password Field
                    AppTextField(
                      label: 'NEW PASSWORD',
                      hintText: '••••••••••••',
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.next,
                      onChanged: (_) => setState(() {}),
                      suffix: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),

                    // Live Strength Meter Bar & Label
                    if (_passwordController.text.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: LinearProgressIndicator(
                                value: _strengthScore / 3,
                                minHeight: 4,
                                backgroundColor: AppColors.disabled,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  _strengthColor,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Text(
                            _strengthLabel,
                            style: AppTypography.caption(
                              color: _strengthColor,
                            ).copyWith(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ] else ...[
                      const SizedBox(height: AppSpacing.md),
                    ],

                    // 3 Rule Checklist Items
                    _buildRuleCheckItem('At least 8 characters', _hasMinLength),
                    const SizedBox(height: 6),
                    _buildRuleCheckItem('Contains a number', _hasNumber),
                    const SizedBox(height: 6),
                    _buildRuleCheckItem(
                      'Contains a special character',
                      _hasSpecialChar,
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Confirm Password Field
                    AppTextField(
                      label: 'CONFIRM PASSWORD',
                      hintText: '••••••••••••',
                      controller: _confirmPasswordController,
                      obscureText: _obscureConfirm,
                      textInputAction: TextInputAction.done,
                      onChanged: (_) => setState(() {}),
                      suffix: IconButton(
                        icon: Icon(
                          _obscureConfirm
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                        onPressed: () =>
                            setState(() => _obscureConfirm = !_obscureConfirm),
                      ),
                    ),

                    // Match validation indicator
                    if (_confirmPasswordController.text.isNotEmpty) ...[
                      Padding(
                        padding: const EdgeInsets.only(top: 6, left: 4),
                        child: Row(
                          children: [
                            Icon(
                              _doPasswordsMatch
                                  ? Icons.check_circle_rounded
                                  : Icons.cancel_rounded,
                              size: 14,
                              color: _doPasswordsMatch
                                  ? AppColors.success
                                  : AppColors.error,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              _doPasswordsMatch
                                  ? 'Passwords match'
                                  : 'Passwords do not match',
                              style: AppTypography.caption(
                                color: _doPasswordsMatch
                                    ? AppColors.success
                                    : AppColors.error,
                              ).copyWith(fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ],

                    if (_errorMessage != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        _errorMessage!,
                        style: AppTypography.caption(color: AppColors.error).copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],

                    const SizedBox(height: AppSpacing.xl),

                    // Primary Button: Reset Password
                    AppButton(
                      width: double.infinity,
                      text: 'Reset Password',
                      isLoading: _isLoading,
                      onPressed: _canSubmit ? _onResetPassword : null,
                      variant: AppButtonVariant.primary,
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

  Widget _buildRuleCheckItem(String label, bool isSatisfied) {
    return AnimatedDefaultTextStyle(
      duration: const Duration(milliseconds: 200),
      style: AppTypography.caption(
        color: isSatisfied ? AppColors.textPrimary : AppColors.textMuted,
      ).copyWith(fontWeight: isSatisfied ? FontWeight.w600 : FontWeight.w400),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSatisfied ? AppColors.success : Colors.transparent,
              border: Border.all(
                color: isSatisfied ? AppColors.success : AppColors.disabled,
                width: 1.5,
              ),
            ),
            child: isSatisfied
                ? const Icon(Icons.check, size: 12, color: AppColors.surface)
                : null,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(label)),
        ],
      ),
    );
  }
}
