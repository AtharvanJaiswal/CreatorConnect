import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../auth/domain/entities/user_role.dart';
import '../../../auth/data/datasources/auth_local_datasource.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/entities/taxonomy_data.dart';
import '../../domain/repositories/profile_repository.dart';
import '../datasources/profile_remote_datasource.dart';
import '../datasources/profile_local_datasource.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  static ProfileRepositoryImpl? _sharedInstance;

  final ProfileRemoteDataSource _remoteDataSource;
  final AuthLocalDataSource _localDataSource;
  final ProfileLocalDataSource _profileLocalDataSource;

  AuthLocalDataSource get localDataSource => _localDataSource;
  ProfileLocalDataSource get profileLocalDataSource => _profileLocalDataSource;

  // Real dynamic user profile state
  BasicInfoData _basicInfo = const BasicInfoData(
    displayName: '',
    bio: '',
    city: '',
    hubName: '',
    languages: [],
  );

  List<UserSkillSelection> _userSkills = [];
  List<String> _selectedCategoryIds = [];

  @override
  List<String> get selectedCategoryIds => _selectedCategoryIds;

  CreatorDetailsData _creatorDetails = const CreatorDetailsData(
    contentTypes: [],
    minRate: null,
    maxRate: null,
    rateUnit: RateUnit.perProject,
    showRateOnProfile: true,
    availability: AvailabilityStatus.availableNow,
  );

  ProfessionalDetailsData _professionalDetails = const ProfessionalDetailsData(
    professionalType: '',
    experience: '',
    tools: [],
    minRate: null,
    maxRate: null,
    rateUnit: RateUnit.perProject,
    hasPortfolioSample: false,
  );

  PodcastDetailsData _podcastDetails = const PodcastDetailsData(
    showName: '',
    category: '',
    description: '',
    platformLinks: [],
    frequency: ReleaseFrequency.weekly,
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

  List<SocialPlatformAccount> _socialAccounts = [
    const SocialPlatformAccount(
      platform: 'Instagram',
      status: SocialPlatformStatus.notConnected,
    ),
    const SocialPlatformAccount(
      platform: 'YouTube',
      status: SocialPlatformStatus.notConnected,
    ),
    const SocialPlatformAccount(
      platform: 'LinkedIn',
      status: SocialPlatformStatus.notConnected,
    ),
    const SocialPlatformAccount(
      platform: 'X',
      status: SocialPlatformStatus.notConnected,
    ),
  ];

  VerificationData _verificationData = const VerificationData(
    state: VerificationState.notStarted,
    attemptsRemaining: 3,
  );

  bool _hasFetchedFromBackend = false;
  Future<void>? _loadLocalFuture;
  final Set<String> _dirtyLocalSections = {};

  /// Default singleton access for the app so state persists across all screens
  static ProfileRepositoryImpl get instance {
    _sharedInstance ??= ProfileRepositoryImpl._internal();
    return _sharedInstance!;
  }

  /// Reset singleton for testing
  static void resetForTesting() {
    _sharedInstance = null;
  }

  /// Set singleton instance for testing
  static void setMockInstanceForTesting(ProfileRepositoryImpl instance) {
    _sharedInstance = instance;
  }

  /// Reloads profile cleanly from backend for current authenticated user,
  /// clearing any prior session's in-memory cache to prevent cross-account pollution.
  Future<void> reloadFromBackend() async {
    _hasFetchedFromBackend = false;
    _loadLocalFuture = null;
    _dirtyLocalSections.clear();
    _basicInfo = const BasicInfoData(
      displayName: '',
      bio: '',
      city: '',
      hubName: '',
      languages: [],
    );
    _userSkills = [];
    _selectedCategoryIds = [];
    _creatorDetails = const CreatorDetailsData(
      contentTypes: [],
      minRate: null,
      maxRate: null,
      rateUnit: RateUnit.perProject,
      showRateOnProfile: true,
      availability: AvailabilityStatus.availableNow,
    );
    _professionalDetails = const ProfessionalDetailsData(
      professionalType: '',
      experience: '',
      tools: [],
      minRate: null,
      maxRate: null,
      rateUnit: RateUnit.perProject,
      hasPortfolioSample: false,
    );
    _podcastDetails = const PodcastDetailsData(
      showName: '',
      category: '',
      description: '',
      platformLinks: [],
      frequency: ReleaseFrequency.weekly,
    );
    _companyDetails = const CompanyDetailsData(
      companyName: '',
      description: '',
      businessCategory: '',
      city: '',
      teamSize: '',
      websiteUrl: '',
      gstNumber: null,
    );
    _socialAccounts = [
      const SocialPlatformAccount(platform: 'Instagram', status: SocialPlatformStatus.notConnected),
      const SocialPlatformAccount(platform: 'YouTube', status: SocialPlatformStatus.notConnected),
      const SocialPlatformAccount(platform: 'LinkedIn', status: SocialPlatformStatus.notConnected),
      const SocialPlatformAccount(platform: 'X', status: SocialPlatformStatus.notConnected),
    ];
    _verificationData = const VerificationData(state: VerificationState.notStarted, attemptsRemaining: 3);

    await _syncWithBackend();
  }

  factory ProfileRepositoryImpl({
    ProfileRemoteDataSource? remoteDataSource,
    AuthLocalDataSource? localDataSource,
    ProfileLocalDataSource? profileLocalDataSource,
  }) {
    if (remoteDataSource != null ||
        localDataSource != null ||
        profileLocalDataSource != null) {
      return ProfileRepositoryImpl._internal(
        remoteDataSource: remoteDataSource,
        localDataSource: localDataSource,
        profileLocalDataSource: profileLocalDataSource,
      );
    }
    return instance;
  }

  ProfileRepositoryImpl._internal({
    ProfileRemoteDataSource? remoteDataSource,
    AuthLocalDataSource? localDataSource,
    ProfileLocalDataSource? profileLocalDataSource,
  })  : _remoteDataSource = remoteDataSource ?? ProfileRemoteDataSource(),
        _localDataSource = localDataSource ?? AuthLocalDataSource(),
        _profileLocalDataSource =
            profileLocalDataSource ?? ProfileLocalDataSource();

  Future<void> _loadFromLocalStorage() {
    return _loadLocalFuture ??= _performLoadFromLocalStorage();
  }

  Future<void> _performLoadFromLocalStorage() async {
    try {
      final savedBasic = await _profileLocalDataSource.getBasicInfo();
      if (savedBasic != null && !_dirtyLocalSections.contains('basic')) {
        _basicInfo = savedBasic;
      }

      final savedCatIds = await _profileLocalDataSource.getSelectedCategories();
      if (savedCatIds != null &&
          savedCatIds.isNotEmpty &&
          !_dirtyLocalSections.contains('categories')) {
        _selectedCategoryIds = savedCatIds;
      }

      final savedSkills = await _profileLocalDataSource.getUserSkills();
      if (savedSkills != null &&
          savedSkills.isNotEmpty &&
          !_dirtyLocalSections.contains('skills')) {
        _userSkills = savedSkills;
      }

      final savedCreator = await _profileLocalDataSource.getCreatorDetails();
      if (savedCreator != null && !_dirtyLocalSections.contains('creator')) {
        _creatorDetails = savedCreator;
      }

      final savedPro = await _profileLocalDataSource.getProfessionalDetails();
      if (savedPro != null && !_dirtyLocalSections.contains('professional')) {
        _professionalDetails = savedPro;
      }

      final savedPod = await _profileLocalDataSource.getPodcastDetails();
      if (savedPod != null && !_dirtyLocalSections.contains('podcast')) {
        _podcastDetails = savedPod;
      }

      final savedCompany = await _profileLocalDataSource.getCompanyDetails();
      if (savedCompany != null && !_dirtyLocalSections.contains('company')) {
        _companyDetails = savedCompany;
      }

      final savedSocial = await _profileLocalDataSource.getSocialAccounts();
      if (savedSocial != null &&
          savedSocial.isNotEmpty &&
          !_dirtyLocalSections.contains('social')) {
        _socialAccounts = savedSocial;
      }

      final savedVerif = await _profileLocalDataSource.getVerificationData();
      if (savedVerif != null && !_dirtyLocalSections.contains('verification')) {
        _verificationData = savedVerif;
      }
    } catch (e) {
      debugPrint('Notice: Error loading profile from local storage: $e');
    }
  }

  Future<void> _syncWithBackend() async {
    await _loadFromLocalStorage();
    if (_hasFetchedFromBackend) return;
    _hasFetchedFromBackend = true;

    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user != null) {
        final meta = user.userMetadata;
        final name = meta?['full_name'] as String? ??
            meta?['name'] as String? ??
            user.email?.split('@').first ??
            '';
        final avatar = meta?['avatar_url'] as String?;
        if (_basicInfo.displayName.isEmpty && name.isNotEmpty) {
          _basicInfo = _basicInfo.copyWith(
            displayName: name,
            photoUrl: avatar,
          );
          await _profileLocalDataSource.saveBasicInfo(_basicInfo);
        }
      }

      final me = await _remoteDataSource.getMeProfiles();
      if (me.isNotEmpty) {
        if (me['creator'] != null && me['creator'] is Map) {
          final c = me['creator'] as Map<String, dynamic>;
          _basicInfo = _basicInfo.copyWith(
            bio: c['bio'] as String? ?? _basicInfo.bio,
            city: c['locationCity'] as String? ?? _basicInfo.city,
          );
          await _profileLocalDataSource.saveBasicInfo(_basicInfo);

          if (c['startingRate'] != null) {
            _creatorDetails = _creatorDetails.copyWith(
              minRate: (c['startingRate'] as num?)?.toInt(),
            );
            await _profileLocalDataSource.saveCreatorDetails(_creatorDetails);
          }
          if (c['socialLinks'] != null && c['socialLinks'] is List) {
            final links = c['socialLinks'] as List;
            for (final link in links) {
              if (link is Map) {
                final p = link['platform'] as String?;
                final u = link['url'] as String?;
                if (p != null) {
                  _socialAccounts = _socialAccounts.map((acc) {
                    if (acc.platform.toLowerCase() == p.toLowerCase()) {
                      return acc.copyWith(
                        status: SocialPlatformStatus.connected,
                        handle: u?.split('/').last,
                        profileUrl: u,
                      );
                    }
                    return acc;
                  }).toList();
                }
              }
            }
            await _profileLocalDataSource.saveSocialAccounts(_socialAccounts);
          }
        }

        if (me['brand'] != null && me['brand'] is Map) {
          final b = me['brand'] as Map<String, dynamic>;
          _companyDetails = _companyDetails.copyWith(
            companyName:
                b['companyName'] as String? ?? _companyDetails.companyName,
            description: b['bio'] as String? ?? _companyDetails.description,
            businessCategory:
                b['industry'] as String? ?? _companyDetails.businessCategory,
            teamSize: b['companySize'] as String? ?? _companyDetails.teamSize,
            websiteUrl:
                b['websiteUrl'] as String? ?? _companyDetails.websiteUrl,
          );
          await _profileLocalDataSource.saveCompanyDetails(_companyDetails);
        }

        if (me['professional'] != null && me['professional'] is Map) {
          final p = me['professional'] as Map<String, dynamic>;
          _professionalDetails = _professionalDetails.copyWith(
            professionalType:
                p['headline'] as String? ?? _professionalDetails.professionalType,
            minRate:
                (p['dayRate'] as num?)?.toInt() ?? _professionalDetails.minRate,
          );
          await _profileLocalDataSource
              .saveProfessionalDetails(_professionalDetails);
        }

        if (me['podcaster'] != null && me['podcaster'] is Map) {
          final pod = me['podcaster'] as Map<String, dynamic>;
          _podcastDetails = _podcastDetails.copyWith(
            showName:
                pod['podcastName'] as String? ?? _podcastDetails.showName,
            description:
                pod['description'] as String? ?? _podcastDetails.description,
          );
          await _profileLocalDataSource.savePodcastDetails(_podcastDetails);
        }

        if (me['skills'] != null && me['skills'] is List) {
          final skList = me['skills'] as List;
          _userSkills = skList.map((e) {
            final item = e as Map<String, dynamic>;
            return UserSkillSelection(
              skillId: item['skillId'] as String? ?? item['id'] as String? ?? '',
              name: item['name'] as String? ?? (item['skill']?['name'] as String? ?? 'Skill'),
              proficiency:
                  SkillProficiencyLevel.fromString(item['proficiency'] as String?),
            );
          }).toList();
          await _profileLocalDataSource.saveUserSkills(_userSkills);
        }
      }
    } catch (_) {}
  }

  // ==============================================================================
  // Immediate Draft / Selection Storing (stored whenever app is not closed)
  // ==============================================================================

  @override
  Future<void> saveBasicInfoDraft(BasicInfoData data) async {
    _dirtyLocalSections.add('basic');
    _basicInfo = data;
    await _profileLocalDataSource.saveBasicInfo(data);
  }

  @override
  Future<void> saveCategorySelection(List<String> categoryIds) async {
    _dirtyLocalSections.add('categories');
    _selectedCategoryIds = List.from(categoryIds);
    await _profileLocalDataSource.saveSelectedCategories(_selectedCategoryIds);
  }

  @override
  Future<void> saveSkillSelection(List<UserSkillSelection> skills) async {
    _dirtyLocalSections.add('skills');
    _userSkills = List.from(skills);
    await _profileLocalDataSource.saveUserSkills(_userSkills);
  }

  @override
  Future<void> saveCreatorDetailsDraft(CreatorDetailsData data) async {
    _dirtyLocalSections.add('creator');
    _creatorDetails = data;
    await _profileLocalDataSource.saveCreatorDetails(data);
  }

  @override
  Future<void> saveProfessionalDetailsDraft(ProfessionalDetailsData data) async {
    _dirtyLocalSections.add('professional');
    _professionalDetails = data;
    await _profileLocalDataSource.saveProfessionalDetails(data);
  }

  @override
  Future<void> savePodcastDetailsDraft(PodcastDetailsData data) async {
    _dirtyLocalSections.add('podcast');
    _podcastDetails = data;
    await _profileLocalDataSource.savePodcastDetails(data);
  }

  @override
  Future<void> saveCompanyDetailsDraft(CompanyDetailsData data) async {
    _dirtyLocalSections.add('company');
    _companyDetails = data;
    await _profileLocalDataSource.saveCompanyDetails(data);
  }

  @override
  Future<void> saveSocialAccountsDraft(
      List<SocialPlatformAccount> accounts) async {
    _dirtyLocalSections.add('social');
    _socialAccounts = List.from(accounts);
    await _profileLocalDataSource.saveSocialAccounts(_socialAccounts);
  }

  @override
  Future<void> saveVerificationDraft(VerificationData data) async {
    _dirtyLocalSections.add('verification');
    _verificationData = data;
    await _profileLocalDataSource.saveVerificationData(data);
  }

  // ==============================================================================
  // Helpers & Role Resolution
  // ==============================================================================

  @override
  Future<UserRole> resolveActiveRole({UserRole? fallback}) async {
    final savedRole = await _localDataSource.getSelectedRole();
    if (savedRole != null && savedRole.trim().isNotEmpty) {
      return UserRole.fromString(savedRole);
    }
    try {
      final user = Supabase.instance.client.auth.currentUser;
      final metaRole = user?.userMetadata?['role'] as String?;
      if (metaRole != null && metaRole.trim().isNotEmpty) {
        return UserRole.fromString(metaRole);
      }
    } catch (_) {
      // Supabase may not be initialized in unit/widget tests.
    }
    return fallback ?? UserRole.creator;
  }

  String? _normalizeHttpsUrl(String? raw) {
    if (raw == null) return null;
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('http://')) {
      return 'https://${trimmed.substring(7)}';
    }
    return 'https://$trimmed';
  }

  String _buildSocialProfileUrl(String platform, String cleanHandle) {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 'instagram.com/$cleanHandle';
      case 'youtube':
        return 'youtube.com/@$cleanHandle';
      case 'linkedin':
        return 'linkedin.com/in/$cleanHandle';
      case 'x':
      case 'twitter':
        return 'x.com/$cleanHandle';
      default:
        return '${platform.toLowerCase()}.com/$cleanHandle';
    }
  }

  // ==============================================================================
  // Profile Overview
  // ==============================================================================

  @override
  Future<ProfileOverviewData> getProfileOverview({required UserRole role}) async {
    await _syncWithBackend();

    if (role == UserRole.brand) {
      final isCompanyDone = _companyDetails.companyName.isNotEmpty &&
          _companyDetails.description.isNotEmpty;
      final isVerificationDone =
          _verificationData.state == VerificationState.approved;

      int pct = 0;
      if (isCompanyDone) pct += 40;
      if (_verificationData.state == VerificationState.underReview) pct += 30;
      if (isVerificationDone) pct += 60;

      return ProfileOverviewData(
        completionPercentage: pct,
        isLevel1: isCompanyDone,
        isLevel2: isVerificationDone,
        nextActionTitle:
            isCompanyDone ? 'Business verification' : 'Company details',
        nextActionKey: isCompanyDone ? 'verification' : 'companyDetails',
        requiredSections: [
          ProfileSectionItem(
            key: 'companyDetails',
            title: 'Company details',
            subtitle: isCompanyDone
                ? '${_companyDetails.businessCategory} · ${_companyDetails.city}'
                : 'Company name and description missing',
            isRequired: true,
            isDone: isCompanyDone,
          ),
        ],
        verificationSections: [
          ProfileSectionItem(
            key: 'verification',
            title: 'Business verification',
            subtitle: isCompanyDone
                ? 'Upload documents for review'
                : 'Finish company details first',
            isRequired: false,
            isDone: isVerificationDone,
            isLocked: !isCompanyDone,
            lockReason: 'Finish company details first',
          ),
          const ProfileSectionItem(
            key: 'plan',
            title: 'Choose a plan',
            subtitle: 'Optional · you start on Free',
            isRequired: false,
            isDone: false,
          ),
        ],
      );
    }

    // Creator / Professional / Podcaster
    final isBasicDone = _basicInfo.displayName.isNotEmpty &&
        _basicInfo.bio.isNotEmpty &&
        _basicInfo.city.isNotEmpty;
    final isTaxonomyDone =
        _userSkills.isNotEmpty || _selectedCategoryIds.isNotEmpty;
    bool isRoleDone = false;

    if (role == UserRole.creator) {
      isRoleDone = _creatorDetails.contentTypes.isNotEmpty;
    } else if (role == UserRole.professional) {
      isRoleDone = _professionalDetails.professionalType.isNotEmpty;
    } else {
      isRoleDone = _podcastDetails.showName.isNotEmpty &&
          _podcastDetails.platformLinks.isNotEmpty;
    }

    final connectedAccounts = _socialAccounts
        .where((a) =>
            a.status == SocialPlatformStatus.connected ||
            a.status == SocialPlatformStatus.verified)
        .toList();
    final isSocialConnected = connectedAccounts.isNotEmpty;
    final isLevel1 = isBasicDone && isTaxonomyDone && isRoleDone;
    final isVerified = _verificationData.state == VerificationState.approved;

    // Creator & Podcaster Level 1 weighted breakdown:
    // Basic Info (30%) + Categories & Skills (25%) + Rates & Availability (25%) + Social Accounts (20%) = 100%
    int pct = 0;
    if (isBasicDone) pct += 30;
    if (isTaxonomyDone) pct += 25;
    if (isRoleDone) pct += 25;
    if (isSocialConnected) pct += 20;

    String nextKey = 'basicInfo';
    String nextTitle = 'Basic information';
    if (isBasicDone && !isTaxonomyDone) {
      nextKey = 'categorySkills';
      nextTitle = 'Category and skills';
    } else if (isBasicDone && isTaxonomyDone && !isRoleDone) {
      nextKey = 'roleDetails';
      nextTitle = role == UserRole.creator
          ? 'Creator details'
          : (role == UserRole.professional
              ? 'Professional details'
              : 'Podcast details');
    } else if (isLevel1 && !isSocialConnected) {
      nextKey = 'socialAccounts';
      nextTitle = 'Social accounts';
    } else if (isLevel1 && isSocialConnected && !isVerified) {
      nextKey = 'verification';
      nextTitle = 'Get verified';
    }

    final connectedSummary = connectedAccounts.map((a) => a.platform).join(', ');

    return ProfileOverviewData(
      completionPercentage: pct,
      isLevel1: isLevel1,
      isLevel2: isVerified,
      nextActionTitle: nextTitle,
      nextActionKey: nextKey,
      requiredSections: [
        ProfileSectionItem(
          key: 'basicInfo',
          title: 'Basic information',
          subtitle: isBasicDone
              ? 'Photo, name, bio, city'
              : 'Display name or city missing',
          isRequired: true,
          isDone: isBasicDone,
        ),
        ProfileSectionItem(
          key: 'categorySkills',
          title: 'Category and skills',
          subtitle: isTaxonomyDone
              ? '${_userSkills.length} skills selected'
              : 'Pick category and skills',
          isRequired: true,
          isDone: isTaxonomyDone,
        ),
        ProfileSectionItem(
          key: 'roleDetails',
          title: role == UserRole.creator
              ? 'Creator details'
              : (role == UserRole.professional
                  ? 'Professional details'
                  : 'Podcast details'),
          subtitle: isRoleDone
              ? 'Formats and details saved'
              : 'Add formats or role details',
          isRequired: true,
          isDone: isRoleDone,
        ),
      ],
      verificationSections: [
        ProfileSectionItem(
          key: 'socialAccounts',
          title: 'Social accounts',
          subtitle: isSocialConnected
              ? '$connectedSummary connected'
              : 'Connect a social account to start',
          isRequired: false,
          isDone: isSocialConnected,
        ),
        ProfileSectionItem(
          key: 'verification',
          title: 'Verification',
          subtitle: isSocialConnected
              ? 'Submit code in bio for review'
              : 'Connect a social account first',
          isRequired: false,
          isDone: isVerified,
          isLocked: !isSocialConnected,
          lockReason: 'Connect a social account first',
        ),
      ],
    );
  }

  // ==============================================================================
  // Section Updates (Local Storage + Remote Backend API + Supabase)
  // ==============================================================================

  @override
  Future<BasicInfoData> getBasicInfo() async {
    await _syncWithBackend();
    return _basicInfo;
  }

  @override
  Future<void> updateBasicInfo(BasicInfoData data) async {
    _dirtyLocalSections.add('basic');
    _basicInfo = data;
    await _profileLocalDataSource.saveBasicInfo(data);

    // Best-effort sync with Supabase Auth metadata
    try {
      await _remoteDataSource.syncWithSupabaseUserMetadata(
        displayName: data.displayName,
        avatarUrl: data.photoUrl,
        bio: data.bio,
        city: data.city,
      );
    } catch (e) {
      debugPrint('Notice: Supabase metadata sync skipped/failed: $e');
    }

    // Best-effort sync via Backend API
    try {
      final nameParts = data.displayName.trim().split(RegExp(r'\s+'));
      final firstName = nameParts.isNotEmpty ? nameParts.first : data.displayName.trim();
      final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : null;

      await _remoteDataSource.updateUserInfo(
        firstName: firstName,
        lastName: lastName,
        avatarUrl: data.photoUrl,
      );
      final activeRole = await resolveActiveRole();
      if (activeRole == UserRole.creator) {
        await _remoteDataSource.updateCreatorProfile({
          'bio': data.bio,
          'locationCity': data.city,
        });
      } else if (activeRole == UserRole.brand &&
          _companyDetails.companyName.isNotEmpty) {
        await _remoteDataSource.updateBrandProfile({
          'companyName': _companyDetails.companyName,
          'bio': data.bio,
        });
      }
    } catch (e) {
      debugPrint('Notice: Remote basic info sync failed (saved locally): $e');
    }
  }

  @override
  Future<List<CategoryItem>> getCategories() =>
      _remoteDataSource.getCategories();

  @override
  Future<List<SkillItem>> getSkills() => _remoteDataSource.getSkills();

  @override
  Future<List<UserSkillSelection>> getUserSkills() async {
    await _syncWithBackend();
    return _userSkills;
  }

  @override
  Future<void> updateUserSkills(
      List<UserSkillSelection> skills, List<String> categoryIds) async {
    _dirtyLocalSections.add('skills');
    _dirtyLocalSections.add('categories');
    _userSkills = List.from(skills);
    _selectedCategoryIds = List.from(categoryIds);

    // Save locally first
    await _profileLocalDataSource.saveUserSkills(_userSkills);
    await _profileLocalDataSource.saveSelectedCategories(_selectedCategoryIds);

    // Best-effort sync via Backend API
    try {
      await _remoteDataSource.updateUserSkills(skills);

      final currentRole = await resolveActiveRole();
      if (currentRole == UserRole.creator) {
        await _remoteDataSource.updateCreatorProfile({
          'categoryIds': categoryIds,
        });
      }
    } catch (e) {
      debugPrint('Notice: Remote skills sync failed (saved locally): $e');
    }
  }

  @override
  Future<CreatorDetailsData> getCreatorDetails() async {
    await _syncWithBackend();
    return _creatorDetails;
  }

  @override
  Future<void> updateCreatorDetails(CreatorDetailsData data) async {
    _dirtyLocalSections.add('creator');
    _creatorDetails = data;
    await _profileLocalDataSource.saveCreatorDetails(data);

    // Best-effort sync via Backend API
    try {
      final payload = <String, dynamic>{
        'isRemote': data.availability != AvailabilityStatus.busy,
      };
      if (data.minRate != null) {
        payload['startingRate'] = data.minRate;
      }
      await _remoteDataSource.updateCreatorProfile(payload);
    } catch (e) {
      debugPrint('Notice: Remote creator details sync failed (saved locally): $e');
    }
  }

  @override
  Future<ProfessionalDetailsData> getProfessionalDetails() async {
    await _syncWithBackend();
    return _professionalDetails;
  }

  @override
  Future<void> updateProfessionalDetails(ProfessionalDetailsData data) async {
    _dirtyLocalSections.add('professional');
    _professionalDetails = data;
    await _profileLocalDataSource.saveProfessionalDetails(data);

    // Best-effort sync via Backend API
    try {
      final payload = <String, dynamic>{
        'headline': data.professionalType,
        'equipmentList': data.tools,
      };
      if (data.minRate != null) {
        payload['dayRate'] = data.minRate;
      }
      await _remoteDataSource.updateProfessionalProfile(payload);
    } catch (e) {
      debugPrint('Notice: Remote professional details sync failed (saved locally): $e');
    }
  }

  @override
  Future<PodcastDetailsData> getPodcastDetails() async {
    await _syncWithBackend();
    return _podcastDetails;
  }

  @override
  Future<void> updatePodcastDetails(PodcastDetailsData data) async {
    _dirtyLocalSections.add('podcast');
    _podcastDetails = data;
    await _profileLocalDataSource.savePodcastDetails(data);

    // Best-effort sync via Backend API (omit null/empty URLs to satisfy HttpsUrlSchema)
    try {
      final firstLink = data.platformLinks.isNotEmpty
          ? _normalizeHttpsUrl(data.platformLinks.first)
          : null;
      await _remoteDataSource.updatePodcasterProfile({
        'podcastName': data.showName,
        'description': data.description,
        if (firstLink != null) 'rssFeedUrl': firstLink,
      });
    } catch (e) {
      debugPrint('Notice: Remote podcast details sync failed (saved locally): $e');
    }
  }

  @override
  Future<CompanyDetailsData> getCompanyDetails() async {
    await _syncWithBackend();
    return _companyDetails;
  }

  @override
  Future<void> updateCompanyDetails(CompanyDetailsData data) async {
    _dirtyLocalSections.add('company');
    _companyDetails = data;
    await _profileLocalDataSource.saveCompanyDetails(data);

    // Best-effort sync via Backend API (normalize website URL to https://)
    try {
      final cleanWebsite = _normalizeHttpsUrl(data.websiteUrl);
      await _remoteDataSource.updateBrandProfile({
        'companyName': data.companyName,
        if (data.businessCategory.isNotEmpty) 'industry': data.businessCategory,
        if (data.teamSize.isNotEmpty) 'companySize': data.teamSize,
        if (cleanWebsite != null) 'websiteUrl': cleanWebsite,
        if (data.description.isNotEmpty) 'bio': data.description,
      });
    } catch (e) {
      debugPrint('Notice: Remote company details sync failed (saved locally): $e');
    }
  }

  @override
  Future<List<SocialPlatformAccount>> getSocialAccounts() async {
    await _syncWithBackend();
    return _socialAccounts;
  }

  @override
  Future<SocialPlatformAccount> connectSocialAccount(
      String platform, String handle) async {
    final cleanHandle = handle.trim().replaceFirst(RegExp(r'^@+'), '');
    final updated = SocialPlatformAccount(
      platform: platform,
      handle: cleanHandle,
      status: SocialPlatformStatus.connected,
      followersCount: null,
      postsCount: null,
      lastSyncedText: 'Just now',
      profileUrl: _buildSocialProfileUrl(platform, cleanHandle),
    );

    final exists = _socialAccounts
        .any((a) => a.platform.toLowerCase() == platform.toLowerCase());
    if (exists) {
      _socialAccounts = _socialAccounts.map((a) {
        if (a.platform.toLowerCase() == platform.toLowerCase()) {
          return updated;
        }
        return a;
      }).toList();
    } else {
      _socialAccounts = [..._socialAccounts, updated];
    }

    // Persist locally first
    _dirtyLocalSections.add('social');
    await _profileLocalDataSource.saveSocialAccounts(_socialAccounts);

    // Best-effort persist to backend
    try {
      final activeRole = await resolveActiveRole();
      if (activeRole == UserRole.creator) {
        await _remoteDataSource.updateCreatorProfile({
          'socialLinks': _socialAccounts
              .where((a) =>
                  a.handle != null &&
                  a.profileUrl != null &&
                  a.profileUrl!.trim().isNotEmpty)
              .map((a) {
                final cleanUrl = _normalizeHttpsUrl(a.profileUrl);
                return {'platform': a.platform, 'url': cleanUrl ?? a.profileUrl!.trim()};
              })
              .toList(),
        });
      }
    } catch (e) {
      debugPrint('Notice: Remote social account sync failed (saved locally): $e');
    }

    return updated;
  }

  @override
  Future<void> disconnectSocialAccount(String platform) async {
    _socialAccounts = _socialAccounts.map((a) {
      if (a.platform.toLowerCase() == platform.toLowerCase()) {
        return SocialPlatformAccount(
            platform: platform, status: SocialPlatformStatus.notConnected);
      }
      return a;
    }).toList();

    // Persist locally first
    _dirtyLocalSections.add('social');
    await _profileLocalDataSource.saveSocialAccounts(_socialAccounts);

    try {
      final activeRole = await resolveActiveRole();
      if (activeRole == UserRole.creator) {
        await _remoteDataSource.updateCreatorProfile({
          'socialLinks': _socialAccounts
              .where((a) =>
                  a.handle != null &&
                  a.profileUrl != null &&
                  a.profileUrl!.trim().isNotEmpty)
              .map((a) {
                final cleanUrl = _normalizeHttpsUrl(a.profileUrl);
                return {'platform': a.platform, 'url': cleanUrl ?? a.profileUrl!.trim()};
              })
              .toList(),
        });
      }
    } catch (e) {
      debugPrint('Notice: Remote social disconnect sync failed (saved locally): $e');
    }
  }

  @override
  Future<VerificationData> getVerificationData() async {
    await _syncWithBackend();
    try {
      final status = await _remoteDataSource.getVerificationStatus();
      if (status != null) {
        final isVerified = status['isVerified'] as bool? ?? false;
        final stateStr = status['state'] as String? ?? (isVerified ? 'APPROVED' : 'NOT_STARTED');
        final upper = stateStr.toUpperCase().replaceAll('_', '');
        VerificationState st;
        switch (upper) {
          case 'APPROVED':
            st = VerificationState.approved;
            break;
          case 'UNDERREVIEW':
            st = VerificationState.underReview;
            break;
          case 'CHANGESNEEDED':
          case 'REJECTED':
            st = VerificationState.changesNeeded;
            break;
          default:
            st = isVerified ? VerificationState.approved : VerificationState.notStarted;
        }
        final subAcct = status['submittedAccount'] as String? ??
            status['handle'] as String? ??
            status['businessName'] as String? ??
            _verificationData.submittedAccount;
        _verificationData = _verificationData.copyWith(
          state: st,
          submittedAccount: subAcct,
          oneTimeCode: status['oneTimeCode'] as String? ?? _verificationData.oneTimeCode,
        );
        await _profileLocalDataSource.saveVerificationData(_verificationData);
      }
    } catch (_) {}
    return _verificationData;
  }

  String _formatCurrentTimestamp() {
    final now = DateTime.now();
    final h = now.hour.toString().padLeft(2, '0');
    final m = now.minute.toString().padLeft(2, '0');
    return 'Today, $h:$m';
  }

  @override
  Future<void> submitCreatorVerification(
      String platform, String handle, String code) async {
    _dirtyLocalSections.add('verification');
    final cleanHandle = handle.trim().replaceFirst(RegExp(r'^@+'), '');
    _verificationData = _verificationData.copyWith(
      state: VerificationState.underReview,
      submittedAccount: '$platform @$cleanHandle',
      oneTimeCode: code,
      submittedDate: _formatCurrentTimestamp(),
    );
    await _profileLocalDataSource.saveVerificationData(_verificationData);

    try {
      await _remoteDataSource.submitCreatorVerification(
          platform, cleanHandle, code);
    } catch (e) {
      debugPrint(
          'Notice: Remote creator verification sync failed (saved locally): $e');
    }
  }

  @override
  Future<void> submitBrandVerification({
    required String businessName,
    required String regNumber,
    required String person,
    required List<String> documents,
  }) async {
    _dirtyLocalSections.add('verification');
    _verificationData = _verificationData.copyWith(
      state: VerificationState.underReview,
      submittedAccount: businessName,
      brandDocumentNames: documents,
      submittedDate: _formatCurrentTimestamp(),
    );
    await _profileLocalDataSource.saveVerificationData(_verificationData);

    try {
      await _remoteDataSource.submitBrandVerification(
        businessName: businessName,
        regNumber: regNumber,
        person: person,
        documents: documents,
      );
    } catch (e) {
      debugPrint(
          'Notice: Remote brand verification sync failed (saved locally): $e');
    }
  }

  @override
  Future<void> addSecondaryRole(UserRole role) async {
    await _localDataSource.saveSelectedRole(role.apiValue);
    try {
      await _remoteDataSource.syncSecondaryRole(role.apiValue);
    } catch (e) {
      debugPrint('Notice: Remote secondary role sync failed (saved locally): $e');
    }
  }
}
