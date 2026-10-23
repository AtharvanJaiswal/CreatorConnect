import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/chat_entities.dart';

class Dlg016AttachmentPickerSheet extends StatelessWidget {
  const Dlg016AttachmentPickerSheet({super.key});

  static Future<AttachmentType?> show(BuildContext context) {
    return showModalBottomSheet<AttachmentType>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => const Dlg016AttachmentPickerSheet(),
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
          const Text(
            'Share Attachment',
            style: TextStyle(fontFamily: 'Archivo', fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 16),
          ListTile(
            leading: const CircleAvatar(backgroundColor: Color(0xFFE3F2FD), child: Icon(Icons.image_rounded, color: Color(0xFF1976D2))),
            title: const Text('Photos & Gallery', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            subtitle: const Text('Send high-resolution images'),
            onTap: () => Navigator.pop(context, AttachmentType.image),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          ListTile(
            leading: const CircleAvatar(backgroundColor: Color(0xFFFFF3E0), child: Icon(Icons.videocam_rounded, color: Color(0xFFF57C00))),
            title: const Text('Video Clip', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            subtitle: const Text('Share 4K raw or rough cut videos'),
            onTap: () => Navigator.pop(context, AttachmentType.video),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          ListTile(
            leading: const CircleAvatar(backgroundColor: Color(0xFFFFEBEE), child: Icon(Icons.picture_as_pdf_rounded, color: AppColors.error)),
            title: const Text('Document or PDF Brief', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            subtitle: const Text('Upload PDF guidelines or invoices (max 10MB)'),
            onTap: () => Navigator.pop(context, AttachmentType.document),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ],
      ),
    );
  }
}
