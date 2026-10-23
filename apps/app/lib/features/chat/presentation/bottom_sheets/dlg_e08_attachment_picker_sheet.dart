import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/chat_entities.dart';

/// DLG-E08: Attachment Picker Sheet (SCR-E06, SOW §7.1)
/// Enables Camera capture, Media photos/videos, Document PDFs, and Brief links.
class DlgE08AttachmentPickerSheet extends StatelessWidget {
  final ValueChanged<AttachmentType> onSelectType;

  const DlgE08AttachmentPickerSheet({
    super.key,
    required this.onSelectType,
  });

  static Future<AttachmentType?> show(BuildContext context) {
    return showModalBottomSheet<AttachmentType>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DlgE08AttachmentPickerSheet(
        onSelectType: (type) => Navigator.pop(ctx, type),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),

          Text(
            'Share Content',
            style: AppTypography.headingMedium(color: AppColors.textPrimary),
          ),
          const SizedBox(height: 6),
          Text(
            'Select file or media to share directly in this thread',
            style: AppTypography.bodyMedium(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),

          // Action Grid / List
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildOption(
                context,
                icon: Icons.camera_alt_rounded,
                label: 'Camera',
                color: AppColors.primary,
                type: AttachmentType.image,
              ),
              _buildOption(
                context,
                icon: Icons.photo_library_rounded,
                label: 'Photos',
                color: AppColors.secondary,
                type: AttachmentType.image,
              ),
              _buildOption(
                context,
                icon: Icons.videocam_rounded,
                label: 'Video Clip',
                color: AppColors.accentPeach,
                type: AttachmentType.video,
              ),
              _buildOption(
                context,
                icon: Icons.description_rounded,
                label: 'Document',
                color: AppColors.accentSky,
                type: AttachmentType.document,
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Brief Link option
          InkWell(
            onTap: () => onSelectType(AttachmentType.brief),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.link_rounded, size: 20, color: AppColors.textPrimary),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Attach Collaboration Brief',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                        ),
                        Text(
                          'Reference active brief details and commercial milestones',
                          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Cancel Button
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text(
                'Cancel',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOption(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required AttachmentType type,
  }) {
    return GestureDetector(
      onTap: () => onSelectType(type),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(icon, color: AppColors.textPrimary, size: 26),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
