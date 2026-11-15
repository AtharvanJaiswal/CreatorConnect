import 'package:flutter/material.dart';
import '../../errors/app_exception.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_typography.dart';
import '../app_button.dart';

class AppErrorDialog extends StatelessWidget {
  final AppException exception;
  final VoidCallback? onRetry;
  final VoidCallback? onDismiss;

  const AppErrorDialog({
    super.key,
    required this.exception,
    this.onRetry,
    this.onDismiss,
  });

  static Future<void> show(
    BuildContext context, {
    required AppException exception,
    VoidCallback? onRetry,
    VoidCallback? onDismiss,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => AppErrorDialog(
        exception: exception,
        onRetry: onRetry,
        onDismiss: onDismiss,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isTimeout = exception is NetworkTimeoutException || exception is OfflineException;
    final isConflict = exception is ConflictException;
    final isAuth = exception is UnauthorizedException || exception is ForbiddenException;

    final Color badgeBg = isAuth
        ? const Color(0xFFFFF0F0)
        : (isTimeout ? const Color(0xFFFFF9E6) : const Color(0xFFF3F4F6));
    final Color badgeIconColor = isAuth
        ? AppColors.error
        : (isTimeout ? const Color(0xFFC98A16) : AppColors.textPrimary);
    final IconData icon = isAuth
        ? Icons.lock_outline_rounded
        : (isTimeout ? Icons.wifi_off_rounded : (isConflict ? Icons.warning_amber_rounded : Icons.error_outline_rounded));

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon & Title Header
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: badgeBg,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: badgeIconColor, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    exception.title,
                    style: AppTypography.headingMedium(color: AppColors.textPrimary),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // User-friendly plain guidance message
            Text(
              exception.message,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 14),

            // Technical Details Badge (RFC 7807 metadata)
            if (exception.statusCode != null || exception.code != null || exception.requestId != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F9FA),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE9ECEF)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (exception.statusCode != null)
                      Text(
                        'HTTP Status: ${exception.statusCode}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textMuted,
                          fontFamily: 'monospace',
                        ),
                      ),
                    if (exception.code != null && exception.code!.isNotEmpty)
                      Text(
                        'Error Code: ${exception.code}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textMuted,
                          fontFamily: 'monospace',
                        ),
                      ),
                    if (exception.requestId != null && exception.requestId!.isNotEmpty)
                      Text(
                        'Request ID: ${exception.requestId}',
                        style: const TextStyle(
                          fontSize: 10.5,
                          color: AppColors.textMuted,
                          fontFamily: 'monospace',
                        ),
                      ),
                  ],
                ),
              ),

            const SizedBox(height: 20),

            // Action Buttons: Retry and Close
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      onDismiss?.call();
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    child: const Text(
                      'Dismiss',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
                if (onRetry != null) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      text: 'Retry',
                      height: 44,
                      onPressed: () {
                        Navigator.of(context).pop();
                        onRetry?.call();
                      },
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

