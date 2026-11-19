import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/chat_entities.dart';

class ChatBubbleWidget extends StatelessWidget {
  final ChatMessage message;
  final VoidCallback? onDelete;
  final VoidCallback? onAttachmentTap;

  const ChatBubbleWidget({
    super.key,
    required this.message,
    this.onDelete,
    this.onAttachmentTap,
  });

  @override
  Widget build(BuildContext context) {
    final isMe = message.isMe;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: onDelete,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          constraints: const BoxConstraints(maxWidth: 300),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isMe ? AppColors.primary : AppColors.surfacePure,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(isMe ? 16 : 4),
              bottomRight: Radius.circular(isMe ? 4 : 16),
            ),
            border: Border.all(
              color: isMe ? AppColors.primaryDark : AppColors.borderLight,
              width: 1.5,
            ),
            boxShadow: const [
              BoxShadow(color: Color(0x04000000), blurRadius: 4, offset: Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Attachment Card if present
              if (message.attachment != null) ...[
                InkWell(
                  onTap: onAttachmentTap,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: isMe ? Colors.white.withOpacity(0.2) : AppColors.surfaceWarm,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.picture_as_pdf_rounded, size: 28, color: AppColors.error),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                message.attachment!.fileName,
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: isMe ? AppColors.textPrimary : AppColors.textPrimary),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                '${message.attachment!.fileSize} • PDF Document',
                                style: TextStyle(fontSize: 10.5, color: isMe ? AppColors.textSecondary : AppColors.textMuted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],

              // Message text (with anti-circumvention shielding support)
              Text(
                message.displayText,
                style: TextStyle(
                  fontSize: 13.5,
                  color: isMe ? AppColors.textPrimary : AppColors.textPrimary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 4),

              // Timestamp & Read Receipt
              Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    _formatTime(message.timestamp),
                    style: TextStyle(
                      fontSize: 10,
                      color: isMe ? AppColors.textSecondary : AppColors.textMuted,
                    ),
                  ),
                  if (isMe) ...[
                    const SizedBox(width: 4),
                    Icon(
                      message.status == MessageStatus.read ? Icons.done_all_rounded : Icons.done_rounded,
                      size: 13,
                      color: message.status == MessageStatus.read ? const Color(0xFF1976D2) : AppColors.textSecondary,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final m = dt.minute.toString().padLeft(2, '0');
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    return '$h:$m $ampm';
  }
}
