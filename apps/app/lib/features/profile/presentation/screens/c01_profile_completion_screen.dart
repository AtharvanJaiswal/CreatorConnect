import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/domain/entities/user_role.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../bottom_sheets/complete_profile_nudge_sheet.dart';
import '../bottom_sheets/verification_required_gate_sheet.dart';

class C01ProfileCompletionScreen extends StatefulWidget {
  final ProfileRepository? repository;
  final UserRole initialRole;

  const C01ProfileCompletionScreen({
    super.key,
    this.repository,
    this.initialRole = UserRole.creator,
  });

  @override
  State<C01ProfileCompletionScreen> createState() => _C01ProfileCompletionScreenState();
}

class _C01ProfileCompletionScreenState extends State<C01ProfileCompletionScreen> {
  late final ProfileRepository _repo;
  late UserRole _currentRole;
  ProfileOverviewData? _overview;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _currentRole = widget.initialRole;
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    setState(() => _isLoading = true);
    final data = await _repo.getProfileOverview(role: _currentRole);
    if (mounted) {
      setState(() {
        _overview = data;
        _isLoading = false;
      });
    }
  }

  void _navigateToSection(String key) async {
    switch (key) {
      case 'basicInfo':
        await Navigator.pushNamed(context, '/profile/basic-info');
        break;
      case 'categorySkills':
        await Navigator.pushNamed(context, '/profile/category-skills');
        break;
      case 'roleDetails':
        if (_currentRole == UserRole.creator) {
          await Navigator.pushNamed(context, '/profile/creator-details');
        } else if (_currentRole == UserRole.professional) {
          await Navigator.pushNamed(context, '/profile/professional-details');
        } else if (_currentRole == UserRole.podcaster) {
          await Navigator.pushNamed(context, '/profile/podcast-details');
        }
        break;
      case 'companyDetails':
        await Navigator.pushNamed(context, '/profile/company-details');
        break;
      case 'socialAccounts':
        await Navigator.pushNamed(context, '/profile/social-accounts');
        break;
      case 'verification':
        await Navigator.pushNamed(context, '/profile/verification-centre');
        break;
      case 'addRole':
        await Navigator.pushNamed(context, '/profile/add-role');
        break;
      default:
        break;
    }
    _loadOverview();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Profile Setup',
          style: TextStyle(
            fontFamily: 'Archivo',
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _currentRole.accentColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: _currentRole.accentColor.withValues(alpha: 0.5)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_currentRole.icon, size: 14, color: AppColors.textPrimary),
                const SizedBox(width: 6),
                Text(
                  _currentRole.title.split(' ').first,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _loadOverview,
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                children: [
                  _buildProgressCard(),
                  const SizedBox(height: 24),
                  _buildSectionHeader('REQUIRED FOR LEVEL 1'),
                  const SizedBox(height: 10),
                  ...(_overview?.requiredSections ?? []).map(_buildSectionTile),
                  const SizedBox(height: 24),
                  _buildSectionHeader('VERIFICATION & LEVEL 2'),
                  const SizedBox(height: 10),
                  ...(_overview?.verificationSections ?? []).map(_buildSectionTile),
                  const SizedBox(height: 24),
                  _buildAddRoleBanner(),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildProgressCard() {
    final pct = _overview?.completionPercentage ?? 0;
    final isL1 = _overview?.isLevel1 ?? false;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.borderLight, width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        '$pct% completed',
                        style: const TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: isL1 ? const Color(0xFFE8F5E9) : const Color(0xFFFFF3CD),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          isL1 ? 'Level 1 Active' : 'Level 0',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: isL1 ? const Color(0xFF2E7D32) : const Color(0xFF8A6D00),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isL1 ? 'Unlocked for collaborations' : 'Complete required fields to unlock search',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (pct / 100).clamp(0.0, 1.0),
              minHeight: 10,
              backgroundColor: AppColors.surfaceWarm,
              valueColor: AlwaysStoppedAnimation<Color>(
                pct == 100 ? const Color(0xFF2E7D32) : AppColors.primary,
              ),
            ),
          ),
          if (_overview?.nextActionKey.isNotEmpty == true && pct < 100) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                onPressed: () => _navigateToSection(_overview!.nextActionKey),
                icon: const Icon(Icons.arrow_forward_rounded, size: 18, color: AppColors.textPrimary),
                label: Text(
                  'Continue: ${_overview!.nextActionTitle}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: AppColors.textTertiary,
      ),
    );
  }

  Widget _buildSectionTile(ProfileSectionItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: item.isDone ? const Color(0xFFC8E6C9) : AppColors.borderLight,
          width: 1.2,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: item.isDone
                ? const Color(0xFFE8F5E9)
                : (item.isLocked ? const Color(0xFFF5F5F5) : AppColors.surfaceWarm),
            shape: BoxShape.circle,
          ),
          child: Icon(
            item.isDone
                ? Icons.check_circle_rounded
                : (item.isLocked ? Icons.lock_outline_rounded : Icons.radio_button_unchecked_rounded),
            color: item.isDone
                ? const Color(0xFF2E7D32)
                : (item.isLocked ? AppColors.textTertiary : AppColors.textSecondary),
            size: 20,
          ),
        ),
        title: Text(
          item.title,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: item.isLocked ? AppColors.textSecondary : AppColors.textPrimary,
          ),
        ),
        subtitle: Text(
          item.isLocked ? (item.lockReason ?? 'Locked') : item.subtitle,
          style: TextStyle(
            fontSize: 12,
            color: item.isLocked ? const Color(0xFFD32F2F) : AppColors.textSecondary,
          ),
        ),
        trailing: Icon(
          item.isLocked ? Icons.lock_clock_outlined : Icons.chevron_right_rounded,
          color: AppColors.textTertiary,
          size: 20,
        ),
        onTap: () {
          if (item.isLocked) {
            if (item.key == 'verification') {
              VerificationRequiredGateSheet.show(
                context,
                isBrand: _currentRole == UserRole.brand,
                onStartVerification: () => _navigateToSection(item.key),
              );
            } else {
              CompleteProfileNudgeSheet.show(
                context,
                completionPercentage: _overview?.completionPercentage ?? 0,
                nextActionTitle: _overview?.nextActionTitle ?? '',
                onContinue: () => _navigateToSection(_overview?.nextActionKey ?? ''),
              );
            }
          } else {
            _navigateToSection(item.key);
          }
        },
      ),
    );
  }

  Widget _buildAddRoleBanner() {
    return InkWell(
      onTap: () => _navigateToSection('addRole'),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFFF2ECE1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.borderLight, width: 1.2),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: const BoxDecoration(
                color: AppColors.surfacePure,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.add_circle_outline_rounded, color: AppColors.textPrimary, size: 24),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Add another profile role',
                    style: TextStyle(
                      fontFamily: 'Archivo',
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'E.g. Creator + Video Editor, or Brand',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary, size: 22),
          ],
        ),
      ),
    );
  }
}
