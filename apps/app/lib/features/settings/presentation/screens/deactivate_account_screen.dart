import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/settings_controllers.dart';
import '../widgets/settings_components.dart';

/// N11: Deactivate Account (SCR-057) Screen
class DeactivateAccountScreen extends ConsumerStatefulWidget {
  const DeactivateAccountScreen({super.key});

  @override
  ConsumerState<DeactivateAccountScreen> createState() => _DeactivateAccountScreenState();
}

class _DeactivateAccountScreenState extends ConsumerState<DeactivateAccountScreen> {
  String _selectedReason = 'Currently booked on external projects';

  final List<String> _reasons = [
    'Currently booked on external projects',
    'Too many notifications / messages',
    'Personal leave / travelling',
    'Other reasons',
  ];

  Future<void> _handleDeactivate() async {
    final notifier = ref.read(accountLifecycleControllerProvider.notifier);
    final success = await notifier.deactivate(reason: _selectedReason);

    if (mounted && success) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.modal)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('⏸️', style: TextStyle(fontSize: 36)),
              const SizedBox(height: 12),
              const Text(
                'Profile Deactivated',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              const Text(
                'Your profile is now hidden from discovery. You can reactivate your profile anytime simply by logging back in.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.button)),
                ),
                child: const Text('Got it', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(accountLifecycleControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Deactivate Account',
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
              'Taking a creative break?',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Deactivating is temporary. Your profile, portfolio samples, and reviews will be hidden from search until you log back in.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),

            SettingsGroupCard(
              title: 'REASON FOR TAKING A BREAK',
              children: [
                for (final reason in _reasons) ...[
                  RadioListTile<String>(
                    value: reason,
                    groupValue: _selectedReason,
                    activeColor: AppColors.textPrimary,
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      reason,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedReason = val);
                    },
                  ),
                ],
              ],
            ),
            const SizedBox(height: 20),

            // Important Callout
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
                  Text('⚠️', style: TextStyle(fontSize: 18)),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Important: If you have active contractual assignments, they must be fulfilled or mutually closed before deactivating.',
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
            const SizedBox(height: 28),

            // Action Buttons
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: state.isLoading ? null : _handleDeactivate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.button),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: state.isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(
                        'Deactivate Profile',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.button),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Keep Profile Active', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
