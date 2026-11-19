import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/domain/entities/user_role.dart';

class AddRoleDialog extends StatelessWidget {
  final UserRole role;

  const AddRoleDialog({super.key, required this.role});

  static Future<bool> show(BuildContext context, {required UserRole role}) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => AddRoleDialog(role: role),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      backgroundColor: AppColors.surfaceWarm,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: role.accentColor.withValues(alpha: 0.25),
                shape: BoxShape.circle,
              ),
              child: Icon(role.icon, color: AppColors.textPrimary, size: 28),
            ),
            const SizedBox(height: 18),
            Text(
              'Add ${role.title}?',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Archivo',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'You will be able to switch between profiles at any time. Your existing projects, credentials, and verification badges remain safe.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                onPressed: () => Navigator.pop(context, true),
                child: Text(
                  'Add ${role.title}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text(
                  'Cancel',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
