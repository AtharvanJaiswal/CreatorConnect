import 'dart:math';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/config/env_config.dart';
import '../../domain/entities/chat_entities.dart';

String _generateUuidV4() {
  final rng = Random();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

class ChatRemoteDataSource {
  final Dio _dio;

  ChatRemoteDataSource({Dio? dio}) : _dio = dio ?? _createDefaultDio();

  static Dio _createDefaultDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: EnvironmentConfig.current.apiBaseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          try {
            final token = Supabase.instance.client.auth.currentSession?.accessToken;
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (_) {}
          return handler.next(options);
        },
      ),
    );

    return dio;
  }

  // ---------------------------------------------------------------------------
  // 1. Fetch Conversations (SCR-E01, SCR-E02)
  // ---------------------------------------------------------------------------

  Future<List<ConversationItem>> getConversations({
    ChatTab tab = ChatTab.primary,
    String? query,
  }) async {
    final response = await _dio.get('/api/v1/conversations');
    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      final currentUserId = Supabase.instance.client.auth.currentUser?.id ?? '';
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
  // 2. Fetch Single Conversation
  // ---------------------------------------------------------------------------

  Future<ConversationItem?> getConversation(String conversationId) async {
    final response = await _dio.get('/api/v1/conversations/$conversationId');
    if (response.statusCode == 200 && response.data != null) {
      final currentUserId = Supabase.instance.client.auth.currentUser?.id ?? '';
      return ConversationItem.fromJson(response.data as Map<String, dynamic>, currentUserId: currentUserId);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 3. Message History (SCR-E04, SCR-E05, SCR-E06)
  // ---------------------------------------------------------------------------

  Future<List<ChatMessage>> getMessages(String conversationId) async {
    final response = await _dio.get('/api/v1/conversations/$conversationId/messages');
    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      final currentUserId = Supabase.instance.client.auth.currentUser?.id ?? '';
      return list.map((e) => ChatMessage.fromJson(e as Map<String, dynamic>, currentUserId: currentUserId)).toList();
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
    final currentUserId = Supabase.instance.client.auth.currentUser?.id ?? '';

    final response = await _dio.post(
      '/api/v1/conversations/$conversationId/messages',
      data: {
        'clientMessageId': clientMessageId,
        'content': text.isNotEmpty ? text : (attachment?.fileName ?? 'Attachment'),
        if (attachment != null) 'mediaAssetIds': [attachment.id],
      },
    );

    if (response.statusCode == 201 && response.data != null) {
      return ChatMessage.fromJson(
        response.data as Map<String, dynamic>,
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
  // 6. Accept / Decline Request (SCR-E02, SCR-E05)
  // ---------------------------------------------------------------------------

  Future<void> acceptRequest(String conversationId) async {
    // Read mark and sync
    await markConversationRead(conversationId);
  }

  Future<void> declineRequest(String conversationId) async {
    // Optionally block or leave
  }

  // ---------------------------------------------------------------------------
  // 7. Delete Message (DLG-E09)
  // ---------------------------------------------------------------------------

  Future<void> deleteMessage(
    String conversationId,
    String messageId, {
    required bool forEveryone,
  }) async {
    // Optionally send deletion request if backend route available
  }

  // ---------------------------------------------------------------------------
  // 8. Block User (DLG-E10)
  // ---------------------------------------------------------------------------

  Future<void> blockUser(String targetUserId, {String? reason}) async {
    await _dio.post('/api/v1/blocks', data: {
      'targetUserId': targetUserId,
      if (reason != null) 'reason': reason,
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
    await _dio.post('/api/v1/reports', data: {
      'targetId': targetUserId,
      'targetType': 'USER',
      'reason': reason,
      if (details != null) 'details': details,
    });
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
