import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../controllers/campaign_controllers.dart';
import '../dialogs/withdraw_application_dialog.dart';

class E11ApplicationDetailScreen extends ConsumerWidget {
  final ApplicationItem application;

  const E11ApplicationDetailScreen({super.key, required this.application});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Proposal Status & Timeline',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(application.briefTitle, style: AppTypography.headingLarge().copyWith(fontSize: 20)),
              const SizedBox(height: 6),
              Text('Brand: ${application.brandName}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
              const SizedBox(height: 24),

              // Timeline
              const Text('Proposal Lifecycle', style: TextStyle(fontFamily: 'Archivo', fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              _buildTimelineStep(title: 'Proposal Submitted', subtitle: application.submittedAt, isComplete: true),
              _buildTimelineStep(title: 'Brand Reviewed Pitch', subtitle: application.reviewedAt ?? 'Pending review', isComplete: application.reviewedAt != null),
              _buildTimelineStep(title: 'Shortlisted by Brand', subtitle: application.status == ApplicationStatus.shortlisted || application.status == ApplicationStatus.accepted ? 'Confirmed' : 'Pending', isComplete: application.status == ApplicationStatus.shortlisted || application.status == ApplicationStatus.accepted),
              _buildTimelineStep(title: 'Hired & Contract Created', subtitle: application.status == ApplicationStatus.accepted ? 'Active Escrow Project' : 'Pending', isComplete: application.status == ApplicationStatus.accepted, isLast: true),
              const SizedBox(height: 32),

              const Text('Your Submitted Pitch', style: TextStyle(fontFamily: 'Archivo', fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfacePure,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Proposed Rate', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                        Text(application.proposedRateFormatted, style: const TextStyle(fontFamily: 'Archivo', fontWeight: FontWeight.w900, fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text('Cover Letter:', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text(application.coverLetter, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.35)),
                  ],
                ),
              ),
              const SizedBox(height: 36),

              if (application.status == ApplicationStatus.submitted || application.status == ApplicationStatus.underReview || application.status == ApplicationStatus.shortlisted)
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton(
                    onPressed: () async {
                      final confirmed = await WithdrawApplicationDialog.show(context);
                      if (confirmed && context.mounted) {
                        await ref.read(campaignRepositoryProvider).withdrawApplication(application.id);
                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Proposal withdrawn successfully.')),
                          );
                        }
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: Color(0xFFFFCDD2)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    child: const Text('Withdraw Proposal', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTimelineStep({required String title, required String subtitle, required bool isComplete, bool isLast = false}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: isComplete ? AppColors.primary : AppColors.surfaceWarm,
                shape: BoxShape.circle,
                border: Border.all(color: isComplete ? AppColors.primaryDark : AppColors.border),
              ),
              child: Center(
                child: Icon(
                  isComplete ? Icons.check_rounded : Icons.circle,
                  size: isComplete ? 14 : 8,
                  color: isComplete ? AppColors.textPrimary : AppColors.textMuted,
                ),
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 36,
                color: isComplete ? AppColors.primaryDark : AppColors.borderLight,
              ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: isComplete ? AppColors.textPrimary : AppColors.textMuted)),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
              if (!isLast) const SizedBox(height: 16),
            ],
          ),
        ),
      ],
    );
  }
}
