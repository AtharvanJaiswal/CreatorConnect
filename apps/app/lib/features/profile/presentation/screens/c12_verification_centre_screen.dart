import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/domain/entities/user_role.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';

class C12VerificationCentreScreen extends StatefulWidget {
  final ProfileRepository? repository;
  final UserRole userRole;

  const C12VerificationCentreScreen({
    super.key,
    this.repository,
    this.userRole = UserRole.creator,
  });

  @override
  State<C12VerificationCentreScreen> createState() => _C12VerificationCentreScreenState();
}

class _C12VerificationCentreScreenState extends State<C12VerificationCentreScreen> {
  late final ProfileRepository _repo;
  VerificationData? _data;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final data = await _repo.getVerificationData();
    if (mounted) {
      setState(() {
        _data = data;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBrand = widget.userRole == UserRole.brand;
    final state = _data?.state ?? VerificationState.notStarted;

    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Verification Centre',
          style: TextStyle(
            fontFamily: 'Archivo',
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              children: [
                _buildHeroBanner(state),
                const SizedBox(height: 24),
                const Text(
                  'TRUST LEVELS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 12),
                _buildLevelTile(
                  level: 'Level 1',
                  title: 'Profile Complete',
                  subtitle: 'Basic details, niche skills, deliverables and commercial rates published.',
                  isDone: true,
                  isActive: state == VerificationState.notStarted,
                ),
                const SizedBox(height: 12),
                _buildLevelTile(
                  level: 'Level 2',
                  title: isBrand ? 'Verified Business' : 'Verified Creator',
                  subtitle: isBrand
                      ? 'Verified GST and Incorporation certificate. Unlocks posting direct assignments.'
                      : 'Authenticity verified via one-time code in Instagram bio. Unlocks verified badge.',
                  isDone: state == VerificationState.approved,
                  isActive: state != VerificationState.approved,
                ),
                const SizedBox(height: 28),
                const Text(
                  'WHY GET VERIFIED?',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 12),
                _buildBenefitRow(
                  Icons.verified_rounded,
                  'Official verification badge',
                  'Gain instant trust with brands and collaborators looking for verified creators.',
                ),
                const SizedBox(height: 10),
                _buildBenefitRow(
                  Icons.trending_up_rounded,
                  'Top discovery ranking',
                  'Verified profiles appear at the top of brand campaign search results.',
                ),
                const SizedBox(height: 10),
                _buildBenefitRow(
                  Icons.paid_outlined,
                  'Direct paid offers',
                  'Verified brands can send fast-track contracts without preliminary screening.',
                ),
                const SizedBox(height: 32),
                // Action CTA
                if (state == VerificationState.notStarted)
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      ),
                      onPressed: () async {
                        final res = await Navigator.pushNamed(
                          context,
                          '/profile/verification-request',
                          arguments: {'isBrand': isBrand},
                        );
                        if (res == true) _loadData();
                      },
                      child: Text(
                        isBrand ? 'Submit Business Documents' : 'Get Verified with Bio Code',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                        side: const BorderSide(color: AppColors.borderLight, width: 1.5),
                      ),
                      onPressed: () {
                        Navigator.pushNamed(
                          context,
                          '/profile/verification-result',
                          arguments: _data,
                        );
                      },
                      child: const Text(
                        'View Verification Status',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 32),
              ],
            ),
    );
  }

  Widget _buildHeroBanner(VerificationState state) {
    Color bg;
    Color iconColor;
    IconData icon;
    String title;
    String subtitle;

    switch (state) {
      case VerificationState.notStarted:
        bg = const Color(0xFFFFF3CD);
        iconColor = const Color(0xFF8A6D00);
        icon = Icons.shield_outlined;
        title = 'Level 1 Profile';
        subtitle = 'Unlock the blue checkmark by verifying your ownership';
        break;
      case VerificationState.underReview:
        bg = const Color(0xFFE3F2FD);
        iconColor = const Color(0xFF1976D2);
        icon = Icons.hourglass_top_rounded;
        title = 'Verification In Review';
        subtitle = 'Our team is validating your verification request';
        break;
      case VerificationState.approved:
        bg = const Color(0xFFE8F5E9);
        iconColor = const Color(0xFF2E7D32);
        icon = Icons.verified_rounded;
        title = 'Level 2 Verified';
        subtitle = 'Your account has earned full trust credentials';
        break;
      case VerificationState.changesNeeded:
        bg = const Color(0xFFFFEBEE);
        iconColor = const Color(0xFFD32F2F);
        icon = Icons.error_outline_rounded;
        title = 'Updates Needed';
        subtitle = 'Review feedback and resubmit your details';
        break;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.borderLight, width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: bg,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Archivo',
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLevelTile({
    required String level,
    required String title,
    required String subtitle,
    required bool isDone,
    required bool isActive,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDone ? const Color(0xFFC8E6C9) : AppColors.borderLight,
          width: isDone ? 1.5 : 1.0,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: isDone ? const Color(0xFFE8F5E9) : const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              level,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: isDone ? const Color(0xFF2E7D32) : AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontFamily: 'Archivo',
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (isDone) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32), size: 16),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitRow(IconData icon, String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
