import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/settings_controllers.dart';
import '../widgets/settings_components.dart';

/// N03: Notification Preferences (SCR-049) Screen
class NotificationPreferencesScreen extends ConsumerWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notificationPreferencesControllerProvider);
    final notifier = ref.read(notificationPreferencesControllerProvider.notifier);
    final prefs = state.preferences;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Notifications',
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
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (state.message != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.accentMint.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.success),
                      ),
                      child: Text(
                        state.message!,
                        style: const TextStyle(
                          color: AppColors.success,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Group 1: Assignments & Collabs
                  SettingsGroupCard(
                    title: 'ASSIGNMENTS & COLLABS',
                    children: [
                      SettingsSwitchTile(
                        title: 'Brief Selection / Hire',
                        subtitle: 'Immediate push when brand accepts your pitch',
                        value: prefs.assignmentAlerts,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(assignmentAlerts: val));
                        },
                      ),
                      const Divider(height: 1, color: AppColors.backgroundSecondary),
                      SettingsSwitchTile(
                        title: 'Application Status Updates',
                        subtitle: 'Review, shortlisted, or closed briefs',
                        value: prefs.applicationUpdates,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(applicationUpdates: val));
                        },
                      ),
                      const Divider(height: 1, color: AppColors.backgroundSecondary),
                      SettingsSwitchTile(
                        title: 'New Matching Briefs',
                        subtitle: 'Weekly digest of opportunities in your niche',
                        value: prefs.matchingBriefsDigest,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(matchingBriefsDigest: val));
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Group 2: Direct Messages
                  SettingsGroupCard(
                    title: 'DIRECT MESSAGES',
                    children: [
                      SettingsSwitchTile(
                        title: 'New Chat Messages',
                        subtitle: 'Real-time alerts for active project chats',
                        value: prefs.directMessages,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(directMessages: val));
                        },
                      ),
                      const Divider(height: 1, color: AppColors.backgroundSecondary),
                      SettingsSwitchTile(
                        title: 'Message Sound & Vibration',
                        subtitle: 'Play subtle haptic on inbound communications',
                        value: prefs.messageSound,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(messageSound: val));
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Group 3: Channels
                  SettingsGroupCard(
                    title: 'CHANNELS',
                    children: [
                      SettingsSwitchTile(
                        title: 'Push Notifications',
                        subtitle: 'On-device notification drawer alerts',
                        value: prefs.pushChannel,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(pushChannel: val));
                        },
                      ),
                      const Divider(height: 1, color: AppColors.backgroundSecondary),
                      SettingsSwitchTile(
                        title: 'Email Digests',
                        subtitle: 'Summary sent to your registered inbox',
                        value: prefs.emailChannel,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(emailChannel: val));
                        },
                      ),
                      const Divider(height: 1, color: AppColors.backgroundSecondary),
                      SettingsSwitchTile(
                        title: 'SMS Notifications (Escrow only)',
                        subtitle: 'Crucial payout and release verification OTPs',
                        value: prefs.smsEscrowAlerts,
                        onChanged: (val) {
                          notifier.updatePreference(prefs.copyWith(smsEscrowAlerts: val));
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),

                  // Save Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: state.isSaving ? null : () => notifier.savePreferences(),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.button),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: state.isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textPrimary),
                            )
                          : const Text(
                              'Save Preferences',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
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
}
