import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/repositories/auth_repository.dart';
import 'account_type_screen.dart';
import 'forgot_password_screen.dart';
import 'google_auth_screen.dart';

class LoginScreen extends StatefulWidget {
  final AuthRepository? authRepository;

  const LoginScreen({super.key, this.authRepository});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  late final AuthRepository _authRepository;

  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;
  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;

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
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0.0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    ));
    _animController.forward();
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    _animController.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    return _identifierController.text.trim().isNotEmpty &&
        _passwordController.text.isNotEmpty &&
        !_isLoading;
  }

  Future<void> _onLogin() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;

    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter your email or mobile and password.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _authRepository.signInWithPassword(
        emailOrPhone: identifier,
        password: password,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      if (response.session != null) {
        Navigator.of(context).pushNamedAndRemoveUntil(
          '/home',
          (route) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Login successful')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().contains('Invalid login')
            ? "That password isn't right. Try again or reset it."
            : e.toString();
      });
    }
  }

  void _onForgotPassword() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            ForgotPasswordScreen(
          initialEmail: _identifierController.text.contains('@')
              ? _identifierController.text.trim()
              : '',
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

  void _onGoogleSignIn() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => GoogleAuthScreen(
          authRepository: _authRepository,
        ),
      ),
    );
  }

  void _onCreateAccount() {
    Navigator.of(context).push(
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
                child: SlideTransition(
                  position: _slideAnimation,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: AppSpacing.sm),

                      // Screen Title & Subtitle (SCR-11 Spec)
                      Text(
                        'Welcome back',
                        style: AppTypography.headingLarge(
                          color: AppColors.textPrimary,
                        ).copyWith(fontSize: 28),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Log in to continue to CreatorConnect.',
                        style: AppTypography.bodyMedium(
                          color: AppColors.textSecondary,
                        ),
                      ),

                      const SizedBox(height: AppSpacing.xl),

                      // Email or Mobile Field
                      AppTextField(
                        label: 'EMAIL OR MOBILE',
                        hintText: 'you@email.com or 98765 43210',
                        controller: _identifierController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        onChanged: (_) => setState(() {}),
                      ),

                      const SizedBox(height: AppSpacing.md),

                      // Password Field
                      AppTextField(
                        label: 'PASSWORD',
                        hintText: '••••••••',
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.done,
                        onChanged: (_) => setState(() {}),
                        suffix: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 20,
                            color: AppColors.textSecondary,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                        ),
                      ),

                      // Forgot Password Link
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: _onForgotPassword,
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 6,
                            ),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            'Forgot password?',
                            style: AppTypography.caption(
                              color: AppColors.textSecondary,
                            ).copyWith(
                              decoration: TextDecoration.underline,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),

                      // Inline Error Display
                      if (_errorMessage != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.error.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: AppColors.error.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                size: 18,
                                color: AppColors.error,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: AppTypography.caption(
                                    color: AppColors.error,
                                  ).copyWith(fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: AppSpacing.lg),

                      // Primary Button: Log In (Pill)
                      AppButton(
                        width: double.infinity,
                        text: 'Log In',
                        isLoading: _isLoading,
                        onPressed: _canSubmit ? _onLogin : null,
                        variant: AppButtonVariant.primary,
                      ),

                      const SizedBox(height: AppSpacing.lg),

                      // OR Divider
                      Row(
                        children: [
                          const Expanded(
                            child: Divider(color: AppColors.border, thickness: 1),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                            ),
                            child: Text(
                              'or',
                              style: AppTypography.caption(
                                color: AppColors.textMuted,
                              ).copyWith(fontWeight: FontWeight.w600),
                            ),
                          ),
                          const Expanded(
                            child: Divider(color: AppColors.border, thickness: 1),
                          ),
                        ],
                      ),

                      const SizedBox(height: AppSpacing.lg),

                      // Continue with Google Button (Pill Outlined)
                      AppButton(
                        width: double.infinity,
                        text: 'Continue with Google',
                        onPressed: _onGoogleSignIn,
                        variant: AppButtonVariant.outlined,
                        leading: Container(
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            color: Colors.transparent,
                            shape: BoxShape.circle,
                          ),
                          child: const Center(
                            child: Text(
                              'G',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF4285F4),
                              ),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: AppSpacing.xl),

                      // Don't have an account? Create account
                      Center(
                        child: TextButton(
                          onPressed: _onCreateAccount,
                          child: Text.rich(
                            TextSpan(
                              text: "Don't have an account? ",
                              style: AppTypography.bodyMedium(
                                color: AppColors.textSecondary,
                              ),
                              children: [
                                TextSpan(
                                  text: 'Create account',
                                  style: AppTypography.bodyMedium(
                                    color: AppColors.textPrimary,
                                  ).copyWith(
                                    fontWeight: FontWeight.w700,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ],
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
      ),
    );
  }
}
