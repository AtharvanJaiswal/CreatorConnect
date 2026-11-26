import 'package:flutter/foundation.dart';

/// Represents a user or brand that has been blocked.
/// Maps to backend `/api/v1/blocks` and contract `UserBlockResponse`.
@immutable
class BlockedUserModel {
  final String id;
  final String blockedUserId;
  final String displayName;
  final String? avatarUrl;
  final String role;
  final DateTime blockedAt;
  final String? reason;

  const BlockedUserModel({
    required this.id,
    required this.blockedUserId,
    required this.displayName,
    this.avatarUrl,
    this.role = 'Creator',
    required this.blockedAt,
    this.reason,
  });

  factory BlockedUserModel.fromJson(Map<String, dynamic> json) {
    final blockedUser = json['blockedUser'] as Map<String, dynamic>?;
    return BlockedUserModel(
      id: json['id'] as String? ?? '',
      blockedUserId: json['blockedId'] as String? ?? json['targetUserId'] as String? ?? (blockedUser?['id'] as String? ?? ''),
      displayName: blockedUser?['displayName'] as String? ??
          json['displayName'] as String? ??
          json['targetName'] as String? ??
          'Blocked User',
      avatarUrl: (blockedUser?['avatarUrl'] ?? json['avatarUrl']) as String?,
      role: (blockedUser?['role'] ?? json['role'] ?? 'User') as String,
      blockedAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      reason: json['reason'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'blockedUserId': blockedUserId,
    'displayName': displayName,
    'avatarUrl': avatarUrl,
    'role': role,
    'blockedAt': blockedAt.toIso8601String(),
    'reason': reason,
  };
}

/// Notification preferences mapped to backend `/api/v1/notification-preferences`.
@immutable
class NotificationPreferenceSetting {
  final bool assignmentAlerts;
  final bool applicationUpdates;
  final bool matchingBriefsDigest;
  final bool directMessages;
  final bool messageSound;
  final bool pushChannel;
  final bool emailChannel;
  final bool smsEscrowAlerts;

  const NotificationPreferenceSetting({
    this.assignmentAlerts = true,
    this.applicationUpdates = true,
    this.matchingBriefsDigest = false,
    this.directMessages = true,
    this.messageSound = true,
    this.pushChannel = true,
    this.emailChannel = true,
    this.smsEscrowAlerts = true,
  });

  NotificationPreferenceSetting copyWith({
    bool? assignmentAlerts,
    bool? applicationUpdates,
    bool? matchingBriefsDigest,
    bool? directMessages,
    bool? messageSound,
    bool? pushChannel,
    bool? emailChannel,
    bool? smsEscrowAlerts,
  }) {
    return NotificationPreferenceSetting(
      assignmentAlerts: assignmentAlerts ?? this.assignmentAlerts,
      applicationUpdates: applicationUpdates ?? this.applicationUpdates,
      matchingBriefsDigest: matchingBriefsDigest ?? this.matchingBriefsDigest,
      directMessages: directMessages ?? this.directMessages,
      messageSound: messageSound ?? this.messageSound,
      pushChannel: pushChannel ?? this.pushChannel,
      emailChannel: emailChannel ?? this.emailChannel,
      smsEscrowAlerts: smsEscrowAlerts ?? this.smsEscrowAlerts,
    );
  }

  factory NotificationPreferenceSetting.fromApiList(List<dynamic> items) {
    bool assignment = true;
    bool appUpdates = true;
    bool briefs = false;
    bool dms = true;
    bool push = true;
    bool email = true;

    for (final raw in items) {
      if (raw is Map<String, dynamic>) {
        final type = raw['type'] as String? ?? '';
        final channel = raw['channel'] as String? ?? '';
        final enabled = raw['enabled'] as bool? ?? true;

        if (channel == 'PUSH') push = push && enabled;
        if (channel == 'EMAIL') email = email && enabled;

        if (type == 'ASSIGNMENT_OFFER' || type == 'DELIVERABLE_APPROVED') {
          assignment = enabled;
        } else if (type == 'APPLICATION_ACCEPTED' || type == 'APPLICATION_REJECTED') {
          appUpdates = enabled;
        } else if (type == 'PROJECT_CREATED') {
          briefs = enabled;
        } else if (type == 'MESSAGE_RECEIVED') {
          dms = enabled;
        }
      }
    }

    return NotificationPreferenceSetting(
      assignmentAlerts: assignment,
      applicationUpdates: appUpdates,
      matchingBriefsDigest: briefs,
      directMessages: dms,
      messageSound: true,
      pushChannel: push,
      emailChannel: email,
      smsEscrowAlerts: true,
    );
  }

  List<Map<String, dynamic>> toApiUpdateItems() {
    return [
      {
        'type': 'ASSIGNMENT_OFFER',
        'channel': pushChannel ? 'PUSH' : 'EMAIL',
        'enabled': assignmentAlerts,
      },
      {
        'type': 'APPLICATION_ACCEPTED',
        'channel': pushChannel ? 'PUSH' : 'EMAIL',
        'enabled': applicationUpdates,
      },
      {
        'type': 'PROJECT_CREATED',
        'channel': emailChannel ? 'EMAIL' : 'PUSH',
        'enabled': matchingBriefsDigest,
      },
      {
        'type': 'MESSAGE_RECEIVED',
        'channel': pushChannel ? 'PUSH' : 'IN_APP',
        'enabled': directMessages,
      },
    ];
  }
}

/// Category options matching backend SupportTicketCategorySchema
enum SupportCategory {
  escrowReconciliation('ESCROW_RECONCILIATION', 'Payment & Escrow Milestone'),
  paymentDispute('PAYMENT_DISPUTE', 'Payment Dispute'),
  contractValidation('CONTRACT_VALIDATION', 'Contract & Deliverable'),
  accountAccess('ACCOUNT_ACCESS', 'Account Security & Access'),
  trustSafety('TRUST_SAFETY', 'Trust & Safety'),
  other('OTHER', 'General Inquiry');

  final String apiValue;
  final String label;

  const SupportCategory(this.apiValue, this.label);

  static SupportCategory fromApi(String val) {
    for (final c in SupportCategory.values) {
      if (c.apiValue == val) return c;
    }
    return SupportCategory.other;
  }
}

/// Represents a customer support ticket.
/// Maps to backend `/api/v1/support/tickets` and `SupportTicketResponse`.
@immutable
class SupportTicketModel {
  final String id;
  final String ticketNumber;
  final SupportCategory category;
  final String priority;
  final String status;
  final String subject;
  final String description;
  final String? linkedAssignmentId;
  final int? escrowAmount;
  final DateTime createdAt;

  const SupportTicketModel({
    required this.id,
    required this.ticketNumber,
    required this.category,
    this.priority = 'NORMAL',
    required this.status,
    required this.subject,
    required this.description,
    this.linkedAssignmentId,
    this.escrowAmount,
    required this.createdAt,
  });

  factory SupportTicketModel.fromJson(Map<String, dynamic> json) {
    return SupportTicketModel(
      id: json['id'] as String? ?? '',
      ticketNumber: json['ticketNumber'] as String? ?? 'TKT-PENDING',
      category: SupportCategory.fromApi(json['category'] as String? ?? 'OTHER'),
      priority: json['priority'] as String? ?? 'NORMAL',
      status: json['status'] as String? ?? 'OPEN',
      subject: json['subject'] as String? ?? '',
      description: json['description'] as String? ?? '',
      linkedAssignmentId: json['linkedAssignmentId'] as String?,
      escrowAmount: (json['escrowAmount'] as num?)?.toInt(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

/// GDPR / Right to Erasure request status
/// Maps to backend `/api/v1/privacy/erasure-request/status` and `PrivacyRequestResponse`.
@immutable
class ErasureRequestStatusModel {
  final String id;
  final String status;
  final String currentStage;
  final DateTime? coolingOffEndsAt;
  final DateTime? scheduledPurgeAt;
  final String? rejectionReason;
  final DateTime createdAt;

  const ErasureRequestStatusModel({
    required this.id,
    required this.status,
    required this.currentStage,
    this.coolingOffEndsAt,
    this.scheduledPurgeAt,
    this.rejectionReason,
    required this.createdAt,
  });

  factory ErasureRequestStatusModel.fromJson(Map<String, dynamic> json) {
    return ErasureRequestStatusModel(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      currentStage: json['currentStage'] as String? ?? 'REQUEST_RECEIVED',
      coolingOffEndsAt: json['coolingOffEndsAt'] != null
          ? DateTime.tryParse(json['coolingOffEndsAt'] as String)
          : null,
      scheduledPurgeAt: json['scheduledPurgeAt'] != null
          ? DateTime.tryParse(json['scheduledPurgeAt'] as String)
          : null,
      rejectionReason: json['rejectionReason'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

/// Represents an active or remote device session.
@immutable
class DeviceSessionModel {
  final String id;
  final String deviceName;
  final String clientName;
  final String location;
  final String lastActive;
  final bool isCurrent;

  const DeviceSessionModel({
    required this.id,
    required this.deviceName,
    required this.clientName,
    required this.location,
    required this.lastActive,
    this.isCurrent = false,
  });
}

/// Privacy and profile visibility preferences.
@immutable
class PrivacySettingsModel {
  final bool showInDiscovery;
  final bool showCommercialRates;
  final bool showOnlineStatus;
  final String whoCanMessage;
  final bool readReceipts;

  const PrivacySettingsModel({
    this.showInDiscovery = true,
    this.showCommercialRates = true,
    this.showOnlineStatus = true,
    this.whoCanMessage = 'Verified Only',
    this.readReceipts = true,
  });

  PrivacySettingsModel copyWith({
    bool? showInDiscovery,
    bool? showCommercialRates,
    bool? showOnlineStatus,
    String? whoCanMessage,
    bool? readReceipts,
  }) {
    return PrivacySettingsModel(
      showInDiscovery: showInDiscovery ?? this.showInDiscovery,
      showCommercialRates: showCommercialRates ?? this.showCommercialRates,
      showOnlineStatus: showOnlineStatus ?? this.showOnlineStatus,
      whoCanMessage: whoCanMessage ?? this.whoCanMessage,
      readReceipts: readReceipts ?? this.readReceipts,
    );
  }
}
