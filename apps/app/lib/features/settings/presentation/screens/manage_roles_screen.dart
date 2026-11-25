import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../discovery/presentation/controllers/module_d_controllers.dart';
import '../dialogs/remove_role_dialog.dart';
import '../widgets/settings_components.dart';

/// N06: Multi-Role Management (SCR-052) Screen (SOW §2)
class ManageRolesScreen extends ConsumerStatefulWidget {
  const ManageRolesScreen({super.key});

  @override
  ConsumerState<ManageRolesScreen> createState() => _ManageRolesScreenState();
}

class _ManageRolesScreenState extends ConsumerState<ManageRolesScreen> {
  bool _hasSecondaryRole = true;

  @override
  Widget build(BuildContext context) {
    final dashState = ref.watch(homeDashboardProvider);
    final activeRole = dashState.role.toUpperCase();

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'My Roles (SOW §2)',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'CreatorConnect allows multiple active creative profiles under a single login. Switch context or add new skills.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),

            // Primary Role Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.primary, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.25),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          children: [
                            Text('★', style: TextStyle(color: AppColors.warning, fontSize: 13)),
                            SizedBox(width: 4),
                            Text(
                              'Primary Role Active',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Text(
                        'Default',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Content Creator',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Fashion, Lifestyle Reels · Level 2 Verified',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  OutlinedButton(
                    onPressed: () => Navigator.pushNamed(context, '/profile/creator-details'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadii.button),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Secondary Role Card (Production Professional)
            if (_hasSecondaryRole) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.secondary.withOpacity(0.25),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            children: [
                              Text('🎬', style: TextStyle(fontSize: 12)),
                              SizedBox(width: 4),
                              Text(
                                'Secondary Role',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () async {
                            final confirmed = await RemoveRoleDialog.show(
                              context,
                              roleTitle: 'Production Professional',
                              primaryRoleTitle: 'Creator',
                            );
                            if (confirmed == true) {
                              setState(() => _hasSecondaryRole = false);
                            }
                          },
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.error,
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            'Remove',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.error,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Production Professional',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Video Editor, Colorist · 6 Portfolio items',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        ElevatedButton(
                          onPressed: () {
                            ref.read(homeDashboardProvider.notifier).loadDashboard('PROFESSIONAL');
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Switched to Production Professional view')),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.textPrimary,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppRadii.button),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('Switch to this Role', style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton(
                          onPressed: () => Navigator.pushNamed(context, '/profile/professional-details'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.textPrimary,
                            side: const BorderSide(color: AppColors.border),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppRadii.button),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Available to Add
            SettingsGroupCard(
              title: 'AVAILABLE TO ADD',
              children: [
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.accentMint.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(
                        child: Text('🎙️', style: TextStyle(fontSize: 22)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Podcaster Profile',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Host audio & video talk shows',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    OutlinedButton(
                      onPressed: () => Navigator.pushNamed(context, '/profile/add-role'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.button),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('+ Add Role', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Role Isolation Note
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary.withOpacity(0.6),
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('🏢', style: TextStyle(fontSize: 18)),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Role Isolation Note: Brand accounts operate on separate business entities per SOW §2 and cannot be added to individual creator accounts.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
