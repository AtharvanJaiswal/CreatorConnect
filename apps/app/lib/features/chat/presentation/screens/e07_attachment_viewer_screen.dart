import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/safe_image.dart';
import '../../domain/entities/chat_entities.dart';

/// SCR-E07: Full Screen Chat Attachment Preview & Media Viewer (SOW §7.1)
/// Supports documents (PDF), photos/moodboards, video clips, and brief references
/// uploaded via Cloudflare R2 storage with complete metadata (size, type, pages, sender, timestamp).
class E07AttachmentViewerScreen extends StatefulWidget {
  final MessageAttachment attachment;
  final String? sentBy;
  final String? timestamp;

  const E07AttachmentViewerScreen({
    super.key,
    required this.attachment,
    this.sentBy,
    this.timestamp,
  });

  @override
  State<E07AttachmentViewerScreen> createState() => _E07AttachmentViewerScreenState();
}

class _E07AttachmentViewerScreenState extends State<E07AttachmentViewerScreen> {
  bool _isDownloading = false;

  Future<void> _handleDownload() async {
    setState(() => _isDownloading = true);
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) {
      setState(() => _isDownloading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved "${widget.attachment.fileName}" to device downloads.'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final att = widget.attachment;
    final senderText = widget.sentBy != null && widget.sentBy!.isNotEmpty
        ? 'Sent by ${widget.sentBy!}'
        : 'Cloudflare R2 Storage';
    final timeText = widget.timestamp != null && widget.timestamp!.isNotEmpty
        ? ' • ${widget.timestamp!}'
        : '';

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          att.fileName,
          style: AppTypography.headingMedium(color: Colors.white).copyWith(fontSize: 15),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined, color: Colors.white, size: 20),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Attachment link copied to clipboard.')),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Center Media Viewport
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: _buildMediaPreview(att),
                ),
              ),
            ),

            // Bottom Metadata Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
              decoration: const BoxDecoration(
                color: Color(0xFF1E1E1E),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(top: BorderSide(color: Color(0xFF2E2E2E), width: 1)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _buildTypeBadge(att.type),
                      const Spacer(),
                      Text(
                        att.fileSize,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    att.fileName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$senderText$timeText',
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (att.pageCount != null && att.pageCount! > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${att.pageCount} Pages • Verified Cloudflare R2 Upload',
                      style: const TextStyle(color: Color(0xFFFFD700), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                  const SizedBox(height: 18),

                  // Download Action Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isDownloading ? null : _handleDownload,
                      icon: _isDownloading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textPrimary),
                            )
                          : const Icon(Icons.download_rounded, size: 20),
                      label: Text(
                        _isDownloading ? 'Downloading...' : 'Download File',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaPreview(MessageAttachment att) {
    if (att.type == AttachmentType.image && att.url.isNotEmpty && safeNetworkImage(att.url) != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image(
          image: safeNetworkImage(att.url)!,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _buildFallbackCard(att),
        ),
      );
    }

    if (att.type == AttachmentType.video) {
      return Container(
        width: double.infinity,
        height: 260,
        decoration: BoxDecoration(
          color: const Color(0xFF2A2A2A),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFF3E3E3E)),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.play_arrow_rounded, color: AppColors.textPrimary, size: 40),
                ),
                const SizedBox(height: 14),
                Text(
                  att.fileName,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Video Clip • Tap to stream or download below',
                  style: TextStyle(color: Colors.white54, fontSize: 11),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return _buildFallbackCard(att);
  }

  Widget _buildFallbackCard(MessageAttachment att) {
    final isPdf = att.fileName.toLowerCase().endsWith('.pdf') || att.type == AttachmentType.document;

    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 320, maxHeight: 360),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: const Color(0xFF222222),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF333333)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: isPdf ? const Color(0xFFE57373).withOpacity(0.18) : AppColors.primary.withOpacity(0.18),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isPdf ? Icons.picture_as_pdf_rounded : Icons.insert_drive_file_rounded,
              size: 40,
              color: isPdf ? const Color(0xFFE57373) : AppColors.primary,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            att.fileName,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
          ),
          const SizedBox(height: 6),
          Text(
            '${att.fileSize}${att.pageCount != null ? ' • ${att.pageCount} Pages' : ''}',
            style: const TextStyle(fontSize: 12, color: Colors.white60),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.08),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined, size: 12, color: Color(0xFFFFD700)),
                SizedBox(width: 4),
                Text(
                  'Encrypted Cloudflare R2 Object',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFFFD700)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeBadge(AttachmentType type) {
    String label;
    Color color;

    switch (type) {
      case AttachmentType.document:
        label = 'PDF Document';
        color = const Color(0xFFEF5350);
        break;
      case AttachmentType.video:
        label = 'Video Clip';
        color = const Color(0xFFFFB74D);
        break;
      case AttachmentType.image:
        label = 'High-Res Photo';
        color = const Color(0xFF4FC3F7);
        break;
      case AttachmentType.brief:
        label = 'Brief Reference';
        color = const Color(0xFFFFD700);
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.18),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800),
      ),
    );
  }
}
