import 'package:flutter/foundation.dart';

/// Application lifecycle status according to contracts & Master Catalogue §H
enum ApplicationStatus {
  submitted('SUBMITTED', 'Applied'),
  underReview('UNDER_REVIEW', 'Under Review'),
  shortlisted('SHORTLISTED', 'Shortlisted'),
  accepted('ACCEPTED', 'Accepted'),
  rejected('REJECTED', 'Closed'),
  withdrawn('WITHDRAWN', 'Withdrawn');

  final String key;
  final String label;
  const ApplicationStatus(this.key, this.label);

  static ApplicationStatus fromString(String? val) {
    if (val == null) return ApplicationStatus.submitted;
    final upper = val.toUpperCase();
    for (final s in ApplicationStatus.values) {
      if (s.key == upper || s.name.toUpperCase() == upper) return s;
    }
    return ApplicationStatus.submitted;
  }
}

/// A milestone on the application review timeline (H03)
@immutable
class StatusTimelineEvent {
  final String title;
  final String subtitle;
  final String timestamp;
  final bool isDone;
  final bool isActive;

  const StatusTimelineEvent({
    required this.title,
    required this.subtitle,
    required this.timestamp,
    required this.isDone,
    this.isActive = false,
  });
}

/// Portfolio or proof-of-work sample attached to a proposal (H01, H03)
@immutable
class PortfolioAttachment {
  final String id;
  final String title;
  final String url;
  final String type; // 'video' | 'link' | 'image' | 'pdf'

  const PortfolioAttachment({
    required this.id,
    required this.title,
    required this.url,
    required this.type,
  });
}

/// Application entity for H01, H02, H03
@immutable
class ApplicationModel {
  final String id;
  final String assignmentId;
  final String assignmentTitle;
  final String brandName;
  final String? brandAvatarUrl;
  final String location;
  final int assignmentBudget;
  final String applicantId;
  final String coverLetter;
  final int proposedRate;
  final String currency;
  final int estimatedDays;
  final List<PortfolioAttachment> attachments;
  final ApplicationStatus status;
  final String? brandFeedback;
  final List<StatusTimelineEvent> timeline;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ApplicationModel({
    required this.id,
    required this.assignmentId,
    required this.assignmentTitle,
    required this.brandName,
    this.brandAvatarUrl,
    required this.location,
    required this.assignmentBudget,
    required this.applicantId,
    required this.coverLetter,
    required this.proposedRate,
    this.currency = 'INR',
    this.estimatedDays = 4,
    this.attachments = const [],
    required this.status,
    this.brandFeedback,
    this.timeline = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isActive =>
      status == ApplicationStatus.submitted ||
      status == ApplicationStatus.underReview;

  bool get isShortlisted => status == ApplicationStatus.shortlisted;
  bool get isAccepted => status == ApplicationStatus.accepted;
  bool get isClosed =>
      status == ApplicationStatus.rejected ||
      status == ApplicationStatus.withdrawn;

  ApplicationModel copyWith({
    ApplicationStatus? status,
    String? brandFeedback,
    List<StatusTimelineEvent>? timeline,
  }) {
    return ApplicationModel(
      id: id,
      assignmentId: assignmentId,
      assignmentTitle: assignmentTitle,
      brandName: brandName,
      brandAvatarUrl: brandAvatarUrl,
      location: location,
      assignmentBudget: assignmentBudget,
      applicantId: applicantId,
      coverLetter: coverLetter,
      proposedRate: proposedRate,
      currency: currency,
      estimatedDays: estimatedDays,
      attachments: attachments,
      status: status ?? this.status,
      brandFeedback: brandFeedback ?? this.brandFeedback,
      timeline: timeline ?? this.timeline,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
    );
  }
}

/// Free vs Pro creator quota tracking (SOW §17, H01, DLG-49)
@immutable
class MonthlyQuotaInfo {
  final int remaining;
  final int total;
  final DateTime resetDate;
  final bool isPro;

  const MonthlyQuotaInfo({
    required this.remaining,
    required this.total,
    required this.resetDate,
    this.isPro = false,
  });

  bool get isExhausted => remaining <= 0 && !isPro;
}
