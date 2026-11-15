import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/connectivity_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'app_button.dart';

class OfflineScreen extends ConsumerWidget {
  final VoidCallback? onRetry;
  final Widget? cachedContent;

  const OfflineScreen({
    super.key,
    this.onRetry,
    this.cachedContent,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivity = ref.watch(networkConnectivityProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFF9E6),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.wifi_off_rounded,
                  size: 42,
                  color: Color(0xFFC98A16),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'No Connection Found',
                style: AppTypography.headingLarge(color: AppColors.textPrimary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              const Text(
                'CreatorConnect cannot reach the backend server. Your drafts, profile data, and cached feeds remain safely preserved.',
                style: TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              AppButton(
                text: connectivity.isProbing ? 'Checking Network...' : 'Retry Connection',
                isLoading: connectivity.isProbing,
                onPressed: () async {
                  if (onRetry != null) {
                    onRetry!();
                  } else {
                    await ref
                        .read(networkConnectivityProvider.notifier)
                        .probeConnectivity();
                  }
                },
              ),
              if (cachedContent != null) ...[
                const SizedBox(height: 24),
                const Divider(color: AppColors.borderLight),
                const SizedBox(height: 12),
                Expanded(child: cachedContent!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
