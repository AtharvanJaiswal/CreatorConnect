import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class Dlg013DeleteMessageDialog extends StatelessWidget {
  const Dlg013DeleteMessageDialog({super.key});

  static Future<bool?> show(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (_) => const Dlg013DeleteMessageDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: AppColors.surfaceWarm,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Delete Message?',
              style: TextStyle(
                fontFamily: 'Archivo',
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Choose how you want to remove this message from the chat thread:',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.35),
            ),
            const SizedBox(height: 18),
            ListTile(
              leading: const Icon(Icons.public_rounded, color: AppColors.error),
              title: const Text('Delete for Everyone', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
              onTap: () => Navigator.pop(context, true),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              tileColor: AppColors.surfacePure,
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.person_outline_rounded, color: AppColors.textPrimary),
              title: const Text('Delete for Me', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
              onTap: () => Navigator.pop(context, false),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              tileColor: AppColors.surfacePure,
            ),
            const SizedBox(height: 12),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
