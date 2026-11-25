import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../discovery/presentation/controllers/module_d_controllers.dart';
import '../dialogs/logout_confirmation_dialog.dart';
import '../widgets/settings_components.dart';

/// N01: Settings Home / Account Hub Screen
class SettingsHomeScreen extends ConsumerWidget {
  const SettingsHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashState = ref.watch(homeDashboardProvider);
    User? user;
    try {
      user = Supabase.instance.client.auth.currentUser;
    } catch (_) {
      user = null;
    }
    final displayName = dashState.greeting.isNotEmpty && dashState.greeting.contains(',')
        ? dashState.greeting.split(',').last.replaceAll('👋', '').trim()
        : (user?.userMetadata?['name'] as String? ?? 'Priya Sharma');
    final email = user?.email ?? 'priya@creatorconnect.in';
    final roleName = dashState.role.isNotEmpty ? dashState.role : 'CREATOR';

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Settings',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 22,
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
            // User Summary Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      displayName.isNotEmpty ? displayName[0].toUpperCase() : 'C',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                displayName,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(
                              Icons.verified_rounded,
                              size: 18,
                              color: AppColors.primaryDark,
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          email,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          children: [
                            _buildRoleBadge(roleName, AppColors.primary),
                            if (roleName.toUpperCase() != 'BRAND')
                              _buildRoleBadge('Pro Editor', AppColors.secondary.withOpacity(0.6)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textMuted,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Group 1: Account & Identity
            SettingsGroupCard(
              title: 'ACCOUNT & IDENTITY',
              children: [
                SettingsNavTile(
                  leading: const Text('👤', style: TextStyle(fontSize: 20)),
                  title: 'Personal Details',
                  subtitle: 'Email, phone number, password',
                  onTap: () => Navigator.pushNamed(context, '/settings/account-details'),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('🎭', style: TextStyle(fontSize: 20)),
                  title: 'Manage Roles',
                  trailingText: '2 Active',
                  onTap: () => Navigator.pushNamed(context, '/settings/roles'),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('🔒', style: TextStyle(fontSize: 20)),
                  title: 'Security & Login',
                  subtitle: '2FA active · 3 active devices',
                  onTap: () => Navigator.pushNamed(context, '/settings/security'),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Group 2: Preferences
            SettingsGroupCard(
              title: 'PREFERENCES',
              children: [
                SettingsNavTile(
                  leading: const Text('🔔', style: TextStyle(fontSize: 20)),
                  title: 'Notifications',
                  subtitle: 'Push, Email, SMS alerts',
                  onTap: () => Navigator.pushNamed(context, '/settings/notifications'),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('👁️', style: TextStyle(fontSize: 20)),
                  title: 'Privacy & Visibility',
                  trailingText: 'Public',
                  onTap: () => Navigator.pushNamed(context, '/settings/privacy'),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('🚫', style: TextStyle(fontSize: 20)),
                  title: 'Blocked Users',
                  trailingText: '2',
                  onTap: () => Navigator.pushNamed(context, '/settings/blocked-users'),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Group 3: Support & Legal
            SettingsGroupCard(
              title: 'SUPPORT & LEGAL',
              children: [
                SettingsNavTile(
                  leading: const Text('❓', style: TextStyle(fontSize: 20)),
                  title: 'Help Centre & FAQ',
                  onTap: () => Navigator.pushNamed(context, '/settings/help'),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('💬', style: TextStyle(fontSize: 20)),
                  title: 'Contact Support',
                  onTap: () => Navigator.pushNamed(context, '/settings/support'),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('📜', style: TextStyle(fontSize: 20)),
                  title: 'Legal & Policies',
                  onTap: () => Navigator.pushNamed(context, '/settings/legal'),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('ℹ️', style: TextStyle(fontSize: 20)),
                  title: 'About CreatorConnect',
                  trailingText: 'v2.4.1',
                  onTap: () => Navigator.pushNamed(context, '/settings/about'),
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Log Out Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () async {
                  final confirmed = await LogoutConfirmationDialog.show(context);
                  if (confirmed == true && context.mounted) {
                    try {
                      await Supabase.instance.client.auth.signOut();
                    } catch (_) {}
                    if (context.mounted) {
                      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
                    }
                  }
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.border),
                  backgroundColor: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.button),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.logout_rounded, size: 18, color: AppColors.error),
                    SizedBox(width: 8),
                    Text(
                      'Log Out of CreatorConnect',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: AppColors.error,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color, width: 0.8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}
