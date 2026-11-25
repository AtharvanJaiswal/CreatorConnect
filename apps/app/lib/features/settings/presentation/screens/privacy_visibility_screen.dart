import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/settings_controllers.dart';
import '../widgets/settings_components.dart';

/// N04: Privacy and Visibility (SCR-050) Screen
class PrivacyVisibilityScreen extends ConsumerWidget {
  const PrivacyVisibilityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(privacySettingsControllerProvider);
    final notifier = ref.read(privacySettingsControllerProvider.notifier);
    final s = state.settings;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Privacy & Visibility',
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
            // Group 1: Discovery & Searchability
            SettingsGroupCard(
              title: 'DISCOVERY & SEARCHABILITY',
              children: [
                SettingsSwitchTile(
                  title: 'Show Profile in Discovery',
                  subtitle: 'Allow brands and creators to find your portfolio in search filters',
                  value: s.showInDiscovery,
                  onChanged: (val) {
                    notifier.updateSettings(s.copyWith(showInDiscovery: val));
                  },
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsSwitchTile(
                  title: 'Display Verified Commercial Rates',
                  subtitle: 'Show starting price tag on profile (e.g. ₹15,000)',
                  value: s.showCommercialRates,
                  onChanged: (val) {
                    notifier.updateSettings(s.copyWith(showCommercialRates: val));
                  },
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsSwitchTile(
                  title: 'Show Active / Online Status',
                  subtitle: 'Green presence indicator in search & chat threads',
                  value: s.showOnlineStatus,
                  onChanged: (val) {
                    notifier.updateSettings(s.copyWith(showOnlineStatus: val));
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Group 2: Direct Contact Controls
            SettingsGroupCard(
              title: 'DIRECT CONTACT CONTROLS',
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
                            'Who can message you',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Control inbound collaboration requests',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      DropdownButton<String>(
                        value: s.whoCanMessage,
                        underline: const SizedBox(),
                        icon: const Icon(Icons.arrow_drop_down_rounded, color: AppColors.textSecondary),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                        items: const [
                          DropdownMenuItem(value: 'Verified Only', child: Text('Verified Only')),
                          DropdownMenuItem(value: 'Everyone', child: Text('Everyone')),
                          DropdownMenuItem(value: 'Direct Collabs Only', child: Text('Collabs Only')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            notifier.updateSettings(s.copyWith(whoCanMessage: val));
                          }
                        },
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsSwitchTile(
                  title: 'Read Receipts',
                  subtitle: 'Show blue tick when you read collaboration messages',
                  value: s.readReceipts,
                  onChanged: (val) {
                    notifier.updateSettings(s.copyWith(readReceipts: val));
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Escrow Protection Callout Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary.withOpacity(0.6),
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('🛡️', style: TextStyle(fontSize: 22)),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Escrow Protection Rule',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Turning off discovery does not affect your active contractual assignments or direct communications with current project collaborators.',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            height: 1.4,
                          ),
                        ),
                      ],
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
