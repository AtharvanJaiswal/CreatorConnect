import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';

class C14VerificationResultScreen extends StatelessWidget {
  final VerificationData? data;

  const C14VerificationResultScreen({
    super.key,
    this.data,
  });

  @override
  Widget build(BuildContext context) {
    final vData = data ??
        const VerificationData(
          state: VerificationState.underReview,
          submittedAccount: 'Instagram @anjana.creates',
          submittedDate: 'Today, 10:42',
        );

    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Verification Status',
          style: TextStyle(
            fontFamily: 'Archivo',
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            children: [
              const Spacer(),
              _buildStateCard(vData),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Return to Profile Setup',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStateCard(VerificationData vData) {
    switch (vData.state) {
      case VerificationState.underReview:
        return Column(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: Color(0xFFE3F2FD),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.hourglass_top_rounded, color: Color(0xFF1976D2), size: 40),
            ),
            const SizedBox(height: 24),
            const Text(
              'Under Review',
              style: TextStyle(
                fontFamily: 'Archivo',
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Verification submitted for ${vData.submittedAccount ?? "your account"} on ${vData.submittedDate ?? "Today"}.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfacePure,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.borderLight),
              ),
              child: const Row(
                children: [
                  Icon(Icons.schedule_rounded, color: AppColors.primary, size: 22),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Turnaround time: Most verifications are evaluated in under 24 hours.',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );

      case VerificationState.approved:
        return Column(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: Color(0xFFE8F5E9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_rounded, color: Color(0xFF2E7D32), size: 44),
            ),
            const SizedBox(height: 24),
            const Text(
              'Verified Level 2 Active!',
              style: TextStyle(
                fontFamily: 'Archivo',
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your profile is now marked with the official CreatorConnect verified checkmark. Brand collaborations are fully unlocked.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
            ),
          ],
        );

      case VerificationState.changesNeeded:
        return Column(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: Color(0xFFFFEBEE),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.error_outline_rounded, color: Color(0xFFD32F2F), size: 40),
            ),
            const SizedBox(height: 24),
            const Text(
              'Changes Requested',
              style: TextStyle(
                fontFamily: 'Archivo',
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              vData.feedbackReason ??
                  'The verification code was not found in your Instagram bio during the scan. Please check and retry.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3CD),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${vData.attemptsRemaining} verification attempts remaining',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF8A6D00)),
              ),
            ),
          ],
        );

      default:
        return const SizedBox.shrink();
    }
  }
}
