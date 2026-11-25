import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// DLG-19: Remove Role Confirmation Dialog
class RemoveRoleDialog extends StatelessWidget {
  final String roleTitle;
  final String primaryRoleTitle;

  const RemoveRoleDialog({
    super.key,
    required this.roleTitle,
    this.primaryRoleTitle = 'Creator',
  });

  static Future<bool?> show(
    BuildContext context, {
    required String roleTitle,
    String primaryRoleTitle = 'Creator',
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => RemoveRoleDialog(
        roleTitle: roleTitle,
        primaryRoleTitle: primaryRoleTitle,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.modal),
      ),
      contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.secondary.withOpacity(0.3),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Text(
                '🎭',
                style: TextStyle(fontSize: 28),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Remove $roleTitle Role?',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Your $roleTitle profile and editor portfolio will be removed. Your primary $primaryRoleTitle role will remain active.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.button),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Keep Role', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.error,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.button),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Remove', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
