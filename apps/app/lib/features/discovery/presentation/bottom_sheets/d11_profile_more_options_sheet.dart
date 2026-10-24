import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../dialogs/pop_dialogs.dart';

class D11ProfileMoreOptionsSheet extends StatelessWidget {
  final String userName;
  final String userHandle;
  final String userId;
  final VoidCallback onUserBlocked;
  final void Function(String reason)? onUserReported;

  const D11ProfileMoreOptionsSheet({
    super.key,
    required this.userName,
    required this.userHandle,
    required this.userId,
    required this.onUserBlocked,
    this.onUserReported,
  });

  static void show(
    BuildContext context, {
    required String userName,
    required String userHandle,
    required String userId,
    required VoidCallback onUserBlocked,
    void Function(String reason)? onUserReported,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => D11ProfileMoreOptionsSheet(
        userName: userName,
        userHandle: userHandle,
        userId: userId,
        onUserBlocked: onUserBlocked,
        onUserReported: onUserReported,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
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
          const SizedBox(height: 16),
          Text(
            'Options for $userHandle',
            style: AppTypography.headingMedium().copyWith(fontSize: 16),
          ),
          const SizedBox(height: 12),
          ListTile(
            leading: const Icon(Icons.share_outlined, color: AppColors.textPrimary),
            title: const Text('Share Profile', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
            onTap: () {
              Navigator.pop(context);
              PopDialogs.showShareProfileSheet(context, name: userName, handle: userHandle);
            },
          ),
          ListTile(
            leading: const Icon(Icons.link_rounded, color: AppColors.textPrimary),
            title: const Text('Copy Profile Link', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
            onTap: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Profile link copied to clipboard')),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.bookmark_outline_rounded, color: AppColors.textPrimary),
            title: const Text('Save Profile to List', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
            onTap: () {
              Navigator.pop(context);
              PopDialogs.showProfileSavedSnackbar(context);
            },
          ),
          const Divider(color: AppColors.border),
          ListTile(
            leading: const Icon(Icons.block_rounded, color: AppColors.error),
            title: Text('Block $userName', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.error, fontSize: 13.5)),
            onTap: () async {
              Navigator.pop(context);
              final confirm = await PopDialogs.showBlockUserConfirmation(context, userName);
              if (confirm == true) {
                onUserBlocked();
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.flag_outlined, color: AppColors.error),
            title: Text('Report $userName', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.error, fontSize: 13.5)),
            onTap: () async {
              Navigator.pop(context);
              final reason = await PopDialogs.showReportProfileSheet(context, userName);
              if (reason != null) {
                if (onUserReported != null) {
                  onUserReported!(reason);
                }
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Report submitted for "$reason". Thank you for keeping our community safe.')),
                  );
                }
              }
            },
          ),
        ],
      ),
    );
  }
}
