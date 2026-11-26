import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/settings_controllers.dart';
import '../dialogs/active_escrow_conflict_dialog.dart';
import '../widgets/settings_components.dart';

/// N12: Delete Account / Data Erasure (SCR-058) Screen (GDPR Article 17)
class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final TextEditingController _confirmTextController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;
  String? _validationError;

  @override
  void dispose() {
    _confirmTextController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleDeleteRequest({bool simulateConflict = false}) async {
    final text = _confirmTextController.text.trim();
    final pass = _passwordController.text.trim();

    if (text != 'DELETE') {
      setState(() => _validationError = 'Please type "DELETE" in capital letters to confirm.');
      return;
    }
    if (pass.isEmpty) {
      setState(() => _validationError = 'Please enter your current password.');
      return;
    }

    setState(() => _validationError = null);

    final notifier = ref.read(accountLifecycleControllerProvider.notifier);
    final result = await notifier.requestErasure(
      reason: 'User self-requested GDPR erasure',
      testForceConflict: simulateConflict,
    );

    final state = ref.read(accountLifecycleControllerProvider);
    if (state.hasEscrowConflict && mounted) {
      // Trigger DLG-91 Active Escrow Conflict Dialog
      ActiveEscrowConflictDialog.show(
        context,
        message: state.conflictDetails,
      );
      return;
    }

    if (mounted && result != null) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.modal)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('⏳', style: TextStyle(fontSize: 36)),
              const SizedBox(height: 12),
              const Text(
                'Erasure Request Received',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              const Text(
                'Under GDPR Article 17, your 7-day cooling-off period has begun. Personal data and portfolio media will be purged unless cancelled before the window closes.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.button)),
                ),
                child: const Text('Understood', style: TextStyle(fontWeight: FontWeight.w800)),
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
    final hasPendingErasure = state.erasureStatus != null;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Delete Account',
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
            // Warning Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.error.withOpacity(0.3)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('⚠️', style: TextStyle(fontSize: 24)),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Permanent & Irreversible Action',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppColors.error,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'This will permanently erase your profile, social verifications, portfolio media from Cloudflare R2, and client reviews under GDPR Article 17.',
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
            const SizedBox(height: 20),

            // What will be erased
            SettingsGroupCard(
              title: 'WHAT WILL BE ERASED',
              children: const [
                _ErasureItemRow(icon: '📁', title: 'All portfolio items & media assets'),
                Divider(height: 1, color: AppColors.backgroundSecondary),
                _ErasureItemRow(icon: '💬', title: 'Chat histories & attachment links'),
                Divider(height: 1, color: AppColors.backgroundSecondary),
                _ErasureItemRow(icon: '⭐', title: 'Creator rating score (4.9 ★) & badges'),
              ],
            ),
            const SizedBox(height: 20),

            if (hasPendingErasure) ...[
              // Active Pending Erasure Status
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.warning),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.hourglass_bottom_rounded, size: 20, color: AppColors.warning),
                        SizedBox(width: 8),
                        Text(
                          'Pending Erasure in Cooling-Off Window',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Stage: ${state.erasureStatus?.currentStage ?? "COOLING_OFF"}. You can cancel this erasure request before scheduled purge.',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () => ref.read(accountLifecycleControllerProvider.notifier).cancelErasure('User cancelled'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surface,
                        foregroundColor: AppColors.textPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.button),
                          side: const BorderSide(color: AppColors.border),
                        ),
                      ),
                      child: const Text('Cancel Erasure Request', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ] else ...[
              // Confirmation Inputs
              SettingsGroupCard(
                title: 'SECURITY CONFIRMATION',
                children: [
                  const Text(
                    'Type "DELETE" to confirm',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _confirmTextController,
                    decoration: InputDecoration(
                      hintText: 'DELETE',
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.backgroundPrimary,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.input),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  const Text(
                    'Enter your current password',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      hintText: '••••••••••••',
                      filled: true,
                      fillColor: AppColors.backgroundPrimary,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.input),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          color: AppColors.textSecondary,
                        ),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                  ),
                  if (_validationError != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      _validationError!,
                      style: const TextStyle(color: AppColors.error, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 24),

              // Delete Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: state.isLoading ? null : () => _handleDeleteRequest(simulateConflict: false),
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
                          'Permanently Delete Account',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 12),

              // Test simulation trigger for active escrow conflict (DLG-91)
              Center(
                child: TextButton(
                  onPressed: () => _handleDeleteRequest(simulateConflict: true),
                  child: const Text(
                    'Simulate Active Escrow Conflict (DLG-91)',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ],
        ),
      ),
    );
  }
}

class _ErasureItemRow extends StatelessWidget {
  final String icon;
  final String title;

  const _ErasureItemRow({required this.icon, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Row(
        children: [
          Text(icon, style: const TextStyle(fontSize: 18)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
