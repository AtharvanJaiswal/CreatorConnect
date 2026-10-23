import 'package:flutter/foundation.dart';

/// Enum representing the primary tabs on SCR-E01 / SCR-E02
enum ChatTab {
  primary,
  requests,
}

/// Message delivery and read state per SOW §7.1 & SCR-E04 / SCR-E06
enum MessageStatus {
  pending,
  sent,
  delivered,
  read,
}

/// Supported attachment types per SCR-E06 & SCR-E07
enum AttachmentType {
  image,
  video,
  document,
  brief,
}

/// Pinned collaboration brief context pinned to top of thread (SCR-E04)
@immutable
class PinnedBriefContext {
  final String id;
  final String title;
  final String budgetRange;
  final String location;
  final String? category;

  const PinnedBriefContext({
    required this.id,
    required this.title,
    required this.budgetRange,
    required this.location,
    this.category,
  });

  factory PinnedBriefContext.fromJson(Map<String, dynamic> json) {
    return PinnedBriefContext(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Collaboration Brief',
      budgetRange: json['budgetRange'] as String? ?? '₹8k–15k',
      location: json['location'] as String? ?? 'Mumbai',
      category: json['category'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'budgetRange': budgetRange,
    'location': location,
    'category': category,
  };
}

/// Attachment metadata for Cloudflare R2 / S3 file transfers (SCR-E06, SCR-E07)
@immutable
class MessageAttachment {
  final String id;
  final AttachmentType type;
  final String fileName;
  final String fileSize;
  final String url;
  final String? thumbnailUrl;
  final int? pageCount;

  const MessageAttachment({
    required this.id,
    required this.type,
    required this.fileName,
    required this.fileSize,
    required this.url,
    this.thumbnailUrl,
    this.pageCount,
  });

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    return MessageAttachment(
      id: json['id'] as String? ?? '',
      type: AttachmentType.values.firstWhere(
        (e) => e.name.toLowerCase() == (json['type'] as String? ?? '').toLowerCase(),
        orElse: () => AttachmentType.document,
      ),
      fileName: json['fileName'] as String? ?? 'attachment',
      fileSize: json['fileSize'] as String? ?? '1.2 MB',
      url: json['url'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String?,
      pageCount: json['pageCount'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.name,
    'fileName': fileName,
    'fileSize': fileSize,
    'url': url,
    'thumbnailUrl': thumbnailUrl,
    'pageCount': pageCount,
  };
}

/// Individual chat bubble message item (SCR-E04, SCR-E05, SCR-E06)
@immutable
class ChatMessage {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final bool isMe;
  final String text;
  final DateTime timestamp;
  final MessageStatus status;
  final MessageAttachment? attachment;
  final bool isSecurityShielded;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.isMe,
    required this.text,
    required this.timestamp,
    this.status = MessageStatus.sent,
    this.attachment,
    this.isSecurityShielded = false,
  });

  ChatMessage copyWith({
    String? id,
    String? conversationId,
    String? senderId,
    String? senderName,
    bool? isMe,
    String? text,
    DateTime? timestamp,
    MessageStatus? status,
    MessageAttachment? attachment,
    bool? isSecurityShielded,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      isMe: isMe ?? this.isMe,
      text: text ?? this.text,
      timestamp: timestamp ?? this.timestamp,
      status: status ?? this.status,
      attachment: attachment ?? this.attachment,
      isSecurityShielded: isSecurityShielded ?? this.isSecurityShielded,
    );
  }

  /// Shields contact details (phone numbers, email addresses, external URLs)
  /// under the anti-circumvention rules for unaccepted message requests.
  String get displayText {
    if (!isSecurityShielded) return text;
    // Mask phone numbers (10 digits), emails, and hyperlinks
    var masked = text;
    // Regex for phone numbers: 10 digits with optional spaces or dashes
    masked = masked.replaceAll(RegExp(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'), '[Contact Shielded]');
    // Regex for emails
    masked = masked.replaceAll(RegExp(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'), '[Email Shielded]');
    // Regex for URLs
    masked = masked.replaceAll(RegExp(r'https?:\/\/[^\s]+|www\.[^\s]+'), '[Link Shielded]');
    return masked;
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json, {String currentUserId = ''}) {
    final senderId = json['senderId'] as String? ?? '';
    final isMe = (json['isMe'] as bool?) ?? (currentUserId.isNotEmpty && senderId == currentUserId);

    return ChatMessage(
      id: json['id'] as String? ?? '',
      conversationId: json['conversationId'] as String? ?? '',
      senderId: senderId,
      senderName: json['senderName'] as String? ?? 'User',
      isMe: isMe,
      text: json['text'] as String? ?? json['content'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : (json['createdAt'] != null
              ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
      status: MessageStatus.values.firstWhere(
        (e) => e.name.toLowerCase() == (json['status'] as String? ?? '').toLowerCase(),
        orElse: () => MessageStatus.delivered,
      ),
      attachment: json['attachment'] != null
          ? MessageAttachment.fromJson(json['attachment'] as Map<String, dynamic>)
          : null,
      isSecurityShielded: json['isSecurityShielded'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'conversationId': conversationId,
    'senderId': senderId,
    'senderName': senderName,
    'isMe': isMe,
    'text': text,
    'timestamp': timestamp.toIso8601String(),
    'status': status.name,
    'attachment': attachment?.toJson(),
    'isSecurityShielded': isSecurityShielded,
  };
}

/// Inbox conversation item representing peer thread in SCR-E01 / SCR-E02
@immutable
class ConversationItem {
  final String id;
  final String peerId;
  final String peerName;
  final String peerHandle;
  final String peerRole; // BRAND, CREATOR, PRODUCTION HOUSE, etc.
  final String peerAvatar;
  final bool isPeerVerified;
  final bool isOnline;
  final String? lastSeen;
  final String lastMessage;
  final String lastMessageTime;
  final int unreadCount;
  final bool isRequest; // true = quarantined in Requests tab (SCR-E02)
  final String? followers;
  final String? location;
  final PinnedBriefContext? pinnedBrief;
  final bool isAccepted;
  final bool isBlocked;

  const ConversationItem({
    required this.id,
    required this.peerId,
    required this.peerName,
    required this.peerHandle,
    required this.peerRole,
    required this.peerAvatar,
    this.isPeerVerified = false,
    this.isOnline = false,
    this.lastSeen,
    required this.lastMessage,
    required this.lastMessageTime,
    this.unreadCount = 0,
    this.isRequest = false,
    this.followers,
    this.location,
    this.pinnedBrief,
    this.isAccepted = true,
    this.isBlocked = false,
  });

  ConversationItem copyWith({
    String? id,
    String? peerId,
    String? peerName,
    String? peerHandle,
    String? peerRole,
    String? peerAvatar,
    bool? isPeerVerified,
    bool? isOnline,
    String? lastSeen,
    String? lastMessage,
    String? lastMessageTime,
    int? unreadCount,
    bool? isRequest,
    String? followers,
    String? location,
    PinnedBriefContext? pinnedBrief,
    bool? isAccepted,
    bool? isBlocked,
  }) {
    return ConversationItem(
      id: id ?? this.id,
      peerId: peerId ?? this.peerId,
      peerName: peerName ?? this.peerName,
      peerHandle: peerHandle ?? this.peerHandle,
      peerRole: peerRole ?? this.peerRole,
      peerAvatar: peerAvatar ?? this.peerAvatar,
      isPeerVerified: isPeerVerified ?? this.isPeerVerified,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageTime: lastMessageTime ?? this.lastMessageTime,
      unreadCount: unreadCount ?? this.unreadCount,
      isRequest: isRequest ?? this.isRequest,
      followers: followers ?? this.followers,
      location: location ?? this.location,
      pinnedBrief: pinnedBrief ?? this.pinnedBrief,
      isAccepted: isAccepted ?? this.isAccepted,
      isBlocked: isBlocked ?? this.isBlocked,
    );
  }

  factory ConversationItem.fromJson(Map<String, dynamic> json, {String currentUserId = ''}) {
    String peerId = json['peerId'] as String? ?? '';
    String peerName = json['peerName'] as String? ?? '';
    String peerHandle = json['peerHandle'] as String? ?? '';
    String peerRole = (json['peerRole'] as String? ?? 'CREATOR').toUpperCase();
    String peerAvatar = json['peerAvatar'] as String? ?? '';
    bool isPeerVerified = json['isPeerVerified'] as bool? ?? false;

    if (json['participants'] is List) {
      final participants = json['participants'] as List;
      final peer = participants.firstWhere(
        (p) => p is Map && p['userId'] != currentUserId,
        orElse: () => participants.isNotEmpty ? participants.first : null,
      );
      if (peer is Map) {
        if (peerId.isEmpty) peerId = peer['userId'] as String? ?? '';
        if (peerName.isEmpty) {
          peerName = peer['userName'] as String? ??
              peer['name'] as String? ??
              peer['fullName'] as String? ??
              json['title'] as String? ??
              'User';
        }
        if (peerHandle.isEmpty) peerHandle = peer['handle'] as String? ?? '';
        if (peerAvatar.isEmpty) peerAvatar = peer['avatarUrl'] as String? ?? '';
        if (peer['role'] != null) peerRole = peer['role'].toString().toUpperCase();
      }
    }

    if (peerName.isEmpty) {
      peerName = json['title'] as String? ?? 'User';
    }

    return ConversationItem(
      id: json['id'] as String? ?? '',
      peerId: peerId,
      peerName: peerName,
      peerHandle: peerHandle,
      peerRole: peerRole,
      peerAvatar: peerAvatar,
      isPeerVerified: isPeerVerified,
      isOnline: json['isOnline'] as bool? ?? false,
      lastSeen: json['lastSeen'] as String?,
      lastMessage: json['lastMessage'] as String? ?? (json['title'] as String? ?? ''),
      lastMessageTime: json['lastMessageTime'] as String? ?? 'Recently',
      unreadCount: json['unreadCount'] as int? ?? 0,
      isRequest: json['isRequest'] as bool? ?? false,
      followers: json['followers'] as String?,
      location: json['location'] as String?,
      pinnedBrief: json['pinnedBrief'] != null
          ? PinnedBriefContext.fromJson(json['pinnedBrief'] as Map<String, dynamic>)
          : null,
      isAccepted: json['isAccepted'] as bool? ?? true,
      isBlocked: json['isBlocked'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'peerId': peerId,
    'peerName': peerName,
    'peerHandle': peerHandle,
    'peerRole': peerRole,
    'peerAvatar': peerAvatar,
    'isPeerVerified': isPeerVerified,
    'isOnline': isOnline,
    'lastSeen': lastSeen,
    'lastMessage': lastMessage,
    'lastMessageTime': lastMessageTime,
    'unreadCount': unreadCount,
    'isRequest': isRequest,
    'followers': followers,
    'location': location,
    'pinnedBrief': pinnedBrief?.toJson(),
    'isAccepted': isAccepted,
    'isBlocked': isBlocked,
  };
}
