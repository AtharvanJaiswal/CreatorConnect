import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/safe_image.dart';
import '../controllers/chat_controllers.dart';

/// DLG-SEND-REQ: Introductory Message Request Composer Bottom Sheet
/// SOW §7.1 & Phase 19F: Allows composing a plain-text introductory message
/// (1-500 characters) to initiate conversation consent with an unverified or new peer.
class DlgSendMessageRequestSheet extends ConsumerStatefulWidget {
  final String recipientId;
  final String recipientName;
  final String? recipientHandle;
  final String? recipientAvatar;
  final String? recipientRole;
  final bool isVerified;

  const DlgSendMessageRequestSheet({
    super.key,
    required this.recipientId,
    required this.recipientName,
    this.recipientHandle,
    this.recipientAvatar,
    this.recipientRole,
    this.isVerified = false,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String recipientId,
    required String recipientName,
    String? recipientHandle,
    String? recipientAvatar,
    String? recipientRole,
    bool isVerified = false,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: DlgSendMessageRequestSheet(
          recipientId: recipientId,
          recipientName: recipientName,
          recipientHandle: recipientHandle,
          recipientAvatar: recipientAvatar,
          recipientRole: recipientRole,
          isVerified: isVerified,
        ),
      ),
    );
  }

  @override
  ConsumerState<DlgSendMessageRequestSheet> createState() =>
      _DlgSendMessageRequestSheetState();
}

class _DlgSendMessageRequestSheetState
    extends ConsumerState<DlgSendMessageRequestSheet> {
  final _textCtrl = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  static const int _maxChars = 500;

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) {
      setState(() => _errorMessage = 'Please enter an introductory message.');
      return;
    }
    if (text.length > _maxChars) {
      setState(() => _errorMessage = 'Message cannot exceed $_maxChars characters.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(chatRepositoryProvider);
      await repo.createMessageRequest(
        recipientId: widget.recipientId,
        initialMessage: text,
      );

      // Invalidate/refresh conversations inbox
      ref.read(conversationsProvider.notifier).loadInbox();

      if (mounted) {
        setState(() => _isSubmitting = false);
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Message request sent to ${widget.recipientName}! They will review it shortly.',
            ),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);

      final errStr = e.toString().toLowerCase();
      if (errStr.contains('409') || errStr.contains('conflict') || errStr.contains('already')) {
        setState(() {
          _errorMessage =
              'You already have a pending message request or active conversation with this user.';
        });
      } else if (errStr.contains('429') || errStr.contains('rate limit')) {
        setState(() {
          _errorMessage =
              'Rate limit exceeded. You can send up to 10 message requests per hour.';
        });
      } else if (errStr.contains('403') || errStr.contains('forbidden')) {
        setState(() {
          _errorMessage =
              'Unable to message this user due to privacy or block restrictions.';
        });
      } else {
        setState(() {
          _errorMessage =
              'Failed to send request: ${e.toString().split('\n').first.replaceAll('Exception:', '').trim()}';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final charCount = _textCtrl.text.length;
    final isOverLimit = charCount > _maxChars;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text(
                'Send Message Request',
                style: AppTypography.headingMedium(color: AppColors.textPrimary),
              ),
              const SizedBox(height: 4),
              Text(
                'Send an introductory note to start a conversation. Once accepted, you can chat freely.',
                style: AppTypography.caption(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),

              // Recipient preview card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.backgroundSecondary,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: Colors.white,
                      backgroundImage: safeNetworkImage(widget.recipientAvatar),
                      child: safeNetworkImage(widget.recipientAvatar) == null
                          ? Text(
                              widget.recipientName.isNotEmpty
                                  ? widget.recipientName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                color: AppColors.textPrimary,
                              ),
                            )
                          : null,
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
                                  widget.recipientName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    color: AppColors.textPrimary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (widget.isVerified) ...[
                                const SizedBox(width: 4),
                                const Icon(
                                  Icons.verified_rounded,
                                  size: 14,
                                  color: AppColors.primaryDark,
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.recipientHandle ??
                                widget.recipientRole ??
                                'Creator',
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Anti-circumvention note
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
                        'Direct contact information (phone, email, links) will be shielded until accepted.',
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
              const SizedBox(height: 16),

              // Text Area
              Container(
                decoration: BoxDecoration(
                  color: AppColors.backgroundSecondary,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isOverLimit
                        ? AppColors.error
                        : AppColors.borderLight,
                    width: isOverLimit ? 1.5 : 1.0,
                  ),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    TextField(
                      controller: _textCtrl,
                      maxLines: 4,
                      maxLength: _maxChars,
                      buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                      onChanged: (_) => setState(() => _errorMessage = null),
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textPrimary,
                      ),
                      decoration: const InputDecoration(
                        hintText: 'Introduce yourself and describe why you\'d like to connect...',
                        hintStyle: TextStyle(
                          fontSize: 13.5,
                          color: AppColors.textMuted,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          '$charCount / $_maxChars',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: isOverLimit
                                ? AppColors.error
                                : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              if (_errorMessage != null) ...[
                const SizedBox(height: 10),
                Text(
                  _errorMessage!,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.error,
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // Actions
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _isSubmitting || isOverLimit || charCount == 0
                          ? null
                          : _handleSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textPrimary,
                        disabledBackgroundColor: AppColors.primary.withOpacity(0.4),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.textPrimary,
                              ),
                            )
                          : const Text(
                              'Send Request',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                            ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
