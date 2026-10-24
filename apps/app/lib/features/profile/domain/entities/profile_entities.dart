enum SocialPlatformStatus {
  notConnected,
  connected,
  expired,
  verified;

  String get label {
    switch (this) {
      case SocialPlatformStatus.notConnected:
        return 'Not connected';
      case SocialPlatformStatus.connected:
        return 'Connected · not verified';
      case SocialPlatformStatus.expired:
        return 'Connection expired';
      case SocialPlatformStatus.verified:
        return 'Verified';
    }
  }

  String get actionLabel {
    switch (this) {
      case SocialPlatformStatus.notConnected:
        return 'Connect';
      case SocialPlatformStatus.connected:
        return 'Verify';
      case SocialPlatformStatus.expired:
        return 'Reconnect';
      case SocialPlatformStatus.verified:
        return 'View';
    }
  }
}

enum VerificationState {
  notStarted,
  underReview,
  approved,
  changesNeeded;
}

enum AvailabilityStatus {
  availableNow('Available now'),
  withinAWeek('Within a week'),
  busy('Busy');

  final String label;
  const AvailabilityStatus(this.label);
}

enum RateUnit {
  perProject('Per project'),
  perPost('Per post'),
  perHour('Per hour');

  final String label;
  const RateUnit(this.label);
}

enum ReleaseFrequency {
  weekly('Weekly'),
  fortnightly('Fortnightly'),
  monthly('Monthly');

  final String label;
  const ReleaseFrequency(this.label);
}

class BasicInfoData {
  final String? photoUrl;
  final String displayName;
  final String bio;
  final String city;
  final String hubName;
  final List<String> languages;
  final DateTime? cityLastChangedAt;

  const BasicInfoData({
    this.photoUrl,
    this.displayName = '',
    this.bio = '',
    this.city = '',
    this.hubName = '',
    this.languages = const [],
    this.cityLastChangedAt,
  });

  BasicInfoData copyWith({
    String? photoUrl,
    String? displayName,
    String? bio,
    String? city,
    String? hubName,
    List<String>? languages,
    DateTime? cityLastChangedAt,
  }) {
    return BasicInfoData(
      photoUrl: photoUrl ?? this.photoUrl,
      displayName: displayName ?? this.displayName,
      bio: bio ?? this.bio,
      city: city ?? this.city,
      hubName: hubName ?? this.hubName,
      languages: languages ?? this.languages,
      cityLastChangedAt: cityLastChangedAt ?? this.cityLastChangedAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'photoUrl': photoUrl,
        'displayName': displayName,
        'bio': bio,
        'city': city,
        'hubName': hubName,
        'languages': languages,
        'cityLastChangedAt': cityLastChangedAt?.toIso8601String(),
      };

  factory BasicInfoData.fromJson(Map<String, dynamic> json) => BasicInfoData(
        photoUrl: json['photoUrl'] as String?,
        displayName: json['displayName'] as String? ?? '',
        bio: json['bio'] as String? ?? '',
        city: json['city'] as String? ?? '',
        hubName: json['hubName'] as String? ?? '',
        languages: (json['languages'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        cityLastChangedAt: json['cityLastChangedAt'] != null
            ? DateTime.tryParse(json['cityLastChangedAt'] as String)
            : null,
      );
}

class CreatorDetailsData {
  final List<String> contentTypes;
  final int? minRate;
  final int? maxRate;
  final RateUnit rateUnit;
  final bool showRateOnProfile;
  final AvailabilityStatus availability;

  const CreatorDetailsData({
    this.contentTypes = const [],
    this.minRate,
    this.maxRate,
    this.rateUnit = RateUnit.perProject,
    this.showRateOnProfile = true,
    this.availability = AvailabilityStatus.availableNow,
  });

  CreatorDetailsData copyWith({
    List<String>? contentTypes,
    int? minRate,
    int? maxRate,
    RateUnit? rateUnit,
    bool? showRateOnProfile,
    AvailabilityStatus? availability,
  }) {
    return CreatorDetailsData(
      contentTypes: contentTypes ?? this.contentTypes,
      minRate: minRate ?? this.minRate,
      maxRate: maxRate ?? this.maxRate,
      rateUnit: rateUnit ?? this.rateUnit,
      showRateOnProfile: showRateOnProfile ?? this.showRateOnProfile,
      availability: availability ?? this.availability,
    );
  }

  Map<String, dynamic> toJson() => {
        'contentTypes': contentTypes,
        'minRate': minRate,
        'maxRate': maxRate,
        'rateUnit': rateUnit.name,
        'showRateOnProfile': showRateOnProfile,
        'availability': availability.name,
      };

  factory CreatorDetailsData.fromJson(Map<String, dynamic> json) =>
      CreatorDetailsData(
        contentTypes: (json['contentTypes'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        minRate: (json['minRate'] as num?)?.toInt(),
        maxRate: (json['maxRate'] as num?)?.toInt(),
        rateUnit: RateUnit.values.firstWhere(
          (e) => e.name == json['rateUnit'],
          orElse: () => RateUnit.perProject,
        ),
        showRateOnProfile: json['showRateOnProfile'] as bool? ?? true,
        availability: AvailabilityStatus.values.firstWhere(
          (e) => e.name == json['availability'],
          orElse: () => AvailabilityStatus.availableNow,
        ),
      );
}

class ProfessionalDetailsData {
  final String professionalType;
  final String experience;
  final List<String> tools;
  final int? minRate;
  final int? maxRate;
  final RateUnit rateUnit;
  final bool hasPortfolioSample;

  const ProfessionalDetailsData({
    this.professionalType = 'Video editor',
    this.experience = '3–5 years',
    this.tools = const [],
    this.minRate,
    this.maxRate,
    this.rateUnit = RateUnit.perProject,
    this.hasPortfolioSample = false,
  });

  ProfessionalDetailsData copyWith({
    String? professionalType,
    String? experience,
    List<String>? tools,
    int? minRate,
    int? maxRate,
    RateUnit? rateUnit,
    bool? hasPortfolioSample,
  }) {
    return ProfessionalDetailsData(
      professionalType: professionalType ?? this.professionalType,
      experience: experience ?? this.experience,
      tools: tools ?? this.tools,
      minRate: minRate ?? this.minRate,
      maxRate: maxRate ?? this.maxRate,
      rateUnit: rateUnit ?? this.rateUnit,
      hasPortfolioSample: hasPortfolioSample ?? this.hasPortfolioSample,
    );
  }

  Map<String, dynamic> toJson() => {
        'professionalType': professionalType,
        'experience': experience,
        'tools': tools,
        'minRate': minRate,
        'maxRate': maxRate,
        'rateUnit': rateUnit.name,
        'hasPortfolioSample': hasPortfolioSample,
      };

  factory ProfessionalDetailsData.fromJson(Map<String, dynamic> json) =>
      ProfessionalDetailsData(
        professionalType:
            json['professionalType'] as String? ?? 'Video editor',
        experience: json['experience'] as String? ?? '3–5 years',
        tools: (json['tools'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        minRate: (json['minRate'] as num?)?.toInt(),
        maxRate: (json['maxRate'] as num?)?.toInt(),
        rateUnit: RateUnit.values.firstWhere(
          (e) => e.name == json['rateUnit'],
          orElse: () => RateUnit.perProject,
        ),
        hasPortfolioSample: json['hasPortfolioSample'] as bool? ?? false,
      );
}

class PodcastDetailsData {
  final String showName;
  final String category;
  final String description;
  final List<String> platformLinks;
  final ReleaseFrequency frequency;

  const PodcastDetailsData({
    this.showName = '',
    this.category = 'Business & Creator economy',
    this.description = '',
    this.platformLinks = const [],
    this.frequency = ReleaseFrequency.weekly,
  });

  PodcastDetailsData copyWith({
    String? showName,
    String? category,
    String? description,
    List<String>? platformLinks,
    ReleaseFrequency? frequency,
  }) {
    return PodcastDetailsData(
      showName: showName ?? this.showName,
      category: category ?? this.category,
      description: description ?? this.description,
      platformLinks: platformLinks ?? this.platformLinks,
      frequency: frequency ?? this.frequency,
    );
  }

  Map<String, dynamic> toJson() => {
        'showName': showName,
        'category': category,
        'description': description,
        'platformLinks': platformLinks,
        'frequency': frequency.name,
      };

  factory PodcastDetailsData.fromJson(Map<String, dynamic> json) =>
      PodcastDetailsData(
        showName: json['showName'] as String? ?? '',
        category:
            json['category'] as String? ?? 'Business & Creator economy',
        description: json['description'] as String? ?? '',
        platformLinks: (json['platformLinks'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        frequency: ReleaseFrequency.values.firstWhere(
          (e) => e.name == json['frequency'],
          orElse: () => ReleaseFrequency.weekly,
        ),
      );
}

class CompanyDetailsData {
  final String companyName;
  final String description;
  final String businessCategory;
  final String city;
  final String teamSize;
  final String websiteUrl;
  final String? gstNumber;

  const CompanyDetailsData({
    this.companyName = '',
    this.description = '',
    this.businessCategory = '',
    this.city = '',
    this.teamSize = '',
    this.websiteUrl = '',
    this.gstNumber,
  });

  CompanyDetailsData copyWith({
    String? companyName,
    String? description,
    String? businessCategory,
    String? city,
    String? teamSize,
    String? websiteUrl,
    String? gstNumber,
  }) {
    return CompanyDetailsData(
      companyName: companyName ?? this.companyName,
      description: description ?? this.description,
      businessCategory: businessCategory ?? this.businessCategory,
      city: city ?? this.city,
      teamSize: teamSize ?? this.teamSize,
      websiteUrl: websiteUrl ?? this.websiteUrl,
      gstNumber: gstNumber ?? this.gstNumber,
    );
  }

  Map<String, dynamic> toJson() => {
        'companyName': companyName,
        'description': description,
        'businessCategory': businessCategory,
        'city': city,
        'teamSize': teamSize,
        'websiteUrl': websiteUrl,
        'gstNumber': gstNumber,
      };

  factory CompanyDetailsData.fromJson(Map<String, dynamic> json) =>
      CompanyDetailsData(
        companyName: json['companyName'] as String? ?? '',
        description: json['description'] as String? ?? '',
        businessCategory: json['businessCategory'] as String? ?? '',
        city: json['city'] as String? ?? '',
        teamSize: json['teamSize'] as String? ?? '',
        websiteUrl: json['websiteUrl'] as String? ?? '',
        gstNumber: json['gstNumber'] as String?,
      );
}

class SocialPlatformAccount {
  final String platform;
  final String? handle;
  final SocialPlatformStatus status;
  final String? followersCount;
  final int? postsCount;
  final String? lastSyncedText;
  final String? profileUrl;

  const SocialPlatformAccount({
    required this.platform,
    this.handle,
    this.status = SocialPlatformStatus.notConnected,
    this.followersCount,
    this.postsCount,
    this.lastSyncedText,
    this.profileUrl,
  });

  SocialPlatformAccount copyWith({
    String? platform,
    String? handle,
    SocialPlatformStatus? status,
    String? followersCount,
    int? postsCount,
    String? lastSyncedText,
    String? profileUrl,
  }) {
    return SocialPlatformAccount(
      platform: platform ?? this.platform,
      handle: handle ?? this.handle,
      status: status ?? this.status,
      followersCount: followersCount ?? this.followersCount,
      postsCount: postsCount ?? this.postsCount,
      lastSyncedText: lastSyncedText ?? this.lastSyncedText,
      profileUrl: profileUrl ?? this.profileUrl,
    );
  }

  Map<String, dynamic> toJson() => {
        'platform': platform,
        'handle': handle,
        'status': status.name,
        'followersCount': followersCount,
        'postsCount': postsCount,
        'lastSyncedText': lastSyncedText,
        'profileUrl': profileUrl,
      };

  factory SocialPlatformAccount.fromJson(Map<String, dynamic> json) =>
      SocialPlatformAccount(
        platform: json['platform'] as String? ?? 'Instagram',
        handle: json['handle'] as String?,
        status: SocialPlatformStatus.values.firstWhere(
          (e) => e.name == json['status'],
          orElse: () => SocialPlatformStatus.notConnected,
        ),
        followersCount: json['followersCount'] as String?,
        postsCount: (json['postsCount'] as num?)?.toInt(),
        lastSyncedText: json['lastSyncedText'] as String?,
        profileUrl: json['profileUrl'] as String?,
      );
}

class VerificationData {
  final VerificationState state;
  final String? submittedAccount;
  final String oneTimeCode;
  final String? submittedDate;
  final String? feedbackReason;
  final String? adminNote;
  final int attemptsRemaining;
  final List<String> brandDocumentNames;

  const VerificationData({
    this.state = VerificationState.notStarted,
    this.submittedAccount,
    this.oneTimeCode = '',
    this.submittedDate,
    this.feedbackReason,
    this.adminNote,
    this.attemptsRemaining = 3,
    this.brandDocumentNames = const [],
  });

  VerificationData copyWith({
    VerificationState? state,
    String? submittedAccount,
    String? oneTimeCode,
    String? submittedDate,
    String? feedbackReason,
    String? adminNote,
    int? attemptsRemaining,
    List<String>? brandDocumentNames,
  }) {
    return VerificationData(
      state: state ?? this.state,
      submittedAccount: submittedAccount ?? this.submittedAccount,
      oneTimeCode: oneTimeCode ?? this.oneTimeCode,
      submittedDate: submittedDate ?? this.submittedDate,
      feedbackReason: feedbackReason ?? this.feedbackReason,
      adminNote: adminNote ?? this.adminNote,
      attemptsRemaining: attemptsRemaining ?? this.attemptsRemaining,
      brandDocumentNames: brandDocumentNames ?? this.brandDocumentNames,
    );
  }

  Map<String, dynamic> toJson() => {
        'state': state.name,
        'submittedAccount': submittedAccount,
        'oneTimeCode': oneTimeCode,
        'submittedDate': submittedDate,
        'feedbackReason': feedbackReason,
        'adminNote': adminNote,
        'attemptsRemaining': attemptsRemaining,
        'brandDocumentNames': brandDocumentNames,
      };

  factory VerificationData.fromJson(Map<String, dynamic> json) =>
      VerificationData(
        state: VerificationState.values.firstWhere(
          (e) => e.name == json['state'],
          orElse: () => VerificationState.notStarted,
        ),
        submittedAccount: json['submittedAccount'] as String?,
        oneTimeCode: json['oneTimeCode'] as String? ?? '',
        submittedDate: json['submittedDate'] as String?,
        feedbackReason: json['feedbackReason'] as String?,
        adminNote: json['adminNote'] as String?,
        attemptsRemaining: (json['attemptsRemaining'] as num?)?.toInt() ?? 3,
        brandDocumentNames: (json['brandDocumentNames'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
      );
}

class ProfileSectionItem {
  final String key;
  final String title;
  final String subtitle;
  final bool isRequired;
  final bool isDone;
  final bool isLocked;
  final String? lockReason;

  const ProfileSectionItem({
    required this.key,
    required this.title,
    required this.subtitle,
    required this.isRequired,
    required this.isDone,
    this.isLocked = false,
    this.lockReason,
  });
}

class ProfileOverviewData {
  final int completionPercentage;
  final bool isLevel1;
  final bool isLevel2;
  final String nextActionTitle;
  final String nextActionKey;
  final List<ProfileSectionItem> requiredSections;
  final List<ProfileSectionItem> verificationSections;

  const ProfileOverviewData({
    required this.completionPercentage,
    required this.isLevel1,
    required this.isLevel2,
    required this.nextActionTitle,
    required this.nextActionKey,
    required this.requiredSections,
    required this.verificationSections,
  });
}
