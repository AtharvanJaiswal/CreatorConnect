import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/settings_controllers.dart';
import '../dialogs/revoke_other_sessions_dialog.dart';
import '../widgets/settings_components.dart';

/// N07: Security & Device Sessions (SCR-053) Screen
class SecurityDevicesScreen extends ConsumerStatefulWidget {
  const SecurityDevicesScreen({super.key});

  @override
  ConsumerState<SecurityDevicesScreen> createState() => _SecurityDevicesScreenState();
}

class _SecurityDevicesScreenState extends ConsumerState<SecurityDevicesScreen> {
  bool _isBiometricEnabled = true;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(deviceSessionsControllerProvider);
    final notifier = ref.read(deviceSessionsControllerProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Security & Devices',
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
            // Authentication Section
            SettingsGroupCard(
              title: 'AUTHENTICATION',
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Two-Factor Authentication (2FA)',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Authenticator App (TOTP)',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.accentMint.withOpacity(0.25),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle_rounded, size: 12, color: AppColors.success),
                            SizedBox(width: 4),
                            Text(
                              'Active ✓',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.success,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsSwitchTile(
                  title: 'Biometric Login',
                  subtitle: 'FaceID / TouchID for quick authentication',
                  value: _isBiometricEnabled,
                  onChanged: (val) => setState(() => _isBiometricEnabled = val),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Logged-in Devices Section
            SettingsGroupCard(
              title: 'LOGGED-IN DEVICES (${state.sessions.length})',
              children: [
                for (int i = 0; i < state.sessions.length; i++) ...[
                  if (i > 0) const Divider(height: 1, color: AppColors.backgroundSecondary),
                  _buildDeviceRow(context, state.sessions[i], notifier),
                ],
              ],
            ),
            const SizedBox(height: 20),

            // Revoke All Other Sessions Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () async {
                  final confirmed = await RevokeOtherSessionsDialog.show(
                    context,
                    count: state.sessions.where((s) => !s.isCurrent).length,
                  );
                  if (confirmed == true) {
                    await notifier.revokeOtherSessions();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('All other device sessions revoked')),
                      );
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
                child: const Text(
                  'Sign Out from All Other Devices',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: AppColors.error,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceRow(
    BuildContext context,
    dynamic session,
    DeviceSessionsNotifier notifier,
  ) {
    IconData iconData = Icons.smartphone_rounded;
    if (session.deviceName.toLowerCase().contains('macbook') ||
        session.deviceName.toLowerCase().contains('pc')) {
      iconData = Icons.laptop_mac_rounded;
    } else if (session.deviceName.toLowerCase().contains('ipad') ||
        session.deviceName.toLowerCase().contains('tablet')) {
      iconData = Icons.tablet_mac_rounded;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.backgroundSecondary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(iconData, color: AppColors.textPrimary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${session.deviceName} · ${session.clientName}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (session.isCurrent) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Current',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${session.location} · ${session.lastActive}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (!session.isCurrent)
            TextButton(
              onPressed: () async {
                await notifier.revokeSession(session.id);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Session on ${session.deviceName} revoked')),
                  );
                }
              },
              style: TextButton.styleFrom(
                foregroundColor: AppColors.error,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Revoke',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.error,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
