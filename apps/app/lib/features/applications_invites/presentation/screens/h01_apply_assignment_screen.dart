import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/repositories/applications_invites_repository.dart';
import '../../domain/entities/application_entities.dart';
import '../bottom_sheets/dlg_48_application_sent_sheet.dart';
import '../bottom_sheets/dlg_49_quota_reached_sheet.dart';
import '../controllers/applications_invites_controllers.dart';
import '../dialogs/dlg_51_already_applied_dialog.dart';

/// H01: Apply to Assignment Screen (Master Catalogue §H, Page 9 & 23)
class H01ApplyAssignmentScreen extends ConsumerStatefulWidget {
  final String assignmentId;
  final String assignmentTitle;
  final String brandName;
  final String location;
  final int assignmentBudget;

  const H01ApplyAssignmentScreen({
    super.key,
    required this.assignmentId,
    required this.assignmentTitle,
    required this.brandName,
    this.location = 'Mumbai',
    required this.assignmentBudget,
  });

  @override
  ConsumerState<H01ApplyAssignmentScreen> createState() =>
      _H01ApplyAssignmentScreenState();
}

class _H01ApplyAssignmentScreenState
    extends ConsumerState<H01ApplyAssignmentScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _pitchController;
  late final TextEditingController _rateController;
  late final TextEditingController _daysController;

  final List<PortfolioAttachment> _attachments = [
    const PortfolioAttachment(
      id: 'sample-1',
      title: 'Festive_Reel.mp4',
      url: 'https://cdn.creatorconnect.io/samples/festive.mp4',
      type: 'video',
    ),
    const PortfolioAttachment(
      id: 'sample-2',
      title: 'Fashion Lookbook',
      url: 'https://instagram.com/p/sample',
      type: 'link',
    ),
  ];

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _pitchController = TextEditingController();
    _rateController =
        TextEditingController(text: widget.assignmentBudget.toString());
    _daysController = TextEditingController(text: '4');
    _pitchController.addListener(() => setState(() {}));
    _rateController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _pitchController.dispose();
    _rateController.dispose();
    _daysController.dispose();
    super.dispose();
  }

  void _addSample() {
    if (_attachments.length >= 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 3 portfolio samples allowed.')),
      );
      return;
    }
    setState(() {
      _attachments.add(
        PortfolioAttachment(
          id: 'sample-${_attachments.length + 1}',
          title: 'Brand_Collaboration_${_attachments.length + 1}.pdf',
          url: 'https://cdn.creatorconnect.io/sample.pdf',
          type: 'pdf',
        ),
      );
    });
  }

  void _removeSample(int index) {
    setState(() {
      _attachments.removeAt(index);
    });
  }

  Future<void> _handleSubmit() async {
    final repo = ref.read(applicationsInvitesRepositoryProvider);
    final quota = await repo.getMonthlyQuota();

    // Check Quota first (DLG-49)
    if (quota.isExhausted) {
      if (!mounted) return;
      Dlg49QuotaReachedSheet.show(
        context,
        daysUntilReset: quota.resetDate.difference(DateTime.now()).inDays,
        onUpgradePro: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Navigating to Pro Membership Upgrade')),
          );
        },
      );
      return;
    }

    // Check Duplicate Application Guard (DLG-51)
    final alreadyApplied =
        await repo.checkAlreadyApplied(widget.assignmentId);
    if (alreadyApplied) {
      if (!mounted) return;
      Dlg51AlreadyAppliedDialog.show(
        context,
        assignmentTitle: widget.assignmentTitle,
        brandName: widget.brandName,
        onViewApplication: () {
          Navigator.pushReplacementNamed(context, '/applications/my');
        },
      );
      return;
    }

    if (!mounted) return;

    final pitchText = _pitchController.text.trim();
    if (pitchText.length < 50) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Proposal pitch must be at least 50 characters long.'),
        ),
      );
      return;
    }

    final quotedRate =
        int.tryParse(_rateController.text) ?? widget.assignmentBudget;
    final days = int.tryParse(_daysController.text) ?? 4;

    setState(() => _isSubmitting = true);
    try {
      await repo.submitApplication(
        assignmentId: widget.assignmentId,
        assignmentTitle: widget.assignmentTitle,
        brandName: widget.brandName,
        location: widget.location,
        assignmentBudget: widget.assignmentBudget,
        coverLetter: pitchText,
        proposedRate: quotedRate,
        estimatedDays: days,
        attachments: _attachments,
      );

      // Refresh applications and quota
      ref.read(applicationsListProvider.notifier).loadApplications();
      ref.read(applicationQuotaProvider.notifier).refreshQuota();

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      // Show DLG-48 Confirmation Sheet
      Dlg48ApplicationSentSheet.show(
        context,
        brandName: widget.brandName,
        onViewApplication: () {
          Navigator.pushReplacementNamed(context, '/applications/my');
        },
        onKeepBrowsing: () {
          Navigator.pop(context);
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submission error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final quotaAsync = ref.watch(applicationQuotaProvider);
    final pitchCount = _pitchController.text.length;
    final quotedRate = int.tryParse(_rateController.text) ?? 0;
    final isWithinBudget = quotedRate <= widget.assignmentBudget;

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
          'Submit Proposal',
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
                // Brief Summary Header Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'APPLYING TO BRIEF',
                            style: AppTypography.label(
                              color: const Color(0xFF8C6A0A),
                            ),
                          ),
                          Text(
                            'Budget: ₹${widget.assignmentBudget.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                            style: AppTypography.headingMedium().copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.assignmentTitle,
                        style: AppTypography.headingMedium().copyWith(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${widget.brandName} · ${widget.location}',
                        style: AppTypography.caption(
                          color: AppColors.textSecondary,
                        ).copyWith(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // Pitch / Cover Letter (50-1000 characters)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'YOUR PITCH / PROPOSAL',
                      style: AppTypography.label(color: AppColors.textSecondary),
                    ),
                    Text(
                      '$pitchCount / 1000',
                      style: AppTypography.caption(
                        color: pitchCount > 1000
                            ? AppColors.error
                            : AppColors.textMuted,
                      ).copyWith(fontFamily: 'monospace'),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: pitchCount > 1000
                          ? AppColors.error
                          : AppColors.border,
                      width: 1.5,
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: TextFormField(
                    controller: _pitchController,
                    maxLines: 5,
                    maxLength: 1000,
                    buildCounter: (context,
                            {required currentLength,
                            required isFocused,
                            maxLength}) =>
                        null,
                    style: AppTypography.bodyMedium(
                      color: AppColors.textPrimary,
                    ).copyWith(fontSize: 13),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText:
                          'Introduce your relevant experience, proposed vision, and production schedule (minimum 50 characters)...',
                      hintStyle: TextStyle(
                        fontSize: 12.5,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // Quoted Rate (INR) & Budget Compatibility
                Text(
                  'YOUR PROPOSED FEE (₹ INR)',
                  style: AppTypography.label(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  child: Row(
                    children: [
                      const Text(
                        '₹ ',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Expanded(
                        child: TextFormField(
                          controller: _rateController,
                          keyboardType: TextInputType.number,
                          style: AppTypography.headingMedium().copyWith(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            hintText: '15,000',
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isWithinBudget
                              ? const Color(0xFFE6F4EC)
                              : const Color(0xFFFBF1DC),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          isWithinBudget ? 'Within Budget' : 'Above Budget',
                          style: TextStyle(
                            color: isWithinBudget
                                ? AppColors.success
                                : const Color(0xFF9A6700),
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // Deliverable Turnaround Days
                Text(
                  'ESTIMATED DELIVERY (DAYS)',
                  style: AppTypography.label(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  child: TextFormField(
                    controller: _daysController,
                    keyboardType: TextInputType.number,
                    style: AppTypography.headingMedium().copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: '4',
                      suffixText: 'Days turnaround',
                      suffixStyle: TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // Portfolio Samples (Max 3)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'PORTFOLIO SAMPLES (${_attachments.length}/3)',
                      style: AppTypography.label(color: AppColors.textSecondary),
                    ),
                    if (_attachments.length < 3)
                      GestureDetector(
                        onTap: _addSample,
                        child: Text(
                          '+ Add Sample',
                          style: AppTypography.caption(
                            color: AppColors.textPrimary,
                          ).copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Column(
                  children: [
                    for (int i = 0; i < _attachments.length; i++) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border:
                              Border.all(color: AppColors.border, width: 1.2),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: i == 0
                                    ? AppColors.accentMint
                                    : AppColors.accent,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color: AppColors.textPrimary, width: 1),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                i == 0 ? '🎬' : '🔗',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _attachments[i].title,
                                style: AppTypography.caption(
                                  color: AppColors.textPrimary,
                                ).copyWith(fontWeight: FontWeight.w700),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close,
                                  size: 16, color: AppColors.textMuted),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () => _removeSample(i),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: 12),

                // Quota Strip
                quotaAsync.when(
                  data: (q) => Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.backgroundSecondary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Proposals remaining this month:',
                          style: AppTypography.caption(
                            color: AppColors.textSecondary,
                          ).copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          '${q.remaining} / ${q.total}',
                          style: AppTypography.headingMedium().copyWith(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),

                const SizedBox(height: 24),

                // Submit Button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _handleSubmit,
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
                            'Submit Proposal →',
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
