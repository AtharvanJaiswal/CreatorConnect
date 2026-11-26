import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class RemoveSocialAccountDialog extends StatelessWidget {
  final String platform;
  final String? handle;

  const RemoveSocialAccountDialog({
    super.key,
    required this.platform,
    this.handle,
  });

  static Future<bool> show(
    BuildContext context, {
    required String platform,
    String? handle,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => RemoveSocialAccountDialog(platform: platform, handle: handle),
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
                color: Color(0xFFFFEBEE),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.link_off_rounded, color: Color(0xFFD32F2F), size: 28),
            ),
            const SizedBox(height: 18),
            Text(
              'Disconnect $platform?',
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
              handle != null
                  ? 'Disconnecting @$handle will reset your verified badge, audience metrics, and brand campaign visibility.'
                  : 'Disconnecting will remove your connected metrics and verification status for this platform.',
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
                  backgroundColor: const Color(0xFFD32F2F),
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                onPressed: () => Navigator.pop(context, true), // Disconnect
                child: Text(
                  'Disconnect $platform',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: TextButton(
                onPressed: () => Navigator.pop(context, false), // Keep
                child: const Text(
                  'Keep connected',
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
