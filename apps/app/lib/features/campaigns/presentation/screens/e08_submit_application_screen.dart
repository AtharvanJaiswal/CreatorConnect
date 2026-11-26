import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../controllers/campaign_controllers.dart';

class E08SubmitApplicationScreen extends ConsumerStatefulWidget {
  final CampaignBrief brief;

  const E08SubmitApplicationScreen({super.key, required this.brief});

  @override
  ConsumerState<E08SubmitApplicationScreen> createState() => _E08SubmitApplicationScreenState();
}

class _E08SubmitApplicationScreenState extends ConsumerState<E08SubmitApplicationScreen> {
  late final TextEditingController _rateCtrl;
  final _coverCtrl = TextEditingController();
  final _daysCtrl = TextEditingController(text: '4');
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _rateCtrl = TextEditingController(text: widget.brief.budgetMin.toString());
  }

  @override
  void dispose() {
    _rateCtrl.dispose();
    _coverCtrl.dispose();
    _daysCtrl.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    final rate = int.tryParse(_rateCtrl.text) ?? widget.brief.budgetMin;
    final days = int.tryParse(_daysCtrl.text) ?? 4;
    final cover = _coverCtrl.text.trim();

    if (cover.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please include a short cover pitch for the brand.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final repo = ref.read(campaignRepositoryProvider);
    await repo.submitApplication(
      briefId: widget.brief.id,
      proposedRate: rate,
      coverLetter: cover,
      estimatedDays: days,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      Navigator.pushReplacementNamed(context, '/campaigns/my-applications');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Proposal submitted successfully! 🎉'),
          backgroundColor: Color(0xFF2E7D32),
        ),
      );
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
          'Submit Proposal / Pitch',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Brief summary card
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
                      radius: 20,
                      backgroundImage: widget.brief.brandLogo.isNotEmpty ? NetworkImage(widget.brief.brandLogo) : null,
                      child: widget.brief.brandLogo.isEmpty ? const Icon(Icons.business_rounded, size: 20) : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.brief.brandName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textMuted)),
                          const SizedBox(height: 2),
                          Text(widget.brief.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              const Text('Proposed Rate (INR ₹)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
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
              const SizedBox(height: 20),

              const Text('Estimated Turnaround (Days)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 8),
              TextField(
                controller: _daysCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  suffixText: ' days',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                ),
              ),
              const SizedBox(height: 20),

              const Text('Cover Letter & Creative Pitch', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 4),
              const Text('Highlight why your audience aligns with this brief and your previous relevant work.', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
              const SizedBox(height: 8),
              TextField(
                controller: _coverCtrl,
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: 'Hi team, I love your brand and my audience in Mumbai would resonate deeply with...',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                ),
              ),
              const SizedBox(height: 32),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _onSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  child: _isSubmitting
                      ? const CircularProgressIndicator(color: AppColors.textPrimary)
                      : const Text('Send Proposal →', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
