import 'package:flutter/foundation.dart';

/// Role enum for Discovery & Dashboard surfaces
enum DiscoveryRole {
  creator,
  brand,
  professional,
  podcaster,
}

extension DiscoveryRoleExtension on DiscoveryRole {
  String get displayName {
    switch (this) {
      case DiscoveryRole.creator:
        return 'Creator';
      case DiscoveryRole.brand:
        return 'Brand';
      case DiscoveryRole.professional:
        return 'Production Pro';
      case DiscoveryRole.podcaster:
        return 'Podcaster';
    }
  }

  String get keyName {
    switch (this) {
      case DiscoveryRole.creator:
        return 'CREATOR';
      case DiscoveryRole.brand:
        return 'BRAND';
      case DiscoveryRole.professional:
        return 'PROFESSIONAL';
      case DiscoveryRole.podcaster:
        return 'PODCASTER';
    }
  }

  static DiscoveryRole fromString(String? role) {
    if (role == null) return DiscoveryRole.creator;
    switch (role.toUpperCase()) {
      case 'BRAND':
        return DiscoveryRole.brand;
      case 'PROFESSIONAL':
        return DiscoveryRole.professional;
      case 'PODCASTER':
        return DiscoveryRole.podcaster;
      default:
        return DiscoveryRole.creator;
    }
  }
}

/// Match reason tag under SOW §13 rule-based matching
@immutable
class MatchReason {
  final String label;
  final String icon;

  const MatchReason({
    required this.label,
    this.icon = '⭐',
  });

  factory MatchReason.fromJson(Map<String, dynamic> json) {
    return MatchReason(
      label: json['label'] as String? ?? 'High match',
      icon: json['icon'] as String? ?? '⭐',
    );
  }

  Map<String, dynamic> toJson() => {
    'label': label,
    'icon': icon,
  };
}

/// Profile Card entity used across Discovery, Carousel, and Results
@immutable
class ProfileCardModel {
  final String id;
  final String name;
  final String handle;
  final String role;
  final String avatarUrl;
  final bool isVerified;
  final bool isOnline;
  final String niche;
  final double rating;
  final int reviewCount;
  final int startingRate;
  final String currency;
  final String city;
  final List<String> deliverableTags;
  final List<MatchReason> matchReasons;
  final int completionScore;
  final String bio;
  final List<String> portfolioThumbnails;

  const ProfileCardModel({
    required this.id,
    required this.name,
    required this.handle,
    required this.role,
    required this.avatarUrl,
    this.isVerified = true,
    this.isOnline = false,
    required this.niche,
    this.rating = 4.9,
    this.reviewCount = 18,
    this.startingRate = 12000,
    this.currency = '₹',
    this.city = 'Mumbai',
    this.deliverableTags = const [],
    this.matchReasons = const [],
    this.completionScore = 100,
    this.bio = '',
    this.portfolioThumbnails = const [],
  });

  factory ProfileCardModel.fromJson(Map<String, dynamic> json) {
    List<MatchReason> parsedReasons = [];
    if (json['matchReasons'] is List) {
      parsedReasons = (json['matchReasons'] as List)
          .map((e) => MatchReason.fromJson(e as Map<String, dynamic>))
          .toList();
    } else if (json['matchReason'] is String && (json['matchReason'] as String).isNotEmpty) {
      parsedReasons = [MatchReason(label: json['matchReason'] as String)];
    }

    final rawTags = json['deliverableTags'] ?? json['skills'] ?? [];
    final tagsList = (rawTags is List ? rawTags : []).map((e) => e.toString()).toList();
    final thumbsRaw = json['portfolioThumbnails'] as List<dynamic>? ?? [];

    return ProfileCardModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? json['displayName'] as String? ?? 'Collaborator',
      handle: json['handle'] as String? ?? '@user',
      role: (json['role'] as String?)?.toUpperCase() ?? 'CREATOR',
      avatarUrl: json['avatarUrl'] as String? ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      isVerified: (json['isVerified'] as bool?) ?? (json['verified'] as bool?) ?? false,
      isOnline: json['isOnline'] as bool? ?? false,
      niche: json['niche'] as String? ?? json['category'] as String? ?? 'Fashion & Lifestyle',
      rating: (json['rating'] as num?)?.toDouble() ?? 4.9,
      reviewCount: json['reviewCount'] as int? ?? json['reviewsCount'] as int? ?? 12,
      startingRate: json['startingRate'] as int? ?? json['rateMin'] as int? ?? 15000,
      currency: json['currency'] as String? ?? '₹',
      city: json['city'] as String? ?? json['locationCity'] as String? ?? 'Mumbai',
      deliverableTags: tagsList,
      matchReasons: parsedReasons,
      completionScore: json['completionScore'] as int? ?? 100,
      bio: json['bio'] as String? ?? json['bioSnippet'] as String? ?? '',
      portfolioThumbnails: thumbsRaw.map((e) => e.toString()).toList(),
    );
  }
}

/// Brief Opportunity for Creator D01
@immutable
class OpportunityBrief {
  final String id;
  final String title;
  final String brandName;
  final String brandLogo;
  final int budget;
  final String currency;
  final String location;
  final String deadline;
  final String deliverableType;
  final int applicantsCount;

  const OpportunityBrief({
    required this.id,
    required this.title,
    required this.brandName,
    required this.brandLogo,
    required this.budget,
    this.currency = '₹',
    required this.location,
    required this.deadline,
    required this.deliverableType,
    this.applicantsCount = 14,
  });

  factory OpportunityBrief.fromJson(Map<String, dynamic> json) {
    int parsedBudget = 25000;
    if (json['budget'] is int) {
      parsedBudget = json['budget'] as int;
    } else if (json['budget'] is num) {
      parsedBudget = (json['budget'] as num).toInt();
    } else if (json['budget'] is String) {
      final str = json['budget'] as String;
      final digitsOnly = str.replaceAll(RegExp(r'\D'), '');
      parsedBudget = int.tryParse(digitsOnly) ?? 25000;
    }

    String parsedDeadline = 'In 3 days';
    if (json['deadline'] is String) {
      parsedDeadline = json['deadline'] as String;
    } else if (json['daysLeft'] != null) {
      parsedDeadline = '${json['daysLeft']} days left';
    }

    return OpportunityBrief(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      brandName: json['brandName'] as String? ?? '',
      brandLogo: json['brandLogo'] as String? ?? json['brandAvatar'] as String? ?? '',
      budget: parsedBudget,
      currency: json['currency'] as String? ?? '₹',
      location: json['location'] as String? ?? 'Mumbai (Remote)',
      deadline: parsedDeadline,
      deliverableType: json['deliverableType'] as String? ?? json['deliverable'] as String? ?? 'Reel + Story',
      applicantsCount: json['applicantsCount'] as int? ?? json['appliedCount'] as int? ?? 14,
    );
  }
}

/// Brand Campaign brief progress for Brand D02
@immutable
class BrandBriefProgress {
  final String id;
  final String title;
  final int applicantsCount;
  final int targetApplicants;
  final String deadline;
  final String status;

  const BrandBriefProgress({
    required this.id,
    required this.title,
    required this.applicantsCount,
    required this.targetApplicants,
    required this.deadline,
    this.status = 'ACTIVE',
  });

  double get progressRatio => targetApplicants > 0 ? (applicantsCount / targetApplicants).clamp(0.0, 1.0) : 0.0;

  factory BrandBriefProgress.fromJson(Map<String, dynamic> json) {
    String parsedDeadline = '4 days left';
    if (json['deadline'] is String) {
      parsedDeadline = json['deadline'] as String;
    } else if (json['daysLeft'] != null) {
      parsedDeadline = '${json['daysLeft']} days left';
    }

    return BrandBriefProgress(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      applicantsCount: json['applicantsCount'] as int? ?? json['appliedCount'] as int? ?? 0,
      targetApplicants: json['targetApplicants'] as int? ?? json['maxApplicants'] as int? ?? 50,
      deadline: parsedDeadline,
      status: json['status'] as String? ?? 'ACTIVE',
    );
  }
}

/// Filter bottom sheet state (D07)
@immutable
class FilterState {
  final DiscoveryRole role;
  final List<String> categories;
  final String? city;
  final bool includeNearby;
  final double minFollowers;
  final double maxFollowers;
  final double minBudget;
  final double maxBudget;
  final bool verifiedOnly;
  final bool availableImmediately;
  final bool hasPortfolio;
  final double minRating;
  final List<String> languages;
  final String sortOption;

  const FilterState({
    this.role = DiscoveryRole.creator,
    this.categories = const [],
    this.city,
    this.includeNearby = true,
    this.minFollowers = 10000,
    this.maxFollowers = 500000,
    this.minBudget = 5000,
    this.maxBudget = 100000,
    this.verifiedOnly = false,
    this.availableImmediately = false,
    this.hasPortfolio = false,
    this.minRating = 4.0,
    this.languages = const ['English', 'Hindi'],
    this.sortOption = 'relevance',
  });

  int get activeFilterCount {
    int count = 0;
    if (categories.isNotEmpty) count += categories.length;
    if (city != null && city!.isNotEmpty) count++;
    if (verifiedOnly) count++;
    if (availableImmediately) count++;
    if (hasPortfolio) count++;
    if (minRating > 4.0) count++;
    if (minBudget > 5000 || maxBudget < 100000) count++;
    if (minFollowers > 10000 || maxFollowers < 500000) count++;
    return count;
  }

  FilterState copyWith({
    DiscoveryRole? role,
    List<String>? categories,
    String? city,
    bool? includeNearby,
    double? minFollowers,
    double? maxFollowers,
    double? minBudget,
    double? maxBudget,
    bool? verifiedOnly,
    bool? availableImmediately,
    bool? hasPortfolio,
    double? minRating,
    List<String>? languages,
    String? sortOption,
  }) {
    return FilterState(
      role: role ?? this.role,
      categories: categories ?? this.categories,
      city: city ?? this.city,
      includeNearby: includeNearby ?? this.includeNearby,
      minFollowers: minFollowers ?? this.minFollowers,
      maxFollowers: maxFollowers ?? this.maxFollowers,
      minBudget: minBudget ?? this.minBudget,
      maxBudget: maxBudget ?? this.maxBudget,
      verifiedOnly: verifiedOnly ?? this.verifiedOnly,
      availableImmediately: availableImmediately ?? this.availableImmediately,
      hasPortfolio: hasPortfolio ?? this.hasPortfolio,
      minRating: minRating ?? this.minRating,
      languages: languages ?? this.languages,
      sortOption: sortOption ?? this.sortOption,
    );
  }
}

/// Autocomplete result suggestion (D06 / D14)
@immutable
class AutocompleteSuggestion {
  final String text;
  final String category; // 'Niche', 'Skill', 'Location', 'Profile'
  final String? icon;

  const AutocompleteSuggestion({
    required this.text,
    required this.category,
    this.icon,
  });

  factory AutocompleteSuggestion.fromJson(Map<String, dynamic> json) {
    return AutocompleteSuggestion(
      text: json['text'] as String? ?? '',
      category: json['category'] as String? ?? 'General',
      icon: json['icon'] as String?,
    );
  }
}

/// Notification Item model (D04)
@immutable
class NotificationItemModel {
  final String id;
  final String title;
  final String body;
  final String timeAgo;
  final String type; // 'APPLICATION', 'SYSTEM', 'CONNECTION', 'REVIEW'
  final bool isUnread;
  final String? actionUrl;

  const NotificationItemModel({
    required this.id,
    required this.title,
    required this.body,
    required this.timeAgo,
    this.type = 'SYSTEM',
    this.isUnread = false,
    this.actionUrl,
  });

  factory NotificationItemModel.fromJson(Map<String, dynamic> json) {
    String computedTime = json['timeAgo'] as String? ?? 'Just now';
    if (json['timeAgo'] == null && json['createdAt'] != null) {
      try {
        final dt = DateTime.parse(json['createdAt'] as String);
        final diff = DateTime.now().difference(dt);
        if (diff.inDays > 0) {
          computedTime = '${diff.inDays}d ago';
        } else if (diff.inHours > 0) {
          computedTime = '${diff.inHours}h ago';
        } else if (diff.inMinutes > 0) {
          computedTime = '${diff.inMinutes}m ago';
        } else {
          computedTime = 'Just now';
        }
      } catch (_) {}
    }

    final rawType = (json['type'] as String? ?? 'SYSTEM').toUpperCase();
    final normalizedType = rawType.contains('APPLICATION')
        ? 'APPLICATION'
        : (rawType.contains('CONNECTION')
            ? 'CONNECTION'
            : (rawType.contains('REVIEW') ? 'REVIEW' : 'SYSTEM'));

    return NotificationItemModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Notification',
      body: json['body'] as String? ?? json['message'] as String? ?? '',
      timeAgo: computedTime,
      type: normalizedType,
      isUnread: json['isUnread'] as bool? ?? (json['readAt'] == null),
      actionUrl: json['actionUrl'] as String? ??
          (json['data'] is Map ? json['data']['actionUrl'] as String? : null),
    );
  }
}

/// Public Profile Entity (D09 / D10)
@immutable
class PublicProfileModel {
  final String id;
  final String userId;
  final String name;
  final String handle;
  final String role;
  final String avatarUrl;
  final String coverUrl;
  final bool isVerified;
  final String city;
  final String state;
  final String bio;
  final String followersCount;
  final double rating;
  final int reviewCount;
  final int collabsCompleted;
  final String ratePerDeliverable;
  final List<String> deliverableTags;
  final List<Map<String, dynamic>> socialLinks;
  final List<Map<String, dynamic>> portfolioItems;
  final Map<String, dynamic>? latestReview;
  final List<OpportunityBrief> activeBriefs;

  const PublicProfileModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.handle,
    required this.role,
    required this.avatarUrl,
    required this.coverUrl,
    this.isVerified = true,
    required this.city,
    required this.state,
    required this.bio,
    this.followersCount = '48.5K',
    this.rating = 4.9,
    this.reviewCount = 38,
    this.collabsCompleted = 26,
    this.ratePerDeliverable = '₹18,000',
    this.deliverableTags = const [],
    this.socialLinks = const [],
    this.portfolioItems = const [],
    this.latestReview,
    this.activeBriefs = const [],
  });

  factory PublicProfileModel.fromJson(Map<String, dynamic> json) {
    final rawTags = json['deliverableTags'] ?? json['skills'] ?? [];
    final tagsList = (rawTags is List ? rawTags : []).map((e) => e.toString()).toList();
    final socialRaw = (json['socialLinks'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final portfolioRaw = (json['portfolioItems'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final briefsRaw = json['activeBriefs'] as List<dynamic>? ?? [];

    String parsedFollowers = '52.4K';
    if (json['followersFormatted'] is String) {
      parsedFollowers = json['followersFormatted'] as String;
    } else if (json['followersCount'] is int) {
      final intVal = json['followersCount'] as int;
      parsedFollowers = intVal >= 1000 ? '${(intVal / 1000).toStringAsFixed(1)}K' : intVal.toString();
    } else if (json['followersCount'] is String) {
      parsedFollowers = json['followersCount'] as String;
    }

    return PublicProfileModel(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? json['id'] as String? ?? '',
      name: json['name'] as String? ?? json['displayName'] as String? ?? 'Creator',
      handle: json['handle'] as String? ?? '@creator',
      role: (json['role'] as String?)?.toUpperCase() ?? 'CREATOR',
      avatarUrl: json['avatarUrl'] as String? ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      coverUrl: json['coverUrl'] as String? ?? 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200',
      isVerified: (json['isVerified'] as bool?) ?? (json['verified'] as bool?) ?? false,
      city: json['city'] as String? ?? json['locationCity'] as String? ?? 'Mumbai',
      state: json['state'] as String? ?? 'MH',
      bio: json['bio'] as String? ?? '',
      followersCount: parsedFollowers,
      rating: (json['rating'] as num?)?.toDouble() ?? 4.9,
      reviewCount: json['reviewCount'] as int? ?? json['reviewsCount'] as int? ?? 32,
      collabsCompleted: json['collabsCompleted'] as int? ?? 24,
      ratePerDeliverable: json['ratePerDeliverable'] as String? ?? '₹18,000',
      deliverableTags: tagsList,
      socialLinks: socialRaw,
      portfolioItems: portfolioRaw,
      latestReview: json['latestReview'] as Map<String, dynamic>?,
      activeBriefs: briefsRaw.map((e) => OpportunityBrief.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
