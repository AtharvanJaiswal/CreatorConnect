import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/role_card.dart';
import '../../domain/entities/user_role.dart';
import 'mobile_register_screen.dart';

class AccountTypeScreen extends StatefulWidget {
  const AccountTypeScreen({super.key});

  @override
  State<AccountTypeScreen> createState() => _AccountTypeScreenState();
}

class _AccountTypeScreenState extends State<AccountTypeScreen>
    with SingleTickerProviderStateMixin {
  UserRole? _selectedRole;
  late AnimationController _fadeController;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  void _onContinue() {
    if (_selectedRole == null) return;
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            MobileRegisterScreen(selectedRole: _selectedRole!),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          const begin = Offset(1.0, 0.0);
          const end = Offset.zero;
          const curve = Curves.easeOutCubic;
          final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
          return SlideTransition(position: animation.drive(tween), child: child);
        },
        transitionDuration: const Duration(milliseconds: 320),
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
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.sm),

                  // Headline & Subtitle
                  Text(
                    'How will you\nuse CreatorConnect?',
                    style: AppTypography.headingLarge(
                      color: AppColors.textPrimary,
                    ).copyWith(
                      fontSize: 28,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'You can add more roles later from your profile.',
                    style: AppTypography.bodyMedium(
                      color: AppColors.textSecondary,
                    ),
                  ),

                  const SizedBox(height: AppSpacing.xl),

                  // 4 Role Cards with Staggered Entrance Animations
                  Expanded(
                    child: ListView.separated(
                      physics: const BouncingScrollPhysics(),
                      itemCount: UserRole.values.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final role = UserRole.values[index];
                        final isSelected = _selectedRole == role;

                        final startInterval = (index * 0.12).clamp(0.0, 0.7);
                        final endInterval = (startInterval + 0.35).clamp(0.0, 1.0);

                        return SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0.0, 0.15),
                            end: Offset.zero,
                          ).animate(
                            CurvedAnimation(
                              parent: _fadeController,
                              curve: Interval(startInterval, endInterval, curve: Curves.easeOutCubic),
                            ),
                          ),
                          child: FadeTransition(
                            opacity: CurvedAnimation(
                              parent: _fadeController,
                              curve: Interval(startInterval, endInterval, curve: Curves.easeIn),
                            ),
                            child: RoleCard(
                              role: role,
                              isSelected: isSelected,
                              onSelected: () {
                                setState(() {
                                  _selectedRole = role;
                                });
                              },
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                  // Bottom Action Button: Continue (Pill)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                    child: AppButton(
                      width: double.infinity,
                      text: 'Continue',
                      onPressed: _selectedRole != null ? _onContinue : null,
                      variant: AppButtonVariant.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
