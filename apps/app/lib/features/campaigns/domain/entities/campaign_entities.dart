import 'package:flutter/foundation.dart';

enum CampaignStatus {
  draft('DRAFT', 'Draft'),
  published('PUBLISHED', 'Active'),
  inProgress('IN_PROGRESS', 'In Progress'),
  completed('COMPLETED', 'Completed'),
  closed('CLOSED', 'Closed');

  final String key;
  final String label;
  const CampaignStatus(this.key, this.label);

  static CampaignStatus fromString(String? val) {
    if (val == null) return CampaignStatus.published;
    final upper = val.toUpperCase();
    for (final status in CampaignStatus.values) {
      if (status.key == upper || status.name.toUpperCase() == upper) {
        return status;
      }
    }
    return CampaignStatus.published;
  }
}

enum ApplicationStatus {
  submitted('SUBMITTED', 'Applied'),
  underReview('UNDER_REVIEW', 'Under Review'),
  shortlisted('SHORTLISTED', 'Shortlisted'),
  accepted('ACCEPTED', 'Hired'),
  rejected('REJECTED', 'Declined'),
  withdrawn('WITHDRAWN', 'Withdrawn');

  final String key;
  final String label;
  const ApplicationStatus(this.key, this.label);

  static ApplicationStatus fromString(String? val) {
    if (val == null) return ApplicationStatus.submitted;
    final upper = val.toUpperCase();
    for (final status in ApplicationStatus.values) {
      if (status.key == upper || status.name.toUpperCase() == upper) {
        return status;
      }
    }
    return ApplicationStatus.submitted;
  }
}

enum BudgetModel {
  fixed('FIXED', 'Fixed Rate'),
  range('RANGE', 'Budget Range'),
  negotiable('HOURLY', 'Competitive / Negotiable');

  final String key;
  final String label;
  const BudgetModel(this.key, this.label);

  static BudgetModel fromString(String? val) {
    if (val == null) return BudgetModel.fixed;
    final upper = val.toUpperCase();
    for (final m in BudgetModel.values) {
      if (m.key == upper || m.name.toUpperCase() == upper) {
        return m;
      }
    }
    return BudgetModel.fixed;
  }
}

/// A campaign or collaboration brief posted by a Brand (E01, E07)
@immutable
class CampaignBrief {
  final String id;
  final String brandId;
  final String brandName;
  final String brandLogo;
  final bool isBrandVerified;
  final String title;
  final String description;
  final String category;
  final CampaignStatus status;
  final BudgetModel budgetType;
  final int budgetMin;
  final int budgetMax;
  final String currency;
  final String location;
  final String deadline;
  final List<String> deliverableTypes;
  final int deliverableCount;
  final int targetApplicants;
  final int applicantsCount;
  final List<String> guidelines;
  final bool isBookmarked;
  final String createdAt;

  const CampaignBrief({
    required this.id,
    required this.brandId,
    required this.brandName,
    required this.brandLogo,
    this.isBrandVerified = true,
    required this.title,
    required this.description,
    required this.category,
    this.status = CampaignStatus.published,
    this.budgetType = BudgetModel.fixed,
    required this.budgetMin,
    required this.budgetMax,
    this.currency = '₹',
    this.location = 'Pan-India (Remote)',
    required this.deadline,
    this.deliverableTypes = const ['Reels', 'UGC Video'],
    this.deliverableCount = 1,
    this.targetApplicants = 30,
    this.applicantsCount = 0,
    this.guidelines = const [
      'Original 4K footage at 60fps',
      'Natural aesthetic lighting',
      'No competitor branding visible',
    ],
    this.isBookmarked = false,
    this.createdAt = 'Just now',
  });

  String get budgetFormatted {
    if (budgetType == BudgetModel.fixed || budgetMin == budgetMax) {
      return '$currency${_formatNumber(budgetMin)}';
    }
    return '$currency${_formatNumber(budgetMin)} – $currency${_formatNumber(budgetMax)}';
  }

  static String _formatNumber(int amount) {
    if (amount >= 100000) {
      return '${(amount / 100000).toStringAsFixed(1)}L';
    }
    if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(0)}K';
    }
    return amount.toString();
  }

  CampaignBrief copyWith({
    String? id,
    String? brandId,
    String? brandName,
    String? brandLogo,
    bool? isBrandVerified,
    String? title,
    String? description,
    String? category,
    CampaignStatus? status,
    BudgetModel? budgetType,
    int? budgetMin,
    int? budgetMax,
    String? currency,
    String? location,
    String? deadline,
    List<String>? deliverableTypes,
    int? deliverableCount,
    int? targetApplicants,
    int? applicantsCount,
    List<String>? guidelines,
    bool? isBookmarked,
    String? createdAt,
  }) {
    return CampaignBrief(
      id: id ?? this.id,
      brandId: brandId ?? this.brandId,
      brandName: brandName ?? this.brandName,
      brandLogo: brandLogo ?? this.brandLogo,
      isBrandVerified: isBrandVerified ?? this.isBrandVerified,
      title: title ?? this.title,
      description: description ?? this.description,
      category: category ?? this.category,
      status: status ?? this.status,
      budgetType: budgetType ?? this.budgetType,
      budgetMin: budgetMin ?? this.budgetMin,
      budgetMax: budgetMax ?? this.budgetMax,
      currency: currency ?? this.currency,
      location: location ?? this.location,
      deadline: deadline ?? this.deadline,
      deliverableTypes: deliverableTypes ?? this.deliverableTypes,
      deliverableCount: deliverableCount ?? this.deliverableCount,
      targetApplicants: targetApplicants ?? this.targetApplicants,
      applicantsCount: applicantsCount ?? this.applicantsCount,
      guidelines: guidelines ?? this.guidelines,
      isBookmarked: isBookmarked ?? this.isBookmarked,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory CampaignBrief.fromJson(Map<String, dynamic> json) {
    int parseAmount(dynamic val, int defaultVal) {
      if (val is int) return val;
      if (val is num) return val.toInt();
      if (val is String) {
        final digits = val.replaceAll(RegExp(r'\D'), '');
        return int.tryParse(digits) ?? defaultVal;
      }
      return defaultVal;
    }

    final rawTypes = json['deliverableTypes'] ?? json['deliverables'] ?? [];
    final typesList = (rawTypes is List ? rawTypes : []).map((e) => e.toString()).toList();
    final rawGuides = json['guidelines'] ?? [];
    final guideList = (rawGuides is List ? rawGuides : []).map((e) => e.toString()).toList();

    return CampaignBrief(
      id: json['id'] as String? ?? '',
      brandId: json['brandId'] as String? ?? json['brand']?['id'] as String? ?? '',
      brandName: json['brandName'] as String? ?? json['brand']?['companyName'] as String? ?? 'Brand',
      brandLogo: json['brandLogo'] as String? ?? json['brand']?['avatarUrl'] as String? ?? '',
      isBrandVerified: json['isBrandVerified'] as bool? ?? true,
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      category: json['category'] as String? ?? json['category']?['name'] as String? ?? 'Lifestyle',
      status: CampaignStatus.fromString(json['status'] as String?),
      budgetType: BudgetModel.fromString(json['budgetType'] as String?),
      budgetMin: parseAmount(json['budgetMin'] ?? json['budget'], 25000),
      budgetMax: parseAmount(json['budgetMax'] ?? json['budget'], 50000),
      currency: json['currency'] as String? ?? '₹',
      location: json['location'] as String? ?? 'Pan-India (Remote)',
      deadline: json['deadline'] as String? ?? json['deadlineText'] as String? ?? 'In 5 days',
      deliverableTypes: typesList.isNotEmpty ? typesList : const ['Reel', 'Story Set'],
      deliverableCount: json['deliverableCount'] as int? ?? 1,
      targetApplicants: json['targetApplicants'] as int? ?? json['maxApplicants'] as int? ?? 30,
      applicantsCount: json['applicantsCount'] as int? ?? json['appliedCount'] as int? ?? 0,
      guidelines: guideList.isNotEmpty ? guideList : const ['Clear audio with no background noise', 'Showcase product in first 3s'],
      isBookmarked: json['isBookmarked'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? 'Recent',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'brandId': brandId,
    'brandName': brandName,
    'brandLogo': brandLogo,
    'isBrandVerified': isBrandVerified,
    'title': title,
    'description': description,
    'category': category,
    'status': status.key,
    'budgetType': budgetType.key,
    'budgetMin': budgetMin,
    'budgetMax': budgetMax,
    'currency': currency,
    'location': location,
    'deadline': deadline,
    'deliverableTypes': deliverableTypes,
    'deliverableCount': deliverableCount,
    'targetApplicants': targetApplicants,
    'applicantsCount': applicantsCount,
    'guidelines': guidelines,
    'isBookmarked': isBookmarked,
    'createdAt': createdAt,
  };
}

/// An Application or Pitch sent by a Creator/Professional for a Brief (E06, E08, E10, E11)
@immutable
class ApplicationItem {
  final String id;
  final String assignmentId;
  final String briefTitle;
  final String brandName;
  final String brandLogo;
  final String applicantId;
  final String applicantName;
  final String applicantHandle;
  final String applicantAvatar;
  final bool isVerified;
  final double rating;
  final int proposedRate;
  final String currency;
  final String coverLetter;
  final int deliverablesEstimatedDays;
  final List<String> portfolioLinks;
  final int matchScore;
  final ApplicationStatus status;
  final String? rejectionReason;
  final String submittedAt;
  final String? reviewedAt;

  const ApplicationItem({
    required this.id,
    required this.assignmentId,
    required this.briefTitle,
    required this.brandName,
    required this.brandLogo,
    required this.applicantId,
    required this.applicantName,
    required this.applicantHandle,
    required this.applicantAvatar,
    this.isVerified = true,
    this.rating = 4.9,
    required this.proposedRate,
    this.currency = '₹',
    required this.coverLetter,
    this.deliverablesEstimatedDays = 4,
    this.portfolioLinks = const [],
    this.matchScore = 92,
    this.status = ApplicationStatus.submitted,
    this.rejectionReason,
    this.submittedAt = 'Just now',
    this.reviewedAt,
  });

  String get proposedRateFormatted => '$currency$proposedRate';

  ApplicationItem copyWith({
    String? id,
    String? assignmentId,
    String? briefTitle,
    String? brandName,
    String? brandLogo,
    String? applicantId,
    String? applicantName,
    String? applicantHandle,
    String? applicantAvatar,
    bool? isVerified,
    double? rating,
    int? proposedRate,
    String? currency,
    String? coverLetter,
    int? deliverablesEstimatedDays,
    List<String>? portfolioLinks,
    int? matchScore,
    ApplicationStatus? status,
    String? rejectionReason,
    String? submittedAt,
    String? reviewedAt,
  }) {
    return ApplicationItem(
      id: id ?? this.id,
      assignmentId: assignmentId ?? this.assignmentId,
      briefTitle: briefTitle ?? this.briefTitle,
      brandName: brandName ?? this.brandName,
      brandLogo: brandLogo ?? this.brandLogo,
      applicantId: applicantId ?? this.applicantId,
      applicantName: applicantName ?? this.applicantName,
      applicantHandle: applicantHandle ?? this.applicantHandle,
      applicantAvatar: applicantAvatar ?? this.applicantAvatar,
      isVerified: isVerified ?? this.isVerified,
      rating: rating ?? this.rating,
      proposedRate: proposedRate ?? this.proposedRate,
      currency: currency ?? this.currency,
      coverLetter: coverLetter ?? this.coverLetter,
      deliverablesEstimatedDays: deliverablesEstimatedDays ?? this.deliverablesEstimatedDays,
      portfolioLinks: portfolioLinks ?? this.portfolioLinks,
      matchScore: matchScore ?? this.matchScore,
      status: status ?? this.status,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      submittedAt: submittedAt ?? this.submittedAt,
      reviewedAt: reviewedAt ?? this.reviewedAt,
    );
  }

  factory ApplicationItem.fromJson(Map<String, dynamic> json) {
    int parseRate(dynamic val) {
      if (val is int) return val;
      if (val is num) return val.toInt();
      if (val is String) {
        final d = val.replaceAll(RegExp(r'\D'), '');
        return int.tryParse(d) ?? 20000;
      }
      return 20000;
    }

    final linksRaw = json['portfolioLinks'] as List<dynamic>? ?? [];

    return ApplicationItem(
      id: json['id'] as String? ?? '',
      assignmentId: json['assignmentId'] as String? ?? '',
      briefTitle: json['briefTitle'] as String? ?? json['assignment']?['title'] as String? ?? 'Campaign Brief',
      brandName: json['brandName'] as String? ?? json['assignment']?['brand']?['companyName'] as String? ?? 'Brand',
      brandLogo: json['brandLogo'] as String? ?? json['assignment']?['brand']?['avatarUrl'] as String? ?? '',
      applicantId: json['applicantId'] as String? ?? json['applicant']?['id'] as String? ?? '',
      applicantName: json['applicantName'] as String? ?? json['applicant']?['firstName'] as String? ?? 'Creator',
      applicantHandle: json['applicantHandle'] as String? ?? '@creator',
      applicantAvatar: json['applicantAvatar'] as String? ?? json['applicant']?['avatarUrl'] as String? ?? '',
      isVerified: json['isVerified'] as bool? ?? true,
      rating: (json['rating'] as num?)?.toDouble() ?? 4.9,
      proposedRate: parseRate(json['proposedRate']),
      currency: json['currency'] as String? ?? '₹',
      coverLetter: json['coverLetter'] as String? ?? '',
      deliverablesEstimatedDays: json['deliverablesEstimatedDays'] as int? ?? 4,
      portfolioLinks: linksRaw.map((e) => e.toString()).toList(),
      matchScore: json['matchScore'] as int? ?? 92,
      status: ApplicationStatus.fromString(json['status'] as String?),
      rejectionReason: json['rejectionReason'] as String?,
      submittedAt: json['submittedAt'] as String? ?? 'Today',
      reviewedAt: json['reviewedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'assignmentId': assignmentId,
    'briefTitle': briefTitle,
    'brandName': brandName,
    'brandLogo': brandLogo,
    'applicantId': applicantId,
    'applicantName': applicantName,
    'applicantHandle': applicantHandle,
    'applicantAvatar': applicantAvatar,
    'isVerified': isVerified,
    'rating': rating,
    'proposedRate': proposedRate,
    'currency': currency,
    'coverLetter': coverLetter,
    'deliverablesEstimatedDays': deliverablesEstimatedDays,
    'portfolioLinks': portfolioLinks,
    'matchScore': matchScore,
    'status': status.key,
    'rejectionReason': rejectionReason,
    'submittedAt': submittedAt,
    'reviewedAt': reviewedAt,
  };
}

/// A specific deliverable specification item (E03)
@immutable
class DeliverableItem {
  final String id;
  final String title;
  final String type;
  final int quantity;
  final String description;

  const DeliverableItem({
    required this.id,
    required this.title,
    required this.type,
    this.quantity = 1,
    this.description = '',
  });

  DeliverableItem copyWith({
    String? id,
    String? title,
    String? type,
    int? quantity,
    String? description,
  }) {
    return DeliverableItem(
      id: id ?? this.id,
      title: title ?? this.title,
      type: type ?? this.type,
      quantity: quantity ?? this.quantity,
      description: description ?? this.description,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'type': type,
    'quantity': quantity,
    'description': description,
  };
}

/// Milestone payment tranche breakdown (E14)
@immutable
class MilestoneItem {
  final String title;
  final int percentage;
  final int amount;
  final String dueDate;

  const MilestoneItem({
    required this.title,
    required this.percentage,
    required this.amount,
    required this.dueDate,
  });

  Map<String, dynamic> toJson() => {
    'title': title,
    'percentage': percentage,
    'amount': amount,
    'dueDate': dueDate,
  };
}
