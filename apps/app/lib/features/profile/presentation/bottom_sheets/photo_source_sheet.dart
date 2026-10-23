import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

enum PhotoSourceAction {
  camera,
  gallery,
  remove,
}

class PhotoSourceSheet extends StatelessWidget {
  final bool hasExistingPhoto;

  const PhotoSourceSheet({
    super.key,
    this.hasExistingPhoto = false,
  });

  static Future<PhotoSourceAction?> show(BuildContext context, {bool hasExistingPhoto = false}) {
    return showModalBottomSheet<PhotoSourceAction>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => PhotoSourceSheet(hasExistingPhoto: hasExistingPhoto),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceWarm,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.borderLight,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Change profile photo',
            style: TextStyle(
              fontFamily: 'Archivo',
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Choose how you want to upload your photo',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 24),
          _OptionTile(
            icon: Icons.camera_alt_outlined,
            title: 'Take photo',
            subtitle: 'Use your camera to snap a new picture',
            onTap: () => Navigator.pop(context, PhotoSourceAction.camera),
          ),
          const SizedBox(height: 12),
          _OptionTile(
            icon: Icons.photo_library_outlined,
            title: 'Choose from gallery',
            subtitle: 'Select an existing portrait from your photos',
            onTap: () => Navigator.pop(context, PhotoSourceAction.gallery),
          ),
          if (hasExistingPhoto) ...[
            const SizedBox(height: 12),
            _OptionTile(
              icon: Icons.delete_outline,
              title: 'Remove photo',
              subtitle: 'Revert to default initials avatar',
              isDestructive: true,
              onTap: () => Navigator.pop(context, PhotoSourceAction.remove),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                side: const BorderSide(color: AppColors.borderLight, width: 1.5),
              ),
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Cancel',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool isDestructive;

  const _OptionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isDestructive ? const Color(0xFFD32F2F) : AppColors.textPrimary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surfacePure,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDestructive ? const Color(0xFFFFCDD2) : AppColors.borderLight,
            width: 1.2,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDestructive ? const Color(0xFFFFEBEE) : AppColors.surfaceWarm,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDestructive ? const Color(0xFFE57373) : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: isDestructive ? const Color(0xFFEF9A9A) : AppColors.textTertiary,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
