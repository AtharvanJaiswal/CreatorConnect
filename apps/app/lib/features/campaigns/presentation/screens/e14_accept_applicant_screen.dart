import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../controllers/campaign_controllers.dart';

class E14AcceptApplicantScreen extends ConsumerStatefulWidget {
  final ApplicationItem applicant;

  const E14AcceptApplicantScreen({super.key, required this.applicant});

  @override
  ConsumerState<E14AcceptApplicantScreen> createState() => _E14AcceptApplicantScreenState();
}

class _E14AcceptApplicantScreenState extends ConsumerState<E14AcceptApplicantScreen> {
  late final TextEditingController _rateCtrl;
  bool _isConfirming = false;

  @override
  void initState() {
    super.initState();
    _rateCtrl = TextEditingController(text: widget.applicant.proposedRate.toString());
  }

  @override
  void dispose() {
    _rateCtrl.dispose();
    super.dispose();
  }

  Future<void> _onConfirmHiring() async {
    final finalRate = int.tryParse(_rateCtrl.text) ?? widget.applicant.proposedRate;
    setState(() => _isConfirming = true);

    final repo = ref.read(campaignRepositoryProvider);
    await repo.acceptApplication(
      widget.applicant.assignmentId,
      widget.applicant.id,
      finalRate: finalRate,
      milestones: [
        const MilestoneItem(title: 'First Draft & Initial Cut', percentage: 50, amount: 0, dueDate: 'In 3 days'),
        const MilestoneItem(title: 'Final Approved Asset & Rights Release', percentage: 50, amount: 0, dueDate: 'In 7 days'),
      ],
    );

    if (mounted) {
      setState(() => _isConfirming = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Hired ${widget.applicant.applicantName}! Escrow deposit created. 🎉'),
          backgroundColor: const Color(0xFF2E7D32),
        ),
      );
      Navigator.popUntil(context, (route) => route.isFirst || route.settings.name == '/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Confirm Hiring & Escrow Setup',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Candidate Summary Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfacePure,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundImage: widget.applicant.applicantAvatar.isNotEmpty
                          ? NetworkImage(widget.applicant.applicantAvatar)
                          : null,
                      child: widget.applicant.applicantAvatar.isEmpty ? const Icon(Icons.person_rounded, size: 24) : null,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.applicant.applicantName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                          const SizedBox(height: 2),
                          Text(widget.applicant.briefTitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              const Text('Final Agreed Rate (INR ₹)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 8),
              TextField(
                controller: _rateCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                ),
              ),
              const SizedBox(height: 24),

              const Text('Milestone Tranches (Escrow Secured)', style: TextStyle(fontFamily: 'Archivo', fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              _buildMilestoneRow('Tranche 1: First Draft & Initial Cut', '50%', 'In 3 days'),
              _buildMilestoneRow('Tranche 2: Final Approved Asset & Rights Release', '50%', 'In 7 days'),
              const SizedBox(height: 36),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isConfirming ? null : _onConfirmHiring,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  child: _isConfirming
                      ? const CircularProgressIndicator(color: AppColors.textPrimary)
                      : const Text('Deposit Escrow & Hire Creator ⚡', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMilestoneRow(String title, String percent, String timeline) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceWarm,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text('Due $timeline', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surfacePure,
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(percent, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
