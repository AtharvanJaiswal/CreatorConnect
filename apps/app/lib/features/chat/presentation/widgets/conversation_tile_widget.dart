import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/safe_image.dart';
import '../../domain/entities/chat_entities.dart';

class ConversationTileWidget extends StatelessWidget {
  final ConversationItem conversation;
  final VoidCallback onTap;
  final VoidCallback? onAcceptRequest;
  final VoidCallback? onDeclineRequest;

  const ConversationTileWidget({
    super.key,
    required this.conversation,
    required this.onTap,
    this.onAcceptRequest,
    this.onDeclineRequest,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: conversation.unreadCount > 0 ? AppColors.surfaceWarm : AppColors.surfacePure,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.borderLight, width: 1.5),
        boxShadow: const [
          BoxShadow(color: Color(0x05000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: AppColors.backgroundSecondary,
                          backgroundImage: safeNetworkImage(conversation.peerAvatar),
                          child: safeNetworkImage(conversation.peerAvatar) == null
                              ? Text(
                                  conversation.peerName.isNotEmpty ? conversation.peerName[0].toUpperCase() : '?',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary),
                                )
                              : null,
                        ),
                        if (conversation.isOnline && !conversation.isRequest)
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: AppColors.success,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  conversation.peerName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14.5,
                                    color: AppColors.textPrimary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (conversation.isPeerVerified) ...[
                                const SizedBox(width: 4),
                                const Icon(Icons.verified_rounded, size: 14, color: AppColors.primaryDark),
                              ],
                              const Spacer(),
                              Text(
                                conversation.lastMessageTime,
                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _buildSubtitle(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Last Message snippet or Quoted request
                Text(
                  conversation.lastMessage,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    color: conversation.unreadCount > 0 ? AppColors.textPrimary : AppColors.textSecondary,
                    fontWeight: conversation.unreadCount > 0 ? FontWeight.w700 : FontWeight.normal,
                    height: 1.35,
                  ),
                ),

                // If Request Tab (SCR-E02), show Accept & Decline inline actions
                if (conversation.isRequest && !conversation.isAccepted) ...[
                  const SizedBox(height: 12),
                  const Divider(height: 1, color: AppColors.borderLight),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: onDeclineRequest,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.error,
                            side: const BorderSide(color: Color(0xFFFFCDD2)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            minimumSize: const Size(0, 36),
                          ),
                          child: const Text('Decline', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: onAcceptRequest,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.textPrimary,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            minimumSize: const Size(0, 36),
                          ),
                          child: const Text('Accept Chat', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                        ),
                      ),
                    ],
                  ),
                ] else if (conversation.unreadCount > 0) ...[
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        '${conversation.unreadCount} new',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _buildSubtitle() {
    final parts = <String>[];
    if (conversation.peerRole.isNotEmpty) {
      parts.add(conversation.peerRole);
    }
    if (conversation.followers != null && conversation.followers!.isNotEmpty) {
      parts.add('${conversation.followers} followers');
    }
    if (conversation.location != null && conversation.location!.isNotEmpty) {
      parts.add(conversation.location!);
    }
    return parts.isEmpty ? 'Creator' : parts.join(' • ');
  }
}
