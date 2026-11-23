import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/repositories/applications_invites_repository.dart';
import '../../domain/entities/invitation_entities.dart';
import '../bottom_sheets/dlg_52_invite_sent_sheet.dart';
import '../controllers/applications_invites_controllers.dart';

/// H04: Send Direct Invite or Collaboration Request (Master Catalogue §H, Page 9 & 23)
class H04SendInviteScreen extends ConsumerStatefulWidget {
  final String recipientId;
  final String recipientName;
  final String recipientRole;
  final String? recipientAvatarUrl;
  final String followerCount;

  const H04SendInviteScreen({
    super.key,
    required this.recipientId,
    required this.recipientName,
    required this.recipientRole,
    this.recipientAvatarUrl,
    this.followerCount = '185K followers',
  });

  @override
  ConsumerState<H04SendInviteScreen> createState() => _H04SendInviteScreenState();
}

class _H04SendInviteScreenState extends ConsumerState<H04SendInviteScreen> {
  final _formKey = GlobalKey<FormState>();
  InviteType _inviteType = InviteType.paidHire;
  late final TextEditingController _titleController;
  late final TextEditingController _budgetController;
  late final TextEditingController _messageController;
  final List<String> _deliverables = [
    '1x Dedicated Instagram Reel (60s)',
    '2x Supporting Instagram Stories',
  ];
  final TextEditingController _deliverableInputController =
      TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _titleController =
        TextEditingController(text: 'Monsoon Activewear Dedicated Reel');
    _budgetController = TextEditingController(text: '22000');
    _messageController = TextEditingController(
      text:
          'We love your fashion transitions and would love to collaborate on styling 2 pieces from our upcoming waterproof activewear line.',
    );
  }

  @override
  void dispose() {
    _titleController.dispose();
    _budgetController.dispose();
    _messageController.dispose();
    _deliverableInputController.dispose();
    super.dispose();
  }

  void _addDeliverable() {
    final text = _deliverableInputController.text.trim();
    if (text.isNotEmpty) {
      setState(() {
        _deliverables.add(text);
        _deliverableInputController.clear();
      });
    }
  }

  void _removeDeliverable(int index) {
    setState(() {
      _deliverables.removeAt(index);
    });
  }

  Future<void> _handleSend() async {
    final title = _titleController.text.trim();
    final message = _messageController.text.trim();
    final budget = int.tryParse(_budgetController.text) ?? 0;

    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide a campaign title.')),
      );
      return;
    }

    if (message.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please include private brief details.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final repo = ref.read(applicationsInvitesRepositoryProvider);
    try {
      await repo.sendDirectInvite(
        recipientId: widget.recipientId,
        recipientName: widget.recipientName,
        recipientRole: widget.recipientRole,
        recipientAvatarUrl: widget.recipientAvatarUrl,
        projectTitle: title,
        inviteType: _inviteType,
        budgetOffered: _inviteType == InviteType.paidHire ? budget : 0,
        message: message,
        deliverables: _deliverables,
        expiresInDays: 7,
      );

      ref.read(invitationsProvider.notifier).loadAll();

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      // Trigger DLG-52 Confirmation Sheet
      Dlg52InviteSentSheet.show(
        context,
        recipientName: widget.recipientName,
        budgetOffered: _inviteType == InviteType.paidHire ? budget : 0,
        onTrackSentInvites: () {
          Navigator.pushReplacementNamed(context, '/invites/sent');
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error sending invite: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Send Direct Invite',
          style: AppTypography.headingMedium().copyWith(fontSize: 16),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Recipient Card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: AppColors.textPrimary, width: 1.5),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          widget.recipientName.isNotEmpty
                              ? widget.recipientName[0].toUpperCase()
                              : 'T',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  widget.recipientName,
                                  style: AppTypography.headingMedium().copyWith(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.verified,
                                    size: 15, color: AppColors.success),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${widget.recipientRole} · ${widget.followerCount}',
                              style: AppTypography.caption(
                                color: AppColors.textMuted,
                              ).copyWith(fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // Collaboration Type Toggle (Hire vs Collab)
                Text(
                  'INVITE TYPE',
                  style: AppTypography.label(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.backgroundSecondary,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.border),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(
                              () => _inviteType = InviteType.paidHire),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _inviteType == InviteType.paidHire
                                  ? AppColors.textPrimary
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              'Paid Hire',
                              style: TextStyle(
                                color: _inviteType == InviteType.paidHire
                                    ? Colors.white
                                    : AppColors.textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(
                              () => _inviteType = InviteType.peerCollab),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _inviteType == InviteType.peerCollab
                                  ? AppColors.textPrimary
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              'Peer Collab',
                              style: TextStyle(
                                color: _inviteType == InviteType.peerCollab
                                    ? Colors.white
                                    : AppColors.textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // Title
                Text(
                  'CAMPAIGN / PROJECT TITLE',
                  style: AppTypography.label(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  child: TextFormField(
                    controller: _titleController,
                    style: AppTypography.headingMedium().copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: 'e.g. Festive Collection Video Shoot',
                    ),
                  ),
                ),

                if (_inviteType == InviteType.paidHire) ...[
                  const SizedBox(height: 18),
                  // Budget Offer
                  Text(
                    'OFFERED BUDGET (₹ INR)',
                    style: AppTypography.label(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border, width: 1.5),
                    ),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    child: TextFormField(
                      controller: _budgetController,
                      keyboardType: TextInputType.number,
                      style: AppTypography.headingMedium().copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        prefixText: '₹ ',
                        prefixStyle: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                        hintText: '25,000',
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 18),

                // Private Message / Brief
                Text(
                  'PRIVATE BRIEF & INSTRUCTIONS',
                  style: AppTypography.label(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: TextFormField(
                    controller: _messageController,
                    maxLines: 4,
                    maxLength: 2000,
                    style: AppTypography.bodyMedium(
                      color: AppColors.textPrimary,
                    ).copyWith(fontSize: 13),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText:
                          'Describe what you love about their work, campaign goals, key deliverables, and schedule expectations...',
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // Deliverables Builder
                Text(
                  'EXPECTED DELIVERABLES',
                  style: AppTypography.label(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                for (int i = 0; i < _deliverables.length; i++) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle_outline,
                            size: 16, color: AppColors.success),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _deliverables[i],
                            style: AppTypography.caption(
                              color: AppColors.textPrimary,
                            ).copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close,
                              size: 14, color: AppColors.textMuted),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () => _removeDeliverable(i),
                        ),
                      ],
                    ),
                  ),
                ],
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: TextField(
                          controller: _deliverableInputController,
                          style: const TextStyle(fontSize: 12),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            hintText: 'e.g. 1x Raw footage export',
                            isDense: true,
                          ),
                          onSubmitted: (_) => _addDeliverable(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _addDeliverable,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.textPrimary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        minimumSize: const Size(0, 38),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                      ),
                      child: const Text('+ Add',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // 7-day auto-expiry Notice Box
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFBF1DC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFE486)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.access_time_rounded,
                          size: 18, color: Color(0xFF9A6700)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Direct invitations auto-expire after 7 days if unaccepted. Your invite quota will be restored if expired.',
                          style: AppTypography.caption(
                            color: const Color(0xFF8C6A0A),
                          ).copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Submit Button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _handleSend,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.textPrimary,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
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
                        : Text(
                            'Send Private Invitation →',
                            style: AppTypography.buttonLarge().copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
