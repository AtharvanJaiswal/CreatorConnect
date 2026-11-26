import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/safe_image.dart';
import '../../domain/entities/chat_entities.dart';

class MessageBubbleWidget extends StatelessWidget {
  final ChatMessage message;
  final VoidCallback? onLongPress;
  final ValueChanged<MessageAttachment>? onOpenAttachment;
  final bool showAvatar;
  final bool showSenderName;
  final String? peerAvatar;
  final String? peerName;
  final bool isFirstInGroup;
  final bool isLastInGroup;

  const MessageBubbleWidget({
    super.key,
    required this.message,
    this.onLongPress,
    this.onOpenAttachment,
    this.showAvatar = true,
    this.showSenderName = true,
    this.peerAvatar,
    this.peerName,
    this.isFirstInGroup = true,
    this.isLastInGroup = true,
  });

  @override
  Widget build(BuildContext context) {
    final isMe = message.isMe;

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 6 * (1.0 - value)),
          child: Opacity(
            opacity: value.clamp(0.0, 1.0),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: isFirstInGroup ? 6 : 2,
          bottom: isLastInGroup ? 6 : 2,
        ),
        child: isMe ? _buildSentBubble(context) : _buildReceivedBubble(context),
      ),
    );
  }

  /// Sent Message (Current Logged-in User — RIGHT)
  Widget _buildSentBubble(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Flexible(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.75,
            ),
            child: GestureDetector(
              onLongPress: onLongPress,
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                decoration: BoxDecoration(
                  color: AppColors.primary, // #FFD64A
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(18),
                    topRight: Radius.circular(isFirstInGroup ? 18 : 6),
                    bottomLeft: const Radius.circular(18),
                    bottomRight: Radius.circular(isLastInGroup ? 4 : 6),
                  ),
                  border: Border.all(
                    color: const Color(0xFFE5BE32),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Attachment Preview (if any)
                    if (message.attachment != null) ...[
                      _buildAttachmentPreview(context, message.attachment!),
                      const SizedBox(height: 6),
                    ],

                    // Text Content
                    if (message.text.isNotEmpty)
                      Text(
                        message.displayText,
                        style: const TextStyle(
                          fontSize: 14,
                          height: 1.4,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textPrimary,
                        ),
                      ),

                    const SizedBox(height: 4),

                    // Timestamp & Read Receipt Tick marks
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _formatTime(message.timestamp),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textPrimary.withOpacity(0.7),
                          ),
                        ),
                        const SizedBox(width: 4),
                        _buildReceiptTicks(message.status),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Received Message (Other Participant — LEFT)
  Widget _buildReceivedBubble(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Avatar on the left alongside bubble group
        if (showAvatar)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: CircleAvatar(
              radius: 14,
              backgroundColor: AppColors.backgroundSecondary,
              backgroundImage: safeNetworkImage(peerAvatar ?? message.senderAvatar),
              child: safeNetworkImage(peerAvatar ?? message.senderAvatar) == null
                  ? Text(
                      (peerName ?? message.senderName).isNotEmpty
                          ? (peerName ?? message.senderName)[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    )
                  : null,
            ),
          )
        else
          const SizedBox(width: 28), // Maintain indentation for consecutive messages
        const SizedBox(width: 8),

        // Bubble Column with Sender Name above
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (showSenderName)
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 4),
                  child: Text(
                    peerName ?? message.senderName,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.75,
                ),
                child: GestureDetector(
                  onLongPress: onLongPress,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(isFirstInGroup ? 18 : 6),
                        topRight: const Radius.circular(18),
                        bottomRight: const Radius.circular(18),
                        bottomLeft: Radius.circular(isLastInGroup ? 4 : 6),
                      ),
                      border: Border.all(
                        color: AppColors.border,
                        width: 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Attachment Preview (if any)
                        if (message.attachment != null) ...[
                          _buildAttachmentPreview(context, message.attachment!),
                          const SizedBox(height: 6),
                        ],

                        // Text Content
                        if (message.text.isNotEmpty)
                          Text(
                            message.displayText,
                            style: const TextStyle(
                              fontSize: 14,
                              height: 1.4,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textPrimary,
                            ),
                          ),

                        // Anti-circumvention notice badge
                        if (message.isSecurityShielded) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.backgroundSecondary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.shield_outlined, size: 12, color: AppColors.warning),
                                SizedBox(width: 4),
                                Text(
                                  'Contact shielded until request accepted',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.warning,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 4),

                        // Timestamp
                        Text(
                          _formatTime(message.timestamp),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAttachmentPreview(BuildContext context, MessageAttachment att) {
    if (att.type == AttachmentType.document) {
      return InkWell(
        onTap: () => onOpenAttachment?.call(att),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.picture_as_pdf_rounded, color: AppColors.error, size: 24),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      att.fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${att.fileSize}${att.pageCount != null ? ' • ${att.pageCount} Pages' : ''}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_downward_rounded, size: 18, color: AppColors.textPrimary),
            ],
          ),
        ),
      );
    }

    if (att.type == AttachmentType.video) {
      return InkWell(
        onTap: () => onOpenAttachment?.call(att),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.accentPeach,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.play_circle_fill_rounded, color: AppColors.textPrimary, size: 24),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      att.fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Video Clip • ${att.fileSize}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.download_rounded, size: 18, color: AppColors.textPrimary),
            ],
          ),
        ),
      );
    }

    if (att.type == AttachmentType.image && att.url.isNotEmpty && safeNetworkImage(att.url) != null) {
      return InkWell(
        onTap: () => onOpenAttachment?.call(att),
        borderRadius: BorderRadius.circular(12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 140,
            width: double.infinity,
            decoration: BoxDecoration(
              color: AppColors.backgroundSecondary,
              image: DecorationImage(
                image: safeNetworkImage(att.url)!,
                fit: BoxFit.cover,
              ),
            ),
          ),
        ),
      );
    }

    // Default image / brief preview
    return InkWell(
      onTap: () => onOpenAttachment?.call(att),
      borderRadius: BorderRadius.circular(12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 110,
          width: double.infinity,
          color: AppColors.backgroundSecondary,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  att.type == AttachmentType.brief ? Icons.link_rounded : Icons.image_rounded,
                  size: 32,
                  color: AppColors.textMuted,
                ),
                const SizedBox(height: 4),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    att.fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildReceiptTicks(MessageStatus status) {
    switch (status) {
      case MessageStatus.pending:
        return const Icon(Icons.access_time_rounded, size: 12, color: AppColors.textPrimary);
      case MessageStatus.sent:
        return const Icon(Icons.check_rounded, size: 13, color: AppColors.textPrimary);
      case MessageStatus.delivered:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.done_all_rounded, size: 14, color: AppColors.textSecondary),
          ],
        );
      case MessageStatus.read:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.done_all_rounded, size: 14, color: AppColors.textPrimary),
          ],
        );
    }
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final minute = dt.minute.toString().padLeft(2, '0');
    final period = dt.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }
}
