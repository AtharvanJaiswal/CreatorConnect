import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_role.dart';
import '../../domain/repositories/auth_repository.dart';
import 'email_sent_screen.dart';
import '../bottom_sheets/account_exists_sheet.dart';

class EmailRegisterScreen extends StatefulWidget {
  final UserRole selectedRole;
  final AuthRepository? authRepository;

  const EmailRegisterScreen({
    super.key,
    required this.selectedRole,
    this.authRepository,
  });

  @override
  State<EmailRegisterScreen> createState() => _EmailRegisterScreenState();
}

class _EmailRegisterScreenState extends State<EmailRegisterScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  late final AuthRepository _authRepository;
  bool _isLoading = false;
  String? _errorMessage;

  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();
    _authRepository = widget.authRepository ?? AuthRepositoryImpl();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // Live password validation checklist
  bool get _hasMinLength => _passwordController.text.length >= 8;
  bool get _hasNumber => RegExp(r'[0-9]').hasMatch(_passwordController.text);
  bool get _hasSpecialChar =>
      RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(_passwordController.text);

  bool get _isPasswordValid => _hasMinLength && _hasNumber && _hasSpecialChar;

  bool get _doPasswordsMatch =>
      _confirmPasswordController.text.isNotEmpty &&
      _passwordController.text == _confirmPasswordController.text;

  bool get _isEmailValid {
    final email = _emailController.text.trim();
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  bool get _canSubmit =>
      _isEmailValid && _isPasswordValid && _doPasswordsMatch && !_isLoading;

  double get _strengthScore {
    if (_passwordController.text.isEmpty) return 0.0;
    int score = 0;
    if (_hasMinLength) score++;
    if (_hasNumber) score++;
    if (_hasSpecialChar) score++;
    if (score == 0) return 0.15;
    return score / 3.0;
  }

  Color get _strengthColor {
    final score = _strengthScore;
    if (score <= 0.34) return AppColors.error;
    if (score <= 0.67) return AppColors.warning;
    return AppColors.success;
  }

  String get _strengthLabel {
    if (_passwordController.text.isEmpty) return '';
    final score = _strengthScore;
    if (score <= 0.34) return 'Weak password';
    if (score <= 0.67) return 'Medium password';
    return 'Strong password';
  }

  Future<void> _onCreateAccount() async {
    if (!_canSubmit) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    try {
      await _authRepository.signUpWithEmail(
        email: email,
        password: password,
        selectedRole: widget.selectedRole,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              EmailSentScreen(
            email: email,
            selectedRole: widget.selectedRole,
            authRepository: _authRepository,
          ),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
          transitionDuration: const Duration(milliseconds: 300),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      final errorStr = e.toString().toLowerCase();

      if (errorStr.contains('already registered') || errorStr.contains('already exists')) {
        setState(() => _isLoading = false);
        AccountExistsSheet.show(
          context,
          onLogin: () {
            Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
          },
          onUseDifferentDetails: () {
            // Let user edit email
          },
        );
        return;
      }

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
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.sm),

                  // Headline
                  Text(
                    'Sign up with\nemail',
                    style: AppTypography.headingLarge(
                      color: AppColors.textPrimary,
                    ).copyWith(fontSize: 28, height: 1.15),
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Email Field
                  AppTextField(
                    label: 'EMAIL',
                    hintText: 'anjana@creatorconnect.in',
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Password Field
                  AppTextField(
                    label: 'PASSWORD',
                    hintText: '••••••••••',
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    onChanged: (_) => setState(() {}),
                    suffix: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        size: 20,
                        color: AppColors.textSecondary,
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Live Strength Meter Bar & Label
                  if (_passwordController.text.isNotEmpty) ...[
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: _strengthScore,
                              backgroundColor: AppColors.disabled,
                              valueColor: AlwaysStoppedAnimation<Color>(_strengthColor),
                              minHeight: 4,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Text(
                          _strengthLabel,
                          style: AppTypography.caption(color: _strengthColor).copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],

                  // Live Checklist Rules
                  _buildRuleCheckItem('At least 8 characters', _hasMinLength),
                  const SizedBox(height: 6),
                  _buildRuleCheckItem('Contains a number', _hasNumber),
                  const SizedBox(height: 6),
                  _buildRuleCheckItem('Contains a special character', _hasSpecialChar),
                  const SizedBox(height: AppSpacing.md),

                  // Confirm Password Field
                  AppTextField(
                    label: 'CONFIRM PASSWORD',
                    hintText: '••••••••••',
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirm,
                    onChanged: (_) => setState(() {}),
                    suffix: IconButton(
                      icon: Icon(
                        _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        size: 20,
                        color: AppColors.textSecondary,
                      ),
                      onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    ),
                  ),

                  // Confirm password match indicator
                  if (_confirmPasswordController.text.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 6, left: 4),
                      child: Row(
                        children: [
                          Icon(
                            _doPasswordsMatch ? Icons.check_circle_rounded : Icons.cancel_rounded,
                            size: 14,
                            color: _doPasswordsMatch ? AppColors.success : AppColors.error,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _doPasswordsMatch ? 'Passwords match' : 'Passwords do not match',
                            style: AppTypography.caption(
                              color: _doPasswordsMatch ? AppColors.success : AppColors.error,
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

                  // Primary Button: Create Account (Pill)
                  AppButton(
                    width: double.infinity,
                    text: 'Create Account',
                    isLoading: _isLoading,
                    onPressed: _canSubmit ? _onCreateAccount : null,
                    variant: AppButtonVariant.primary,
                  ),

                  const SizedBox(height: AppSpacing.lg),

                  // Prefer mobile? Continue with Mobile
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: Text(
                        'Prefer mobile? Continue with Mobile',
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
