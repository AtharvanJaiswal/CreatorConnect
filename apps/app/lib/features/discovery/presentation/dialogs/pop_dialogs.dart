import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class PopDialogs {
  // POP-D01: Location Permission Primer
  static Future<bool?> showLocationPrimer(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: AppColors.surface,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFFFF9E6),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.location_on_rounded, color: Color(0xFFC98A16), size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Find Creators Near You',
                style: AppTypography.headingMedium().copyWith(fontSize: 16),
              ),
            ),
          ],
        ),
        content: Text(
          'Allow CreatorConnect to access your approximate location to highlight local opportunities and nearby verified collaborators in your city.',
          style: AppTypography.bodyMedium().copyWith(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Not Now', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.textPrimary,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: const Text('Enable Location', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  // POP-D02: Connection Quota Paywall (Free tier 5/day ceiling)
  static void showQuotaPaywall(BuildContext context, {VoidCallback? onUpgrade}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 24),
            Container(
              width: 60,
              height: 60,
              decoration: const BoxDecoration(
                color: Color(0xFFFFF2D6),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.bolt_rounded, size: 36, color: Color(0xFFC98A16)),
            ),
            const SizedBox(height: 16),
            Text(
              'Daily Outreach Limit Reached',
              style: AppTypography.headingLarge().copyWith(fontSize: 20),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              'Free accounts are limited to 5 direct connection requests per day to maintain collaboration quality. Upgrade to Creator Pro for unlimited outreach and priority responses.',
              style: AppTypography.bodyMedium().copyWith(fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  onUpgrade?.call();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                child: const Text(
                  'Upgrade to Creator Pro (₹499/mo) →',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Wait until tomorrow', style: TextStyle(color: AppColors.textSecondary)),
            ),
          ],
        ),
      ),
    );
  }

  // POP-D03: Save Profile Confirmation
  static void showProfileSavedSnackbar(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(
          children: [
            Icon(Icons.bookmark_added_rounded, color: AppColors.primary, size: 20),
            SizedBox(width: 10),
            Text('Profile saved to your bookmarked list'),
          ],
        ),
        backgroundColor: AppColors.textPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  // POP-D04: Block User Confirmation
  static Future<bool?> showBlockUserConfirmation(BuildContext context, String name) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: AppColors.surface,
        title: Text('Block $name?', style: AppTypography.headingMedium().copyWith(fontSize: 17)),
        content: Text(
          'They will not be able to message you, view your profile, or discover your briefs. This user will immediately disappear from your search results.',
          style: AppTypography.bodyMedium().copyWith(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: const Text('Block User', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  // POP-D05: Report Profile Reason Selector
  static Future<String?> showReportProfileSheet(BuildContext context, String name) {
    final reasons = [
      'Inappropriate / Offensive content',
      'Spam or fake profile / Bot activity',
      'Off-platform payment solicitation',
      'Harassment or impersonation',
      'Intellectual property / Copyright violation',
    ];

    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text('Report $name', style: AppTypography.headingLarge().copyWith(fontSize: 18)),
            const SizedBox(height: 6),
            Text(
              'Select a reason for moderation review. Reports are confidential.',
              style: AppTypography.bodyMedium().copyWith(fontSize: 12),
            ),
            const SizedBox(height: 16),
            ...reasons.map((reason) {
              return ListTile(
                title: Text(
                  reason,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                trailing: const Icon(Icons.chevron_right, size: 20, color: AppColors.textMuted),
                contentPadding: EdgeInsets.zero,
                onTap: () => Navigator.pop(ctx, reason),
              );
            }),
          ],
        ),
      ),
    );
  }

  // POP-D06: Reset Filters Confirmation
  static Future<bool?> showResetFiltersConfirmation(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: AppColors.surface,
        title: Text('Reset All Filters?', style: AppTypography.headingMedium().copyWith(fontSize: 16)),
        content: const Text(
          'This will restore all search criteria and sliders to default values.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.textPrimary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: const Text('Reset', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  // POP-D08: Share Profile Bottom Sheet
  static void showShareProfileSheet(BuildContext context, {required String name, required String handle}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 18, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text('Share Profile', style: AppTypography.headingMedium().copyWith(fontSize: 18)),
            const SizedBox(height: 4),
            Text('Share $name ($handle) with your network', style: AppTypography.bodyMedium().copyWith(fontSize: 12)),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _shareItem(
                  icon: Icons.chat_bubble_rounded,
                  color: const Color(0xFF25D366),
                  label: 'WhatsApp',
                  onTap: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Opening WhatsApp share...')),
                    );
                  },
                ),
                _shareItem(
                  icon: Icons.camera_alt_rounded,
                  color: const Color(0xFFE1306C),
                  label: 'Instagram',
                  onTap: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Opening Instagram Story...')),
                    );
                  },
                ),
                _shareItem(
                  icon: Icons.link_rounded,
                  color: AppColors.textPrimary,
                  label: 'Copy Link',
                  onTap: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Profile link copied to clipboard!')),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static Widget _shareItem({
    required IconData icon,
    required Color color,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
