import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/chat_entities.dart';
import '../controllers/chat_controllers.dart';
import '../widgets/pinned_brief_banner_widget.dart';
import '../widgets/message_bubble_widget.dart';
import '../widgets/typing_indicator_widget.dart';
import '../bottom_sheets/dlg_e08_attachment_picker_sheet.dart';
import '../bottom_sheets/dlg_e11_report_user_sheet.dart';
import '../dialogs/dlg_e09_delete_message_dialog.dart';
import '../dialogs/dlg_e10_block_user_dialog.dart';
import 'e07_attachment_viewer_screen.dart';

/// SCR-E04, SCR-E05, SCR-E06: One-to-One Chat Thread Screen
/// SOW §7.1: Features pinned collaboration brief context, yellow user bubbles,
/// double read receipt ticks, secure Cloudflare R2 file transfers, and anti-circumvention gating.
class E04ChatThreadScreen extends ConsumerStatefulWidget {
  final String conversationId;

  const E04ChatThreadScreen({
    super.key,
    required this.conversationId,
  });

  @override
  ConsumerState<E04ChatThreadScreen> createState() => _E04ChatThreadScreenState();
}

class _E04ChatThreadScreenState extends ConsumerState<E04ChatThreadScreen> {
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _isSending = false;

  @override
  void dispose() {
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleSendMessage() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;

    _textCtrl.clear();
    setState(() => _isSending = true);
    await ref.read(chatThreadProvider(widget.conversationId).notifier).sendMessage(text);
    if (mounted) setState(() => _isSending = false);
    _scrollToBottom();
  }

  Future<void> _handleAttachmentPicker() async {
    final selectedType = await DlgE08AttachmentPickerSheet.show(context);
    if (selectedType == null) return;

    if (selectedType == AttachmentType.brief) {
      const att = MessageAttachment(
        id: 'att-brief-ref',
        type: AttachmentType.brief,
        fileName: 'Summer_Reels_Brief_Link',
        fileSize: 'Link',
        url: 'https://creatorconnect.app/briefs/summer-reels',
      );
      await ref.read(chatThreadProvider(widget.conversationId).notifier).sendMessage(
        'Attached collaboration brief reference: Summer Reels Campaign',
        attachment: att,
      );
      _scrollToBottom();
      return;
    }

    if (selectedType == AttachmentType.document) {
      const att = MessageAttachment(
        id: 'att-doc-upload',
        type: AttachmentType.document,
        fileName: 'Campaign_Deliverables_v1.pdf',
        fileSize: '2.1 MB',
        url: 'https://creatorconnect.r2.cloudflarestorage.com/docs/deliverables.pdf',
        pageCount: 4,
      );
      await ref.read(chatThreadProvider(widget.conversationId).notifier).sendMessage(
        'Sharing updated deliverable timeline & deliverables spec',
        attachment: att,
      );
      _scrollToBottom();
      return;
    }

    if (selectedType == AttachmentType.video) {
      const att = MessageAttachment(
        id: 'att-vid-upload',
        type: AttachmentType.video,
        fileName: 'Reel_RoughCut_02.mp4',
        fileSize: '18.4 MB',
        url: 'https://creatorconnect.r2.cloudflarestorage.com/videos/roughcut_02.mp4',
      );
      await ref.read(chatThreadProvider(widget.conversationId).notifier).sendMessage(
        'Here is the second iteration of the 15s reel rough cut.',
        attachment: att,
      );
      _scrollToBottom();
      return;
    }

    // Default image
    const att = MessageAttachment(
      id: 'att-img-upload',
      type: AttachmentType.image,
      fileName: 'Moodboard_Palettes.png',
      fileSize: '4.8 MB',
      url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    );
    await ref.read(chatThreadProvider(widget.conversationId).notifier).sendMessage(
      'Here are the approved color palettes and moodboard reference.',
      attachment: att,
    );
    _scrollToBottom();
  }

  void _openAttachmentViewer(MessageAttachment att) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => E07AttachmentViewerScreen(attachment: att),
      ),
    );
  }

  Future<void> _handleDeleteMessage(String messageId) async {
    final choice = await DlgE09DeleteMessageDialog.show(context);
    if (choice != null) {
      await ref.read(chatThreadProvider(widget.conversationId).notifier).deleteMessage(
        messageId,
        forEveryone: choice == DeleteMessageChoice.forEveryone,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(choice == DeleteMessageChoice.forEveryone
                ? 'Message deleted for everyone'
                : 'Message deleted for you'),
          ),
        );
      }
    }
  }

  Future<void> _handleBlockUser(String peerName) async {
    final confirmed = await DlgE10BlockUserDialog.show(context, peerName: peerName);
    if (confirmed == true && mounted) {
      await ref.read(chatThreadProvider(widget.conversationId).notifier).blockUser();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$peerName has been blocked.')),
        );
        Navigator.pop(context);
      }
    }
  }

  Future<void> _handleReportUser(String peerName) async {
    final report = await DlgE11ReportUserSheet.show(context, peerName: peerName);
    if (report != null && mounted) {
      await ref.read(chatThreadProvider(widget.conversationId).notifier).reportUser(
        report.reason,
        details: report.details,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Report submitted. Safety team will investigate within 24 hours.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatThreadProvider(widget.conversationId));
    final conv = state.conversation;
    final isRequestPending = conv != null && conv.isRequest && !conv.isAccepted;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: _buildAppBar(conv),
      body: SafeArea(
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator(color: AppColors.textPrimary))
            : Column(
                children: [
                  // Pinned Brief Context Banner (SCR-E04)
                  if (conv?.pinnedBrief != null)
                    PinnedBriefBannerWidget(
                      brief: conv!.pinnedBrief!,
                      onViewBrief: () {
                        Navigator.pushNamed(
                          context,
                          '/campaigns/brief-detail',
                          arguments: conv.pinnedBrief!.id,
                        );
                      },
                    ),

                  // Messages viewport
                  Expanded(
                    child: ListView.builder(
                      controller: _scrollCtrl,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      itemCount: state.messages.length + (state.isTyping ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (state.isTyping && index == state.messages.length) {
                          return TypingIndicatorWidget(peerName: conv?.peerName);
                        }

                        final msg = state.messages[index];
                        return MessageBubbleWidget(
                          message: msg,
                          onOpenAttachment: _openAttachmentViewer,
                          onLongPress: () => _handleDeleteMessage(msg.id),
                        );
                      },
                    ),
                  ),

                  // Bottom viewport: Either SCR-E05 Locked Request State or normal input field
                  if (isRequestPending)
                    _buildLockedRequestPanel(context, conv)
                  else
                    _buildInputBar(context, _isSending),
                ],
              ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(ConversationItem? conv) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
        onPressed: () => Navigator.pop(context),
      ),
      titleSpacing: 0,
      title: Row(
        children: [
          Stack(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.backgroundSecondary,
                backgroundImage: conv != null && conv.peerAvatar.isNotEmpty
                    ? NetworkImage(conv.peerAvatar)
                    : null,
                child: conv != null && conv.peerAvatar.isEmpty
                    ? Text(
                        conv.peerName.isNotEmpty ? conv.peerName[0] : '?',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                      )
                    : null,
              ),
              if (conv?.isOnline == true)
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: const Color(0xFF22C55E),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        conv?.peerName ?? 'Chat',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    if (conv?.isPeerVerified == true) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.verified_rounded, size: 14, color: AppColors.primaryDark),
                    ],
                  ],
                ),
                Text(
                  conv?.isOnline == true
                      ? 'Active now'
                      : (conv?.lastSeen != null ? 'Last seen ${conv!.lastSeen}' : conv?.peerRole ?? ''),
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.phone_outlined, color: AppColors.textPrimary, size: 22),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Voice calls require accepted project agreement.')),
            );
          },
        ),
        PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert_rounded, color: AppColors.textPrimary),
          onSelected: (value) {
            if (conv == null) return;
            if (value == 'report') {
              _handleReportUser(conv.peerName);
            } else if (value == 'block') {
              _handleBlockUser(conv.peerName);
            }
          },
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'report',
              child: Row(
                children: [
                  Icon(Icons.flag_outlined, size: 18, color: AppColors.warning),
                  SizedBox(width: 8),
                  Text('Report Conversation', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'block',
              child: Row(
                children: [
                  Icon(Icons.block_rounded, size: 18, color: AppColors.error),
                  SizedBox(width: 8),
                  Text('Block User', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.error)),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// SCR-E05: Chat Thread - Message Request State (Locked input with caller summary)
  Widget _buildLockedRequestPanel(BuildContext context, ConversationItem conv) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Security Warning Banner (Anti-Circumvention)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Row(
              children: [
                Icon(Icons.shield_outlined, size: 16, color: AppColors.warning),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Security Reminder: Phone numbers and direct contact details are shielded until you accept this request.',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Actions: Decline, Accept, Block
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    await ref.read(chatThreadProvider(widget.conversationId).notifier).declineRequest();
                    if (context.mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Request from ${conv.peerName} declined.')),
                      );
                    }
                  },
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Decline',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textSecondary),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: () async {
                    await ref.read(chatThreadProvider(widget.conversationId).notifier).acceptRequest();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Chat with ${conv.peerName} accepted! Input unlocked.'),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Accept Request',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: () => _handleBlockUser(conv.peerName),
                icon: const Icon(Icons.block_rounded, size: 20, color: AppColors.error),
                tooltip: 'Block User',
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Normal Message Input Bar
  Widget _buildInputBar(BuildContext context, bool isSending) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Row(
        children: [
          // Attachment Button
          GestureDetector(
            onTap: _handleAttachmentPicker,
            child: Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: AppColors.backgroundSecondary,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.add_rounded, size: 24, color: AppColors.textPrimary),
            ),
          ),
          const SizedBox(width: 8),

          // Text Field
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(22),
              ),
              child: TextField(
                controller: _textCtrl,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  hintText: 'Type a message...',
                  hintStyle: TextStyle(fontSize: 14, color: AppColors.textMuted),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 10),
                ),
                onSubmitted: (_) => _handleSendMessage(),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Send Button
          GestureDetector(
            onTap: isSending ? null : _handleSendMessage,
            child: Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: isSending
                  ? const Padding(
                      padding: EdgeInsets.all(10),
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textPrimary),
                    )
                  : const Icon(Icons.send_rounded, size: 20, color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
