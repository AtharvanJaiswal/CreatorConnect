import 'package:flutter/foundation.dart';

/// Direct Invitation status matching backend TypeBox contract and Master Catalogue §H
enum InvitationStatus {
  pending('PENDING', 'Pending'),
  accepted('ACCEPTED', 'Accepted'),
  declined('DECLINED', 'Declined'),
  withdrawn('WITHDRAWN', 'Cancelled'),
  expired('EXPIRED', 'Expired');

  final String key;
  final String label;
  const InvitationStatus(this.key, this.label);

  static InvitationStatus fromString(String? val) {
    if (val == null) return InvitationStatus.pending;
    final upper = val.toUpperCase();
    for (final s in InvitationStatus.values) {
      if (s.key == upper || s.name.toUpperCase() == upper) return s;
    }
    return InvitationStatus.pending;
  }
}

/// Invitation Collaboration classification (H04)
enum InviteType {
  paidHire('PAID_HIRE', 'Paid Hire'),
  peerCollab('PEER_COLLAB', 'Peer Collab');

  final String key;
  final String label;
  const InviteType(this.key, this.label);
}

/// Direct Invitation entity for H04, H05, H06, H07
@immutable
class InvitationModel {
  final String id;
  final String projectId;
  final String projectTitle;
  final String senderId;
  final String senderName;
  final String? senderAvatarUrl;
  final String senderRole;
  final String recipientId;
  final String recipientName;
  final String? recipientAvatarUrl;
  final String recipientRole;
  final InviteType inviteType;
  final String message;
  final int budgetOffered;
  final String currency;
  final List<String> deliverables;
  final InvitationStatus status;
  final DateTime expiresAt;
  final DateTime createdAt;
  final DateTime? viewedAt;
  final String? declineReason;

  const InvitationModel({
    required this.id,
    required this.projectId,
    required this.projectTitle,
    required this.senderId,
    required this.senderName,
    this.senderAvatarUrl,
    required this.senderRole,
    required this.recipientId,
    required this.recipientName,
    this.recipientAvatarUrl,
    required this.recipientRole,
    required this.inviteType,
    required this.message,
    required this.budgetOffered,
    this.currency = 'INR',
    this.deliverables = const [],
    required this.status,
    required this.expiresAt,
    required this.createdAt,
    this.viewedAt,
    this.declineReason,
  });

  bool get isPending => status == InvitationStatus.pending;
  bool get isAccepted => status == InvitationStatus.accepted;
  bool get isDeclined => status == InvitationStatus.declined;
  bool get isWithdrawn => status == InvitationStatus.withdrawn;
  bool get isExpired =>
      status == InvitationStatus.expired ||
      (status == InvitationStatus.pending && DateTime.now().isAfter(expiresAt));

  int get daysRemaining {
    final diff = expiresAt.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  }

  InvitationModel copyWith({
    InvitationStatus? status,
    DateTime? viewedAt,
    String? declineReason,
  }) {
    return InvitationModel(
      id: id,
      projectId: projectId,
      projectTitle: projectTitle,
      senderId: senderId,
      senderName: senderName,
      senderAvatarUrl: senderAvatarUrl,
      senderRole: senderRole,
      recipientId: recipientId,
      recipientName: recipientName,
      recipientAvatarUrl: recipientAvatarUrl,
      recipientRole: recipientRole,
      inviteType: inviteType,
      message: message,
      budgetOffered: budgetOffered,
      currency: currency,
      deliverables: deliverables,
      status: status ?? this.status,
      expiresAt: expiresAt,
      createdAt: createdAt,
      viewedAt: viewedAt ?? this.viewedAt,
      declineReason: declineReason ?? this.declineReason,
    );
  }
}
