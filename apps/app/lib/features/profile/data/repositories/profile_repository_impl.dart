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
  bool _hasLoadedFromLocal = false;

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
            profileLocalDataSource ?? ProfileLocalDataSource() {
    _loadFromLocalStorage();
  }

  Future<void> _loadFromLocalStorage() async {
    if (_hasLoadedFromLocal) return;
    _hasLoadedFromLocal = true;

    try {
      final savedBasic = await _profileLocalDataSource.getBasicInfo();
      if (savedBasic != null) {
        _basicInfo = savedBasic;
      }

      final savedCatIds = await _profileLocalDataSource.getSelectedCategories();
      if (savedCatIds != null && savedCatIds.isNotEmpty) {
        _selectedCategoryIds = savedCatIds;
      }

      final savedSkills = await _profileLocalDataSource.getUserSkills();
      if (savedSkills != null && savedSkills.isNotEmpty) {
        _userSkills = savedSkills;
      }

      final savedCreator = await _profileLocalDataSource.getCreatorDetails();
      if (savedCreator != null) {
        _creatorDetails = savedCreator;
      }

      final savedPro = await _profileLocalDataSource.getProfessionalDetails();
      if (savedPro != null) {
        _professionalDetails = savedPro;
      }

      final savedPod = await _profileLocalDataSource.getPodcastDetails();
      if (savedPod != null) {
        _podcastDetails = savedPod;
      }

      final savedCompany = await _profileLocalDataSource.getCompanyDetails();
      if (savedCompany != null) {
        _companyDetails = savedCompany;
      }

      final savedSocial = await _profileLocalDataSource.getSocialAccounts();
      if (savedSocial != null && savedSocial.isNotEmpty) {
        _socialAccounts = savedSocial;
      }

      final savedVerif = await _profileLocalDataSource.getVerificationData();
      if (savedVerif != null) {
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
    _basicInfo = data;
    await _profileLocalDataSource.saveBasicInfo(data);
  }

  @override
  Future<void> saveCategorySelection(List<String> categoryIds) async {
    _selectedCategoryIds = List.from(categoryIds);
    await _profileLocalDataSource.saveSelectedCategories(_selectedCategoryIds);
  }

  @override
  Future<void> saveSkillSelection(List<UserSkillSelection> skills) async {
    _userSkills = List.from(skills);
    await _profileLocalDataSource.saveUserSkills(_userSkills);
  }

  @override
  Future<void> saveCreatorDetailsDraft(CreatorDetailsData data) async {
    _creatorDetails = data;
    await _profileLocalDataSource.saveCreatorDetails(data);
  }

  @override
  Future<void> saveProfessionalDetailsDraft(ProfessionalDetailsData data) async {
    _professionalDetails = data;
    await _profileLocalDataSource.saveProfessionalDetails(data);
  }

  @override
  Future<void> savePodcastDetailsDraft(PodcastDetailsData data) async {
    _podcastDetails = data;
    await _profileLocalDataSource.savePodcastDetails(data);
  }

  @override
  Future<void> saveCompanyDetailsDraft(CompanyDetailsData data) async {
    _companyDetails = data;
    await _profileLocalDataSource.saveCompanyDetails(data);
  }

  @override
  Future<void> saveSocialAccountsDraft(
      List<SocialPlatformAccount> accounts) async {
    _socialAccounts = List.from(accounts);
    await _profileLocalDataSource.saveSocialAccounts(_socialAccounts);
  }

  @override
  Future<void> saveVerificationDraft(VerificationData data) async {
    _verificationData = data;
    await _profileLocalDataSource.saveVerificationData(data);
  }

  // ==============================================================================
  // Profile Overview
  // ==============================================================================

  @override
  Future<ProfileOverviewData> getProfileOverview({required UserRole role}) async {
    await _syncWithBackend();

    if (role == UserRole.brand) {
      final isCompanyDone = _companyDetails.companyName.isNotEmpty &&
          _companyDetails.description.isNotEmpty &&
          _companyDetails.websiteUrl.isNotEmpty;
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
                : 'Website and description missing',
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
    final isTaxonomyDone = _userSkills.isNotEmpty;
    bool isRoleDone = false;

    if (role == UserRole.creator) {
      isRoleDone = _creatorDetails.contentTypes.isNotEmpty &&
          _creatorDetails.minRate != null;
    } else if (role == UserRole.professional) {
      isRoleDone = _professionalDetails.professionalType.isNotEmpty &&
          _professionalDetails.minRate != null;
    } else {
      isRoleDone = _podcastDetails.showName.isNotEmpty &&
          _podcastDetails.platformLinks.isNotEmpty;
    }

    final isLevel1 = isBasicDone && isTaxonomyDone && isRoleDone;
    final isSocialConnected = _socialAccounts.any((a) =>
        a.status == SocialPlatformStatus.connected ||
        a.status == SocialPlatformStatus.verified);
    final isVerified = _verificationData.state == VerificationState.approved;

    int pct = 0;
    if (isBasicDone) pct += 30;
    if (isTaxonomyDone) pct += 20;
    if (isRoleDone) pct += 20;
    if (isSocialConnected) pct += 15;
    if (isVerified) pct += 15;

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
              ? 'Rates and availability set'
              : 'Rate and availability missing',
          isRequired: true,
          isDone: isRoleDone,
        ),
      ],
      verificationSections: [
        ProfileSectionItem(
          key: 'socialAccounts',
          title: 'Social accounts',
          subtitle: isSocialConnected
              ? 'Instagram connected'
              : 'Connect Instagram to start',
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
    _basicInfo = data;
    await _profileLocalDataSource.saveBasicInfo(data);

    // Sync with Supabase Auth metadata
    await _remoteDataSource.syncWithSupabaseUserMetadata(
      displayName: data.displayName,
      avatarUrl: data.photoUrl,
      bio: data.bio,
      city: data.city,
    );

    // Sync via Backend API
    await _remoteDataSource.updateUserInfo(
      firstName: data.displayName,
      avatarUrl: data.photoUrl,
    );
    await _remoteDataSource.updateCreatorProfile({
      'bio': data.bio,
      'locationCity': data.city,
    });
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
    _userSkills = List.from(skills);
    _selectedCategoryIds = List.from(categoryIds);

    // Save locally
    await _profileLocalDataSource.saveUserSkills(_userSkills);
    await _profileLocalDataSource.saveSelectedCategories(_selectedCategoryIds);

    // Sync via Backend API
    await _remoteDataSource.updateUserSkills(skills);

    final currentRole = await _localDataSource.getSelectedRole();
    if (currentRole == null || currentRole.toUpperCase() == 'CREATOR') {
      await _remoteDataSource.updateCreatorProfile({
        'categoryIds': categoryIds,
      });
    }
  }

  @override
  Future<CreatorDetailsData> getCreatorDetails() async {
    await _syncWithBackend();
    return _creatorDetails;
  }

  @override
  Future<void> updateCreatorDetails(CreatorDetailsData data) async {
    _creatorDetails = data;
    await _profileLocalDataSource.saveCreatorDetails(data);

    // Sync via Backend API
    final payload = <String, dynamic>{
      'isRemote': data.availability != AvailabilityStatus.busy,
    };
    if (data.minRate != null) {
      payload['startingRate'] = data.minRate;
    }
    await _remoteDataSource.updateCreatorProfile(payload);
  }

  @override
  Future<ProfessionalDetailsData> getProfessionalDetails() async {
    await _syncWithBackend();
    return _professionalDetails;
  }

  @override
  Future<void> updateProfessionalDetails(ProfessionalDetailsData data) async {
    _professionalDetails = data;
    await _profileLocalDataSource.saveProfessionalDetails(data);

    // Sync via Backend API
    final payload = <String, dynamic>{
      'headline': data.professionalType,
      'equipmentList': data.tools,
    };
    if (data.minRate != null) {
      payload['dayRate'] = data.minRate;
    }
    await _remoteDataSource.updateProfessionalProfile(payload);
  }

  @override
  Future<PodcastDetailsData> getPodcastDetails() async {
    await _syncWithBackend();
    return _podcastDetails;
  }

  @override
  Future<void> updatePodcastDetails(PodcastDetailsData data) async {
    _podcastDetails = data;
    await _profileLocalDataSource.savePodcastDetails(data);

    // Sync via Backend API
    await _remoteDataSource.updatePodcasterProfile({
      'podcastName': data.showName,
      'description': data.description,
      'rssFeedUrl':
          data.platformLinks.isNotEmpty ? data.platformLinks.first : null,
    });
  }

  @override
  Future<CompanyDetailsData> getCompanyDetails() async {
    await _syncWithBackend();
    return _companyDetails;
  }

  @override
  Future<void> updateCompanyDetails(CompanyDetailsData data) async {
    _companyDetails = data;
    await _profileLocalDataSource.saveCompanyDetails(data);

    // Sync via Backend API
    await _remoteDataSource.updateBrandProfile({
      'companyName': data.companyName,
      'industry': data.businessCategory,
      'companySize': data.teamSize,
      'websiteUrl': data.websiteUrl,
      'bio': data.description,
    });
  }

  @override
  Future<List<SocialPlatformAccount>> getSocialAccounts() async {
    await _syncWithBackend();
    return _socialAccounts;
  }

  @override
  Future<SocialPlatformAccount> connectSocialAccount(
      String platform, String handle) async {
    final updated = SocialPlatformAccount(
      platform: platform,
      handle: handle,
      status: SocialPlatformStatus.connected,
      followersCount: null,
      postsCount: null,
      lastSyncedText: 'Just now',
      profileUrl: '$platform.com/$handle',
    );

    _socialAccounts = _socialAccounts.map((a) {
      if (a.platform.toLowerCase() == platform.toLowerCase()) {
        return updated;
      }
      return a;
    }).toList();

    // Persist locally
    await _profileLocalDataSource.saveSocialAccounts(_socialAccounts);

    // Persist to backend
    await _remoteDataSource.updateCreatorProfile({
      'socialLinks': _socialAccounts
          .where((a) => a.handle != null && a.profileUrl != null && a.profileUrl!.trim().isNotEmpty)
          .map((a) {
            final cleanUrl = a.profileUrl!.trim().startsWith('http')
                ? a.profileUrl!.trim()
                : 'https://${a.profileUrl!.trim()}';
            return {'platform': a.platform, 'url': cleanUrl};
          })
          .toList(),
    });

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

    // Persist locally
    await _profileLocalDataSource.saveSocialAccounts(_socialAccounts);

    await _remoteDataSource.updateCreatorProfile({
      'socialLinks': _socialAccounts
          .where((a) => a.handle != null && a.profileUrl != null && a.profileUrl!.trim().isNotEmpty)
          .map((a) {
            final cleanUrl = a.profileUrl!.trim().startsWith('http')
                ? a.profileUrl!.trim()
                : 'https://${a.profileUrl!.trim()}';
            return {'platform': a.platform, 'url': cleanUrl};
          })
          .toList(),
    });
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
    await _remoteDataSource.submitCreatorVerification(platform, handle, code);
    _verificationData = _verificationData.copyWith(
      state: VerificationState.underReview,
      submittedAccount: '$platform @$handle',
      oneTimeCode: code,
      submittedDate: _formatCurrentTimestamp(),
    );
    await _profileLocalDataSource.saveVerificationData(_verificationData);
  }

  @override
  Future<void> submitBrandVerification({
    required String businessName,
    required String regNumber,
    required String person,
    required List<String> documents,
  }) async {
    await _remoteDataSource.submitBrandVerification(
      businessName: businessName,
      regNumber: regNumber,
      person: person,
      documents: documents,
    );
    _verificationData = _verificationData.copyWith(
      state: VerificationState.underReview,
      submittedAccount: businessName,
      brandDocumentNames: documents,
      submittedDate: _formatCurrentTimestamp(),
    );
    await _profileLocalDataSource.saveVerificationData(_verificationData);
  }

  @override
  Future<void> addSecondaryRole(UserRole role) async {
    await _remoteDataSource.syncSecondaryRole(role.apiValue);
    await _localDataSource.saveSelectedRole(role.apiValue);
  }
}
