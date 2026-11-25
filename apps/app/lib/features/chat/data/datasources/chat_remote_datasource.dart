import 'dart:math';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/network/api_client.dart';
import '../../../auth/data/datasources/auth_local_datasource.dart';
import '../../domain/entities/chat_entities.dart';

String _generateUuidV4() {
  final rng = Random();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

bool _isUuid(String id) {
  final reg = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
  return reg.hasMatch(id);
}

class ChatRemoteDataSource {
  final Dio _dio;

  ChatRemoteDataSource({Dio? dio}) : _dio = dio ?? ApiClient.createDio();

  Future<String> _resolveCurrentUserId() async {
    try {
      final cachedId = await AuthLocalDataSource().getCurrentUserId();
      if (cachedId != null && cachedId.isNotEmpty) {
        return cachedId;
      }
    } catch (_) {}
    return Supabase.instance.client.auth.currentUser?.id ?? '';
  }

  // ---------------------------------------------------------------------------
  // 1. Fetch Conversations (SCR-E01, SCR-E02)
  // ---------------------------------------------------------------------------

  Future<List<ConversationItem>> getConversations({
    ChatTab tab = ChatTab.primary,
    String? query,
  }) async {
    if (tab == ChatTab.requests) {
      try {
        final reqResponse = await _dio.get(
          '/api/v1/chat/requests',
          queryParameters: {'direction': 'incoming', 'status': 'PENDING'},
        );
        if (reqResponse.statusCode == 200 && reqResponse.data != null) {
          final data = reqResponse.data;
          final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
          final requestItems = list.map((e) {
            final req = MessageRequestItem.fromJson(e as Map<String, dynamic>);
            return ConversationItem.fromMessageRequest(req);
          }).toList();

          if (query != null && query.trim().isNotEmpty) {
            final q = query.toLowerCase().trim();
            return requestItems.where((conv) {
              return conv.peerName.toLowerCase().contains(q) ||
                  conv.peerHandle.toLowerCase().contains(q) ||
                  conv.lastMessage.toLowerCase().contains(q);
            }).toList();
          }
          return requestItems;
        }
      } catch (_) {
        // Fallback to conversation list filter if requests route fails
      }
    }

    final response = await _dio.get('/api/v1/conversations');
    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      final currentUserId = await _resolveCurrentUserId();
      final items = list.map((e) => ConversationItem.fromJson(e as Map<String, dynamic>, currentUserId: currentUserId)).toList();
      return _filterConversations(items, tab: tab, query: query);
    }
    return [];
  }

  List<ConversationItem> _filterConversations(
    List<ConversationItem> items, {
    required ChatTab tab,
    String? query,
  }) {
    var filtered = items.where((conv) {
      if (conv.isBlocked) return false;
      if (tab == ChatTab.primary) {
        return !conv.isRequest || conv.isAccepted;
      } else {
        return conv.isRequest && !conv.isAccepted;
      }
    }).toList();

    if (query != null && query.trim().isNotEmpty) {
      final q = query.toLowerCase().trim();
      filtered = filtered.where((conv) {
        return conv.peerName.toLowerCase().contains(q) ||
            conv.peerHandle.toLowerCase().contains(q) ||
            conv.lastMessage.toLowerCase().contains(q);
      }).toList();
    }

    return filtered;
  }

  // ---------------------------------------------------------------------------
  // 1b. Create or Retrieve Direct Conversation
  // ---------------------------------------------------------------------------

  Future<ConversationItem> createOrGetDirectConversation(String recipientId) async {
    final response = await _dio.post(
      '/api/v1/conversations',
      data: {'recipientId': recipientId},
    );
    if ((response.statusCode == 200 || response.statusCode == 201) && response.data != null) {
      final currentUserId = await _resolveCurrentUserId();
      return ConversationItem.fromJson(
        response.data as Map<String, dynamic>,
        currentUserId: currentUserId,
      );
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to create or retrieve conversation with $recipientId',
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Fetch Single Conversation
  // ---------------------------------------------------------------------------

  Future<ConversationItem?> getConversation(String conversationId) async {
    if (!_isUuid(conversationId)) return null;
    final response = await _dio.get('/api/v1/conversations/$conversationId');
    if (response.statusCode == 200 && response.data != null) {
      final currentUserId = await _resolveCurrentUserId();
      return ConversationItem.fromJson(response.data as Map<String, dynamic>, currentUserId: currentUserId);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 3. Message History (SCR-E04, SCR-E05, SCR-E06)
  // ---------------------------------------------------------------------------

  Future<List<ChatMessage>> getMessages(
    String conversationId, {
    String? currentUserId,
    String? peerId,
    String? peerName,
    String? peerAvatar,
  }) async {
    if (!_isUuid(conversationId)) return [];
    final response = await _dio.get('/api/v1/conversations/$conversationId/messages');
    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      final effectiveUid = currentUserId ?? await _resolveCurrentUserId();
      return list.map((e) => ChatMessage.fromJson(
        e as Map<String, dynamic>,
        currentUserId: effectiveUid,
        peerId: peerId ?? '',
        peerName: peerName ?? '',
        peerAvatar: peerAvatar ?? '',
      )).toList();
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // 4. Send Message (SCR-E04, SCR-E06)
  // ---------------------------------------------------------------------------

  Future<ChatMessage> sendMessage(
    String conversationId,
    String text, {
    MessageAttachment? attachment,
  }) async {
    final clientMessageId = _generateUuidV4();
    final currentUserId = await AuthLocalDataSource().getCurrentUserId() ?? Supabase.instance.client.auth.currentUser?.id ?? '';

    if (!_isUuid(conversationId)) {
      return ChatMessage(
        id: clientMessageId,
        conversationId: conversationId,
        senderId: currentUserId,
        senderName: 'You',
        isMe: true,
        text: text,
        timestamp: DateTime.now(),
        status: MessageStatus.sent,
        attachment: attachment,
        isSecurityShielded: false,
      );
    }

    final response = await _dio.post(
      '/api/v1/conversations/$conversationId/messages',
      data: {
        'clientMessageId': clientMessageId,
        'content': text.isNotEmpty ? text : (attachment?.fileName ?? 'Attachment'),
        if (attachment != null) 'mediaAssetIds': [attachment.id],
      },
    );

    if (response.statusCode == 201 && response.data != null) {
      final json = Map<String, dynamic>.from(response.data as Map);
      json['isMe'] = true;
      return ChatMessage.fromJson(
        json,
        currentUserId: currentUserId,
      );
    }

    return ChatMessage(
      id: clientMessageId,
      conversationId: conversationId,
      senderId: currentUserId,
      senderName: 'You',
      isMe: true,
      text: text,
      timestamp: DateTime.now(),
      status: MessageStatus.sent,
      attachment: attachment,
      isSecurityShielded: false,
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Read Receipt (SCR-E04)
  // ---------------------------------------------------------------------------

  Future<void> markConversationRead(String conversationId, {String sequence = '1000000'}) async {
    await _dio.post(
      '/api/v1/conversations/$conversationId/read',
      data: {'sequence': sequence},
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Accept / Decline / Create Message Request (SCR-E02, SCR-E05)
  // ---------------------------------------------------------------------------

  Future<void> acceptRequest(String requestIdOrConversationId) async {
    if (_isUuid(requestIdOrConversationId)) {
      try {
        final response = await _dio.post('/api/v1/chat/requests/$requestIdOrConversationId/accept');
        if (response.statusCode == 200) {
          return;
        }
      } catch (_) {
        // If not a request ID or already accepted, fallback to marking conversation read
      }
    }
    await markConversationRead(requestIdOrConversationId);
  }

  Future<void> declineRequest(String requestIdOrConversationId, {String? reason}) async {
    if (_isUuid(requestIdOrConversationId)) {
      try {
        await _dio.post(
          '/api/v1/chat/requests/$requestIdOrConversationId/decline',
          data: {if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim()},
        );
      } catch (_) {}
    }
  }

  Future<MessageRequestItem> createMessageRequest({
    required String recipientId,
    required String initialMessage,
  }) async {
    final trimmed = initialMessage.trim();
    if (trimmed.isEmpty || trimmed.length > 500) {
      throw ArgumentError('Introductory message must be between 1 and 500 characters.');
    }

    final response = await _dio.post(
      '/api/v1/chat/requests',
      data: {
        'recipientId': recipientId,
        'initialMessage': trimmed,
      },
    );

    if ((response.statusCode == 200 || response.statusCode == 201) && response.data != null) {
      return MessageRequestItem.fromJson(response.data as Map<String, dynamic>);
    }

    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to create message request',
    );
  }

  Future<List<MessageRequestItem>> getMessageRequests({
    String direction = 'incoming',
    String status = 'PENDING',
  }) async {
    final response = await _dio.get(
      '/api/v1/chat/requests',
      queryParameters: {
        'direction': direction,
        'status': status,
      },
    );

    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      return list.map((e) => MessageRequestItem.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<void> cancelMessageRequest(String requestId) async {
    await _dio.post('/api/v1/chat/requests/$requestId/cancel');
  }

  // ---------------------------------------------------------------------------
  // 7. Delete Message (DLG-E09)
  // ---------------------------------------------------------------------------

  Future<void> deleteMessage(
    String conversationId,
    String messageId, {
    required bool forEveryone,
  }) async {
    if (forEveryone && _isUuid(conversationId) && _isUuid(messageId)) {
      try {
        await _dio.delete('/api/v1/conversations/$conversationId/messages/$messageId');
      } catch (_) {}
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Block User (DLG-E10)
  // ---------------------------------------------------------------------------

  Future<void> blockUser(String targetUserId, {String? reason}) async {
    await _dio.post('/api/v1/blocks', data: {
      'targetUserId': targetUserId,
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Report User / Conversation (DLG-E11)
  // ---------------------------------------------------------------------------

  Future<void> reportUser({
    required String targetUserId,
    required String reason,
    String? details,
    String? conversationId,
  }) async {
    final category = _resolveReportCategory(reason);
    await _dio.post('/api/v1/reports', data: {
      'targetId': targetUserId,
      'targetType': 'USER',
      'category': category,
      'details': details ?? reason,
    });
  }

  String _resolveReportCategory(String reason) {
    final lower = reason.toLowerCase();
    if (lower.contains('payment') || lower.contains('scam') || lower.contains('off-platform')) {
      return 'SCAM';
    } else if (lower.contains('harass') || lower.contains('abusive')) {
      return 'HARASSMENT';
    } else if (lower.contains('spam') || lower.contains('advertising')) {
      return 'SPAM';
    } else if (lower.contains('inappropriate') || lower.contains('copyright') || lower.contains('media')) {
      return 'INAPPROPRIATE_CONTENT';
    } else if (lower.contains('file') || lower.contains('malicious') || lower.contains('virus')) {
      return 'MALICIOUS_FILE';
    }
    return 'OTHER';
  }

  // ---------------------------------------------------------------------------
  // 9b. Attachment Download Presigned URL (SCR-E07)
  // ---------------------------------------------------------------------------

  Future<String?> getAttachmentDownloadUrl({
    required String conversationId,
    required String attachmentId,
  }) async {
    try {
      final response = await _dio.get(
        '/api/v1/conversations/$conversationId/attachments/$attachmentId/download',
      );
      if (response.statusCode == 200 && response.data != null) {
        return response.data['downloadUrl'] as String?;
      }
    } catch (_) {}
    return null;
  }

  // ---------------------------------------------------------------------------
  // 10. Attachment Upload (SCR-E06, DLG-E08)
  // ---------------------------------------------------------------------------

  Future<MessageAttachment> uploadAttachment(
    String filePath,
    AttachmentType type, {
    String? originalName,
    int? fileSize,
    Uint8List? fileBytes,
  }) async {
    final fileName = originalName ?? filePath.split('/').last.split('\\').last;
    final size = fileSize ?? (fileBytes != null ? fileBytes.length : 1024 * 50);
    final sizeStr = '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';

    String mediaType;
    String mimeType;
    switch (type) {
      case AttachmentType.image:
        mediaType = 'IMAGE';
        mimeType = 'image/jpeg';
        break;
      case AttachmentType.video:
        mediaType = 'VIDEO';
        mimeType = 'video/mp4';
        break;
      case AttachmentType.document:
      case AttachmentType.brief:
        mediaType = 'DOCUMENT';
        mimeType = 'application/pdf';
        break;
    }

    // 1. Request presigned upload URL from backend
    final urlRes = await _dio.post(
      '/api/v1/media/upload-url',
      data: {
        'originalName': fileName,
        'mimeType': mimeType,
        'byteSize': size,
        'mediaType': mediaType,
      },
    );

    final assetId = urlRes.data['assetId'] as String;
    final uploadUrl = urlRes.data['uploadUrl'] as String;

    // 2. Put binary data to presigned URL if fileBytes provided
    if (fileBytes != null) {
      final uploadDio = Dio();
      await uploadDio.put(
        uploadUrl,
        data: fileBytes,
        options: Options(headers: {'Content-Type': mimeType}),
      );
    }

    // 3. Confirm upload with Fastify backend
    await _dio.post(
      '/api/v1/media/upload-confirm',
      data: {'assetId': assetId},
    );

    return MessageAttachment(
      id: assetId,
      type: type,
      fileName: fileName,
      fileSize: sizeStr,
      url: uploadUrl.split('?').first,
      pageCount: type == AttachmentType.document ? 1 : null,
    );
  }
}
