import 'package:flutter/material.dart';
import '../../../../core/animations/app_animations.dart';
import '../../../../core/config/feature_flags.dart';
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
  bool _hasInitialized = false;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _currentRole = widget.initialRole;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_hasInitialized) {
      _hasInitialized = true;
      _loadOverview(routeRole: _extractRouteRole());
    }
  }

  UserRole? _extractRouteRole() {
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is UserRole) return args;
    if (args is Map) {
      final r = args['role'];
      if (r is UserRole) return r;
      if (r is String && r.isNotEmpty) return UserRole.fromString(r);
    }
    return null;
  }

  Future<void> _loadOverview({UserRole? routeRole}) async {
    if (!_isLoading && mounted) {
      setState(() => _isLoading = true);
    }
    try {
      final resolved = routeRole ??
          (widget.initialRole != UserRole.creator
              ? widget.initialRole
              : await _repo.resolveActiveRole(fallback: widget.initialRole));
      _currentRole = resolved;
      final data = await _repo.getProfileOverview(role: _currentRole);
      if (mounted) {
        setState(() {
          _overview = data;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showBrandPlanSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfacePure,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Starter Plan (Free)',
              style: TextStyle(
                fontFamily: 'Archivo',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'You are currently on the Free plan. You can post campaign briefs, browse verified creators, and unlock Level 2 business verification at no extra cost.',
              style: TextStyle(
                fontSize: 14,
                height: 1.45,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text(
                  'Got it',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
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
        await Navigator.pushNamed(
          context,
          '/profile/verification-centre',
          arguments: _currentRole,
        );
        break;
      case 'addRole':
        await Navigator.pushNamed(
          context,
          '/profile/add-role',
          arguments: _currentRole,
        );
        break;
      case 'plan':
        _showBrandPlanSheet();
        return;
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
                  ...(_overview?.requiredSections ?? []).asMap().entries.map(
                    (e) => StaggeredEntrance(
                      index: e.key,
                      child: _buildSectionTile(e.value),
                    ),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionHeader('VERIFICATION & LEVEL 2'),
                  const SizedBox(height: 10),
                  ...(_overview?.verificationSections ?? []).asMap().entries.map(
                    (e) => StaggeredEntrance(
                      index: (_overview?.requiredSections.length ?? 0) + e.key,
                      child: _buildSectionTile(e.value),
                    ),
                  ),
                  const SizedBox(height: 24),
                  _buildAddRoleBanner(),
                  const SizedBox(height: 32),
                ],
              ),
            ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        decoration: const BoxDecoration(
          color: AppColors.surfacePure,
          border: Border(top: BorderSide(color: AppColors.borderLight, width: 1)),
        ),
        child: SizedBox(
          height: 48,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: (_overview?.isLevel1 ?? false) || (_overview?.completionPercentage ?? 0) >= 80
                  ? AppColors.primary
                  : AppColors.textPrimary,
              foregroundColor: (_overview?.isLevel1 ?? false) || (_overview?.completionPercentage ?? 0) >= 80
                  ? AppColors.textPrimary
                  : Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            onPressed: () {
              if ((_overview?.isLevel1 ?? false) || (_overview?.completionPercentage ?? 0) >= 80) {
                _showCompletionCelebrationAndLaunch();
              } else if (_overview?.nextActionKey.isNotEmpty == true) {
                _navigateToSection(_overview!.nextActionKey);
              } else {
                Navigator.pushNamedAndRemoveUntil(context, '/home', (r) => false);
              }
            },
            child: Text(
              (_overview?.completionPercentage ?? 0) == 100
                  ? 'Launch Dashboard 🚀'
                  : ((_overview?.isLevel1 ?? false) || (_overview?.completionPercentage ?? 0) >= 80)
                      ? 'Review & Launch Dashboard ➔'
                      : 'Continue: ${_overview?.nextActionTitle ?? 'Complete Profile'} ➔',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
            ),
          ),
        ),
      ),
    );
  }

  void _showCompletionCelebrationAndLaunch() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: AppColors.surfacePure,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: const BoxDecoration(
                color: Color(0xFFE8F5E9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_rounded, color: Color(0xFF2E7D32), size: 26),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Profile Ready! 🎉',
                style: TextStyle(
                  fontFamily: 'Archivo',
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your profile is set up and published to the talent discovery catalog.',
              style: TextStyle(fontSize: 14, color: AppColors.textPrimary, height: 1.4),
            ),
            SizedBox(height: 12),
            Text(
              '• Unlocked Level 1 creator discovery\n• Receive collaboration invitations\n• Real-time creator-to-creator messaging',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.5),
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.pushNamedAndRemoveUntil(context, '/home', (r) => false);
              },
              child: const Text(
                'Launch Dashboard ➔',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
              ),
            ),
          ),
        ],
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
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Add another profile role',
                    style: TextStyle(
                      fontFamily: 'Archivo',
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    (FeatureFlags.enableProfessionalRegistration ||
                            FeatureFlags.enableBrandRegistration)
                        ? 'E.g. Creator + Video Editor, or Brand'
                        : 'E.g. Operate as both Creator & Podcaster',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
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
