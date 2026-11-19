import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class ConfirmVerificationDialog extends StatelessWidget {
  final bool isBrand;
  final String? code;

  const ConfirmVerificationDialog({
    super.key,
    this.isBrand = false,
    this.code,
  });

  static Future<bool> show(
    BuildContext context, {
    bool isBrand = false,
    String? code,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => ConfirmVerificationDialog(isBrand: isBrand, code: code),
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
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                color: Color(0xFFE8F5E9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_rounded, color: Color(0xFF2E7D32), size: 28),
            ),
            const SizedBox(height: 18),
            const Text(
              'Submit for verification?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Archivo',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              isBrand
                  ? 'Your company details and legal registrations will be submitted for manual verification. Review typically takes 24 hours.'
                  : 'Please confirm that the code ${code ?? "CC-4F9K2"} is saved in your Instagram bio. Our automated checker will scan it immediately.',
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
                onPressed: () => Navigator.pop(context, true), // Submit
                child: const Text(
                  'Submit for review',
                  style: TextStyle(
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
                onPressed: () => Navigator.pop(context, false), // Go back
                child: const Text(
                  'Go back & check',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
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
