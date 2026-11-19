import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/phone_utils.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_role.dart';
import '../../domain/repositories/auth_repository.dart';
import 'email_register_screen.dart';
import 'google_auth_screen.dart';
import 'login_screen.dart';
import 'otp_verification_screen.dart';
import '../bottom_sheets/account_exists_sheet.dart';

class MobileRegisterScreen extends StatefulWidget {
  final UserRole selectedRole;
  final AuthRepository? authRepository;

  const MobileRegisterScreen({
    super.key,
    required this.selectedRole,
    this.authRepository,
  });

  @override
  State<MobileRegisterScreen> createState() => _MobileRegisterScreenState();
}

class _MobileRegisterScreenState extends State<MobileRegisterScreen> {
  final TextEditingController _phoneController = TextEditingController();
  late final AuthRepository _authRepository;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _authRepository = widget.authRepository ?? AuthRepositoryImpl();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  String? get _tenDigits => PhoneUtils.extractTenDigitNumber(_phoneController.text);

  Future<void> _onSendOtp() async {
    final digits = _tenDigits;
    if (digits == null || digits.length != 10) {
      setState(() {
        _errorMessage = 'Please enter a valid 10-digit mobile number';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final fullNumber = '+91$digits';

    try {
      await _authRepository.sendPhoneOtp(fullNumber);

      if (!mounted) return;
      setState(() => _isLoading = false);

      Navigator.of(context).push(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              OtpVerificationScreen(
            fullPhoneNumber: fullNumber,
            displayPhone: '+91 ${PhoneUtils.formatForDisplay(digits)}',
            selectedRole: widget.selectedRole,
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
    } catch (e) {
      if (!mounted) return;
      final errorStr = e.toString().toLowerCase();

      if (errorStr.contains('already exists') || errorStr.contains('already registered')) {
        setState(() => _isLoading = false);
        AccountExistsSheet.show(
          context,
          onLogin: () {
            Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
          },
          onUseDifferentDetails: () {
            // Focus phone input to edit details
          },
        );
        return;
      }

      setState(() {
        _isLoading = false;
        // In local/dev without live SMS gateway, provide seamless development flow
        _errorMessage = e.toString();
      });

      // If in dev/sandbox and SMS provider is not active, allow testing OTP screen directly
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.textPrimary,
          content: Text(
            'Notice: $e',
            style: AppTypography.caption(color: AppColors.surface),
          ),
          action: SnackBarAction(
            label: 'Test OTP UI',
            textColor: AppColors.primary,
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => OtpVerificationScreen(
                    fullPhoneNumber: fullNumber,
                    displayPhone: '+91 ${_formatPhone(digits)}',
                    selectedRole: widget.selectedRole,
                    authRepository: _authRepository,
                  ),
                ),
              );
            },
          ),
        ),
      );
    }
  }

  String _formatPhone(String digits) {
    if (digits.length <= 5) return digits;
    return '${digits.substring(0, 5)} ${digits.substring(5)}';
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
                    'Create your\naccount',
                    style: AppTypography.headingLarge(
                      color: AppColors.textPrimary,
                    ).copyWith(fontSize: 28, height: 1.15),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Subtitle
                  Text(
                    'Enter your mobile number to continue.',
                    style: AppTypography.bodyMedium(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Mobile Number Input with Locked +91 Prefix
                  AppTextField(
                    label: 'MOBILE NUMBER',
                    hintText: '98765 43210',
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    errorText: _errorMessage,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    onChanged: (val) {
                      if (_errorMessage != null) {
                        setState(() => _errorMessage = null);
                      }
                    },
                    prefix: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '+91',
                          style: AppTypography.bodyMedium(
                            color: AppColors.textPrimary,
                          ).copyWith(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Container(
                          width: 1.2,
                          height: 20,
                          color: AppColors.border,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Primary Button: Send OTP
                  AppButton(
                    width: double.infinity,
                    text: 'Send OTP',
                    isLoading: _isLoading,
                    onPressed: _onSendOtp,
                    variant: AppButtonVariant.primary,
                  ),

                  const SizedBox(height: AppSpacing.xl),

                  // Divider with "or"
                  Row(
                    children: [
                      const Expanded(child: Divider(color: AppColors.border)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                        child: Text(
                          'or',
                          style: AppTypography.caption(color: AppColors.textMuted),
                        ),
                      ),
                      const Expanded(child: Divider(color: AppColors.border)),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Continue with Google Button
                  AppButton(
                    width: double.infinity,
                    text: 'Continue with Google',
                    variant: AppButtonVariant.outlined,
                    leading: const _GoogleIconMark(),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => GoogleAuthScreen(
                            authRepository: _authRepository,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Continue with Email Button
                  AppButton(
                    width: double.infinity,
                    text: 'Continue with Email',
                    variant: AppButtonVariant.outlined,
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => EmailRegisterScreen(
                            selectedRole: widget.selectedRole,
                            authRepository: _authRepository,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Already have an account? Log in
                  Center(
                    child: TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => LoginScreen(
                              authRepository: _authRepository,
                            ),
                          ),
                        );
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

class _GoogleIconMark extends StatelessWidget {
  const _GoogleIconMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 20,
      height: 20,
      decoration: const BoxDecoration(shape: BoxShape.circle),
      child: Center(
        child: Text(
          'G',
          style: AppTypography.headingMedium(color: const Color(0xFF4285F4))
              .copyWith(fontSize: 18, fontWeight: FontWeight.w900),
        ),
      ),
    );
  }
}
