import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/domain/entities/user_role.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/entities/taxonomy_data.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../../../../core/widgets/safe_image.dart';

/// Full-featured, production-ready Profile Screen for the authenticated user.
///
/// Features:
/// - Fetches and renders real user identity from Supabase Auth & ProfileRepository.
/// - Strictly locks Email & Mobile Number as read-only (security credentials).
/// - Allows editing and updating Display Name, Bio, City, Categories, Rates, etc.
/// - Synchronizes changes immediately with local storage and backend API.
class UserProfileScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const UserProfileScreen({
    super.key,
    this.repository,
  });

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  late final ProfileRepository _repo;

  bool _isLoading = true;
  String _userEmail = '';
  String _userPhone = '';
  String _roleName = 'CREATOR';
  UserRole _userRole = UserRole.creator;

  BasicInfoData _basicInfo = const BasicInfoData(
    displayName: '',
    bio: '',
    city: '',
    hubName: '',
    languages: [],
  );

  CreatorDetailsData _creatorDetails = const CreatorDetailsData(
    contentTypes: [],
    minRate: null,
    maxRate: null,
    rateUnit: RateUnit.perProject,
    showRateOnProfile: true,
    availability: AvailabilityStatus.availableNow,
  );

  CompanyDetailsData _companyDetails = const CompanyDetailsData(
    companyName: '',
    description: '',
    businessCategory: '',
    city: '',
    teamSize: '',
    websiteUrl: '',
    gstNumber: null,
  );

  List<SocialPlatformAccount> _socialAccounts = [];
  List<UserSkillSelection> _userSkills = [];
  ProfileOverviewData? _overview;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl.instance;
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    setState(() => _isLoading = true);
    try {
      // 1. Authenticated User Identity
      try {
        final user = Supabase.instance.client.auth.currentUser;
        if (user != null) {
          _userEmail = user.email ?? '';
          _userPhone = user.phone ?? '';

          final meta = user.userMetadata ?? {};
          final rawRole = (meta['role'] as String?)?.toUpperCase() ?? 'CREATOR';
          _roleName = rawRole;
          _userRole = UserRole.fromString(rawRole);

          if (_userPhone.isEmpty && meta['phone'] != null) {
            _userPhone = meta['phone'].toString();
          }
        }
      } catch (_) {
        // Fallback for tests or uninitialized Supabase instance
        if (_userEmail.isEmpty) _userEmail = 'user@creatorconnect.com';
        if (_userPhone.isEmpty) _userPhone = '+91 98765 43210';
      }

      // 2. Profile Repository Data (Aggregated from local & backend)
      final basic = await _repo.getBasicInfo();
      final creator = await _repo.getCreatorDetails();
      final company = await _repo.getCompanyDetails();
      final socials = await _repo.getSocialAccounts();
      final skills = await _repo.getUserSkills();
      final overview = await _repo.getProfileOverview(role: _userRole);

      if (mounted) {
        setState(() {
          _basicInfo = basic;
          _creatorDetails = creator;
          _companyDetails = company;
          _socialAccounts = socials;
          _userSkills = skills;
          _overview = overview;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('UserProfileScreen._loadProfileData error: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String get _displayName {
    if (_basicInfo.displayName.trim().isNotEmpty) {
      return _basicInfo.displayName.trim();
    }
    try {
      final meta = Supabase.instance.client.auth.currentUser?.userMetadata;
      final fullName = meta?['full_name'] as String? ?? meta?['name'] as String?;
      if (fullName != null && fullName.trim().isNotEmpty) {
        return fullName.trim();
      }
    } catch (_) {}
    if (_userEmail.isNotEmpty) {
      return _userEmail.split('@').first;
    }
    return 'Creator';
  }

  String get _handle {
    final prefix = _userEmail.isNotEmpty ? _userEmail.split('@').first : 'creator';
    final clean = prefix.replaceAll(RegExp(r'[^a-zA-Z0-9._]'), '').toLowerCase();
    return '@$clean';
  }

  String get _initials {
    final name = _displayName;
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (name.isNotEmpty) {
      return name[0].toUpperCase();
    }
    return 'C';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'My Profile',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.18),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary, width: 1),
            ),
            child: Text(
              _roleName,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 11,
                letterSpacing: 0.5,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textPrimary),
            tooltip: 'Log Out',
            onPressed: _showLogoutConfirmDialog,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _loadProfileData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 1. Main Profile Card
                    _buildHeroHeaderCard(),
                    const SizedBox(height: 16),

                    // 2. Profile Setup Completion Progress (Module C link)
                    if (_overview != null) _buildCompletionNudgeCard(),
                    const SizedBox(height: 16),

                    // 3. Authentication & Account Credentials (READ ONLY - LOCKED)
                    _buildAccountSecurityCard(),
                    const SizedBox(height: 16),

                    // 4. Bio & About
                    _buildBioCard(),
                    const SizedBox(height: 16),

                    // 5. Location & Creator Hub
                    _buildLocationCard(),
                    const SizedBox(height: 16),

                    // 6. Role Deliverables & Rates / Company Details
                    if (_userRole == UserRole.brand)
                      _buildBrandCompanyCard()
                    else
                      _buildRoleDetailsCard(),
                    const SizedBox(height: 16),

                    // 7. Categories & Skills
                    _buildCategoriesSkillsCard(),
                    const SizedBox(height: 16),

                    // 8. Connected Social Platforms
                    _buildSocialAccountsCard(),
                    const SizedBox(height: 24),

                    // 9. Deep Edit Shortcuts
                    _buildDeepEditingShortcuts(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  // ==============================================================================
  // 1. Hero Header Card
  // ==============================================================================
  Widget _buildHeroHeaderCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Avatar with camera badge
              Stack(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppColors.primary,
                    backgroundImage: safeNetworkImage(_basicInfo.photoUrl),
                    child: safeNetworkImage(_basicInfo.photoUrl) == null
                        ? Text(
                            _initials,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w900,
                              fontSize: 22,
                            ),
                          )
                        : null,
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: GestureDetector(
                      onTap: () => _openEditProfileModal(),
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: AppColors.textPrimary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        child: const Icon(
                          Icons.camera_alt_rounded,
                          size: 13,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              // Name, Handle, Role
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            _displayName,
                            style: const TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(
                          Icons.verified_rounded,
                          color: Colors.blue,
                          size: 18,
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _handle,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on_rounded,
                          size: 13,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _basicInfo.city.isNotEmpty
                              ? _basicInfo.city
                              : 'Location not set',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Prominent Edit Profile Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _openEditProfileModal(),
              icon: const Icon(Icons.edit_outlined, size: 17),
              label: const Text(
                'Edit Profile',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ==============================================================================
  // 2. Profile Completion Progress
  // ==============================================================================
  Widget _buildCompletionNudgeCard() {
    final pct = _overview?.completionPercentage ?? 0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Profile Setup · $pct% Complete',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13.5,
                  color: AppColors.textPrimary,
                ),
              ),
              TextButton(
                onPressed: () =>
                    Navigator.pushNamed(context, '/profile/completion'),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(50, 24),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Manage →',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct / 100.0,
              minHeight: 7,
              backgroundColor: AppColors.backgroundWarm,
              color: pct >= 80 ? Colors.green : AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  // ==============================================================================
  // 3. Authentication & Account Security (STRICTLY READ-ONLY)
  // ==============================================================================
  Widget _buildAccountSecurityCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.shield_outlined,
                color: AppColors.textPrimary,
                size: 20,
              ),
              const SizedBox(width: 8),
              const Text(
                'Account & Security',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.lock_rounded, size: 11, color: Colors.green),
                    SizedBox(width: 4),
                    Text(
                      'LOCKED',
                      style: TextStyle(
                        color: Colors.green,
                        fontWeight: FontWeight.w800,
                        fontSize: 9.5,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Your login credentials are encrypted and permanently linked to your account.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 14),

          // Email Field (Read Only)
          _buildLockedField(
            icon: Icons.email_outlined,
            label: 'Registered Email',
            value: _userEmail.isNotEmpty ? _userEmail : 'No email attached',
            tooltip: 'Email cannot be changed',
          ),
          const SizedBox(height: 10),

          // Phone Field (Read Only)
          _buildLockedField(
            icon: Icons.phone_outlined,
            label: 'Registered Mobile Number',
            value: _userPhone.isNotEmpty ? _userPhone : 'Not linked to SMS OTP',
            tooltip: 'Mobile number cannot be changed',
          ),

          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.amber.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.amber.withOpacity(0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 16, color: Colors.amber),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Email and mobile number cannot be edited to maintain account verification and security integrity.',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLockedField({
    required IconData icon,
    required String label,
    required String value,
    required String tooltip,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.backgroundWarm,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withOpacity(0.7)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Tooltip(
            message: tooltip,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline_rounded, size: 14, color: AppColors.textMuted),
                SizedBox(width: 4),
                Text(
                  'Cannot Change',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ==============================================================================
  // 4. Bio Card
  // ==============================================================================
  Widget _buildBioCard() {
    final bioText = _basicInfo.bio.trim();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'About',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.textPrimary,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 17),
                color: AppColors.textPrimary,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => _openEditProfileModal(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            bioText.isNotEmpty
                ? bioText
                : 'No bio added yet. Add a short summary to describe your craft, aesthetic, and vision.',
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: bioText.isNotEmpty
                  ? AppColors.textPrimary
                  : AppColors.textMuted,
              fontStyle: bioText.isEmpty ? FontStyle.italic : FontStyle.normal,
            ),
          ),
        ],
      ),
    );
  }

  // ==============================================================================
  // 5. Location Card
  // ==============================================================================
  Widget _buildLocationCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Location & Creator Hub',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.textPrimary,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 17),
                color: AppColors.textPrimary,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () =>
                    Navigator.pushNamed(context, '/profile/basic-info').then((_) => _loadProfileData()),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _infoTile(
                icon: Icons.location_city_rounded,
                title: 'City',
                value: _basicInfo.city.isNotEmpty ? _basicInfo.city : 'Not set',
              ),
              const SizedBox(width: 12),
              _infoTile(
                icon: Icons.hub_rounded,
                title: 'Creator Hub',
                value: _basicInfo.hubName.isNotEmpty ? _basicInfo.hubName : 'Pan-India',
              ),
            ],
          ),
          if (_basicInfo.languages.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _basicInfo.languages
                  .map(
                    (lang) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.backgroundWarm,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        lang,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  // ==============================================================================
  // 6. Creator Role Details Card
  // ==============================================================================
  Widget _buildRoleDetailsCard() {
    final rate = _creatorDetails.minRate != null
        ? '₹${_creatorDetails.minRate!.toString()}'
        : 'Not set';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Deliverables & Pricing',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.textPrimary,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 17),
                color: AppColors.textPrimary,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => Navigator.pushNamed(
                  context,
                  _userRole == UserRole.professional
                      ? '/profile/professional-details'
                      : (_userRole == UserRole.podcaster
                          ? '/profile/podcast-details'
                          : '/profile/creator-details'),
                ).then((_) => _loadProfileData()),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _infoTile(
                icon: Icons.payments_outlined,
                title: 'Starting Rate',
                value: rate,
              ),
              const SizedBox(width: 12),
              _infoTile(
                icon: Icons.event_available_rounded,
                title: 'Availability',
                value: _creatorDetails.availability == AvailabilityStatus.availableNow
                    ? 'Available Now'
                    : 'Booking Soon',
              ),
            ],
          ),
          if (_creatorDetails.contentTypes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _creatorDetails.contentTypes
                  .map(
                    (tag) => Chip(
                      label: Text(
                        tag,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      backgroundColor: AppColors.primary.withOpacity(0.18),
                      side: BorderSide.none,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  // ==============================================================================
  // 6B. Brand Company Card
  // ==============================================================================
  Widget _buildBrandCompanyCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Company Details',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.textPrimary,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 17),
                color: AppColors.textPrimary,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () =>
                    Navigator.pushNamed(context, '/profile/company-details').then((_) => _loadProfileData()),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _infoTile(
            icon: Icons.business_rounded,
            title: 'Company Name',
            value: _companyDetails.companyName.isNotEmpty
                ? _companyDetails.companyName
                : 'Not set',
          ),
          const SizedBox(height: 8),
          _infoTile(
            icon: Icons.category_rounded,
            title: 'Industry',
            value: _companyDetails.businessCategory.isNotEmpty
                ? _companyDetails.businessCategory
                : 'Not set',
          ),
          if (_companyDetails.websiteUrl.isNotEmpty) ...[
            const SizedBox(height: 8),
            _infoTile(
              icon: Icons.link_rounded,
              title: 'Website',
              value: _companyDetails.websiteUrl,
            ),
          ],
        ],
      ),
    );
  }

  // ==============================================================================
  // 7. Categories & Skills Card
  // ==============================================================================
  Widget _buildCategoriesSkillsCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Categories & Skills',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.textPrimary,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 17),
                color: AppColors.textPrimary,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () =>
                    Navigator.pushNamed(context, '/profile/category-skills').then((_) => _loadProfileData()),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_userSkills.isEmpty)
            const Text(
              'No skills added yet. Select your core niche and skills for better brand matching.',
              style: TextStyle(
                fontSize: 12.5,
                color: AppColors.textMuted,
                fontStyle: FontStyle.italic,
              ),
            )
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _userSkills
                  .map(
                    (s) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.backgroundWarm,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        s.name,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }

  // ==============================================================================
  // 8. Social Accounts Card
  // ==============================================================================
  Widget _buildSocialAccountsCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Social Accounts',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.textPrimary,
                ),
              ),
              TextButton(
                onPressed: () =>
                    Navigator.pushNamed(context, '/profile/social-accounts').then((_) => _loadProfileData()),
                child: const Text(
                  'Manage',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Column(
            children: _socialAccounts.map((acc) {
              final isConnected = acc.status == SocialPlatformStatus.connected ||
                  acc.status == SocialPlatformStatus.verified;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      acc.platform.toLowerCase() == 'instagram'
                          ? Icons.camera_alt_outlined
                          : (acc.platform.toLowerCase() == 'youtube'
                              ? Icons.play_circle_outline_rounded
                              : Icons.link_rounded),
                      size: 18,
                      color: AppColors.textPrimary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        acc.platform,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    Text(
                      isConnected
                          ? (acc.handle != null ? '@${acc.handle}' : 'Connected')
                          : 'Not Connected',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isConnected ? Colors.green : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ==============================================================================
  // 9. Deep Editing Shortcuts
  // ==============================================================================
  Widget _buildDeepEditingShortcuts() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          onPressed: () =>
              Navigator.pushNamed(context, '/profile/completion').then((_) => _loadProfileData()),
          icon: const Icon(Icons.checklist_rounded, size: 18),
          label: const Text(
            'Open Full Profile Setup Checklist',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.textPrimary,
            side: const BorderSide(color: AppColors.border, width: 1.5),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }

  Widget _infoTile({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.backgroundWarm,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==============================================================================
  // Quick Edit Profile Modal Sheet
  // ==============================================================================
  void _openEditProfileModal() {
    final nameCtrl = TextEditingController(text: _displayName);
    final bioCtrl = TextEditingController(text: _basicInfo.bio);
    final cityCtrl = TextEditingController(text: _basicInfo.city);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Grabber handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Edit Profile',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const Divider(),
                  const SizedBox(height: 8),

                  // Display Name
                  const Text(
                    'Display Name',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: nameCtrl,
                    decoration: InputDecoration(
                      hintText: 'Enter your name',
                      filled: true,
                      fillColor: AppColors.backgroundWarm,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Bio
                  const Text(
                    'About / Bio',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: bioCtrl,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Describe your aesthetic, focus, and content style...',
                      filled: true,
                      fillColor: AppColors.backgroundWarm,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      contentPadding: const EdgeInsets.all(12),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // City
                  const Text(
                    'City / Location',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: cityCtrl,
                    decoration: InputDecoration(
                      hintText: 'e.g. Mumbai, Delhi NCR, Bengaluru',
                      filled: true,
                      fillColor: AppColors.backgroundWarm,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Non-Editable Credentials Notice
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.backgroundWarm,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.lock_rounded, size: 14, color: AppColors.textMuted),
                            SizedBox(width: 6),
                            Text(
                              'Locked Authentication Credentials',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Email: $_userEmail',
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                        if (_userPhone.isNotEmpty)
                          Text(
                            'Mobile: $_userPhone',
                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                          ),
                        const SizedBox(height: 2),
                        const Text(
                          'Security Notice: Contact support if you need to update registered phone or email.',
                          style: TextStyle(fontSize: 10, fontStyle: FontStyle.italic, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () async {
                            final updatedName = nameCtrl.text.trim();
                            final updatedBio = bioCtrl.text.trim();
                            final updatedCity = cityCtrl.text.trim();

                            final newBasic = _basicInfo.copyWith(
                              displayName: updatedName,
                              bio: updatedBio,
                              city: updatedCity,
                            );

                            final nav = Navigator.of(ctx);
                            final messenger = ScaffoldMessenger.of(context);
                            await _repo.updateBasicInfo(newBasic);
                            if (mounted) {
                              nav.pop();
                              messenger.showSnackBar(
                                const SnackBar(
                                  content: Text('Profile updated successfully!'),
                                  backgroundColor: Colors.green,
                                ),
                              );
                              _loadProfileData();
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.textPrimary,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Save Changes',
                            style: TextStyle(fontWeight: FontWeight.w800),
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
      },
    );
  }

  void _showLogoutConfirmDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Log Out',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        content: const Text(
          'Are you sure you want to log out of your CreatorConnect account?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w700),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await Supabase.instance.client.auth.signOut();
              if (mounted) {
                Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text(
              'Log Out',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
