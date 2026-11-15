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

  // POP-D03: Save Profile Confirmation (Snackbar & Modal Dialog)
  static void showProfileSavedSnackbar(BuildContext context, {String? handle}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.bookmark_added_rounded, color: AppColors.primary, size: 20),
            const SizedBox(width: 10),
            Text(handle != null ? 'Added $handle to your saved collaborators list' : 'Profile saved to your bookmarked list'),
          ],
        ),
        backgroundColor: AppColors.textPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  static Future<void> showProfileSavedDialog(BuildContext context, {required String handle, VoidCallback? onViewSaved}) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: AppColors.surface,
        title: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                color: Color(0xFFE6F4EC),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.bookmark_rounded, color: AppColors.success, size: 28),
            ),
            const SizedBox(height: 12),
            Text(
              'Profile Saved',
              style: AppTypography.headingMedium().copyWith(fontSize: 18),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        content: Text(
          'Added $handle to your saved collaborators list.',
          style: AppTypography.bodyMedium().copyWith(fontSize: 13),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              onViewSaved?.call();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.textPrimary,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            ),
            child: const Text('View Saved Profiles', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Done', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w700)),
          ),
        ],
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

  // POP-D07: Offline Mode Indicator Dialog
  static Future<void> showOfflineDialog(BuildContext context, {VoidCallback? onRetry}) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: AppColors.surface,
        title: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                color: Color(0xFFFBF1DC),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.wifi_off_rounded, color: Color(0xFFC98A16), size: 28),
            ),
            const SizedBox(height: 12),
            Text(
              "You're Offline",
              style: AppTypography.headingMedium().copyWith(fontSize: 18),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        content: Text(
          'Showing previously cached creators. Connect to the internet to refresh discovery.',
          style: AppTypography.bodyMedium().copyWith(fontSize: 13),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          OutlinedButton(
            onPressed: () {
              Navigator.pop(ctx);
              onRetry?.call();
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.textPrimary,
              side: const BorderSide(color: AppColors.textPrimary, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            ),
            child: const Text('Retry Connection', style: TextStyle(fontWeight: FontWeight.w700)),
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

  // POP-D09: First Connection Request Note Modal (optional 140-char project intro note)
  static Future<String?> showFirstConnectionNoteDialog(
    BuildContext context, {
    required String recipientName,
  }) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) {
          final count = controller.text.length;
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
            backgroundColor: AppColors.surface,
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFFEBF3FE),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.send_rounded, color: Color(0xFF1B66C9), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Connect with $recipientName', style: AppTypography.headingMedium().copyWith(fontSize: 16)),
                      const Text('Add an optional project note', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: controller,
                  maxLength: 140,
                  maxLines: 3,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'e.g. Loved your summer reel! We have a campaign brief for next month...',
                    hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.backgroundSecondary,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.textPrimary, width: 1.5),
                    ),
                    counterText: '$count / 140',
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Creators with a personalized note are 3.8x more likely to accept.',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, ''),
                child: const Text('Skip & Send', style: TextStyle(color: AppColors.textSecondary)),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, controller.text.trim()),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                child: const Text('Send Note', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          );
        },
      ),
    );
  }

  // POP-D10: Unverified Social Account Warning Sheet
  static void showUnverifiedSocialWarningSheet(
    BuildContext context, {
    required String platform,
    VoidCallback? onVerifyNow,
  }) {
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
            const SizedBox(height: 20),
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                color: Color(0xFFFFF6D9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_outlined, size: 32, color: Color(0xFFC98A16)),
            ),
            const SizedBox(height: 16),
            Text(
              'Unverified $platform Profile',
              style: AppTypography.headingLarge().copyWith(fontSize: 19),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              'This $platform handle has not yet completed the Code-in-Bio ownership audit. Unverified profiles cannot apply to verified enterprise brand briefs or receive direct escrow contracts.',
              style: AppTypography.bodyMedium().copyWith(fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline_rounded, size: 20, color: AppColors.textSecondary),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Verification takes less than 2 minutes by placing a temporary security code in your bio.',
                      style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      side: const BorderSide(color: AppColors.border),
                    ),
                    child: const Text('Dismiss', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      if (onVerifyNow != null) onVerifyNow();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.textPrimary,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    child: const Text('Verify Now', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // POP-D11: Daily Search Rate Limit Notice (Anti-scraping)
  static void showDailySearchRateLimitNotice(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: AppColors.surface,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFFBE9E7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.speed_rounded, color: Color(0xFFD8483C), size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Search Rate Limit Reached',
                style: AppTypography.headingMedium().copyWith(fontSize: 16),
              ),
            ),
          ],
        ),
        content: Text(
          'To protect community privacy and prevent automated directory scraping, discovery queries are limited to 100 per hour. Please wait a few moments before searching again.',
          style: AppTypography.bodyMedium().copyWith(fontSize: 13),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.textPrimary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: const Text('Understood', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  // POP-D12: Report Profile Multi-Step Confirmation with evidence screenshot
  static Future<bool?> showMultiStepReportConfirmation(
    BuildContext context, {
    required String targetName,
    required String reason,
    required Future<void> Function(String reason, String details, bool hasEvidence) onConfirm,
  }) {
    final detailsController = TextEditingController();
    bool hasAttachedScreenshot = false;
    bool isSubmitting = false;

    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
            ),
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 36),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFBE9E7),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.flag_rounded, color: Color(0xFFD8483C), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Report $targetName', style: AppTypography.headingMedium().copyWith(fontSize: 17)),
                          Text('Category: $reason', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text('Provide additional context for moderation team:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                TextField(
                  controller: detailsController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Describe what occurred, off-platform payment solicitations, or policy violations...',
                    hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.backgroundSecondary,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.textPrimary, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                // Screenshot Evidence Toggle
                InkWell(
                  onTap: () {
                    setState(() {
                      hasAttachedScreenshot = !hasAttachedScreenshot;
                    });
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: hasAttachedScreenshot ? const Color(0xFFE6F4EC) : AppColors.backgroundSecondary,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: hasAttachedScreenshot ? AppColors.success : AppColors.border,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          hasAttachedScreenshot ? Icons.check_circle_rounded : Icons.add_photo_alternate_outlined,
                          color: hasAttachedScreenshot ? AppColors.success : AppColors.textSecondary,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            hasAttachedScreenshot ? 'Screenshot evidence attached (chat_snapshot.png)' : 'Attach screenshot evidence',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: hasAttachedScreenshot ? AppColors.success : AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text('Cancel', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                setState(() => isSubmitting = true);
                                try {
                                  await onConfirm(reason, detailsController.text.trim(), hasAttachedScreenshot);
                                  if (ctx.mounted) Navigator.pop(ctx, true);
                                } catch (_) {
                                  setState(() => isSubmitting = false);
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD8483C),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                        ),
                        child: isSubmitting
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Submit Report', style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
