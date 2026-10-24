import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class PermissionExplainerSheet extends StatelessWidget {
  final String platform;

  const PermissionExplainerSheet({super.key, this.platform = 'Instagram'});

  static Future<bool?> show(BuildContext context, {String platform = 'Instagram'}) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PermissionExplainerSheet(platform: platform),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceWarm,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.shield_outlined, color: AppColors.textPrimary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Connecting with $platform',
                      style: const TextStyle(
                        fontFamily: 'Archivo',
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Official secure read-only integration',
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'WHAT CREATORCONNECT WILL ACCESS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppColors.textTertiary,
            ),
          ),
          const SizedBox(height: 12),
          _PermissionItem(
            icon: Icons.check_circle_rounded,
            iconColor: Color(0xFF2E7D32),
            title: 'Public account metrics',
            subtitle: 'Handle, follower count, and verified badge for matching brands',
          ),
          const SizedBox(height: 10),
          _PermissionItem(
            icon: Icons.check_circle_rounded,
            iconColor: Color(0xFF2E7D32),
            title: 'Public content analytics',
            subtitle: 'Average views and engagement rate over recent reels/posts',
          ),
          const SizedBox(height: 20),
          const Text(
            'WHAT CREATORCONNECT WILL NEVER ACCESS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppColors.textTertiary,
            ),
          ),
          const SizedBox(height: 12),
          _PermissionItem(
            icon: Icons.cancel_rounded,
            iconColor: Color(0xFFD32F2F),
            title: 'Direct Messages (DMs)',
            subtitle: 'We cannot read or send private chats or DMs',
          ),
          const SizedBox(height: 10),
          _PermissionItem(
            icon: Icons.cancel_rounded,
            iconColor: Color(0xFFD32F2F),
            title: 'Posting or editing permissions',
            subtitle: 'We cannot publish, delete, or comment on any media',
          ),
          const SizedBox(height: 10),
          _PermissionItem(
            icon: Icons.cancel_rounded,
            iconColor: Color(0xFFD32F2F),
            title: 'Passwords & payment cards',
            subtitle: 'Your login credentials stay encrypted directly with Meta',
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              onPressed: () => Navigator.pop(context, true),
              child: Text(
                'Continue to $platform',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text(
                'Cancel',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PermissionItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;

  const _PermissionItem({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
