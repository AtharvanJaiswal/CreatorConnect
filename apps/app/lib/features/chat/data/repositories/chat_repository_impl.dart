import '../../domain/entities/chat_entities.dart';
import '../../domain/repositories/chat_repository.dart';
import '../datasources/chat_remote_datasource.dart';

class ChatRepositoryImpl implements ChatRepository {
  final ChatRemoteDataSource _remoteDataSource;

  ChatRepositoryImpl({ChatRemoteDataSource? remoteDataSource})
      : _remoteDataSource = remoteDataSource ?? ChatRemoteDataSource();

  @override
  Future<List<ConversationItem>> getConversations({
    ChatTab tab = ChatTab.primary,
    String? query,
  }) async {
    return _remoteDataSource.getConversations(tab: tab, query: query);
  }

  @override
  Future<ConversationItem?> getConversation(String conversationId) async {
    return _remoteDataSource.getConversation(conversationId);
  }

  @override
  Future<List<ChatMessage>> getMessages(String conversationId) async {
    return _remoteDataSource.getMessages(conversationId);
  }

  @override
  Future<ChatMessage> sendMessage(
    String conversationId,
    String text, {
    MessageAttachment? attachment,
  }) async {
    return _remoteDataSource.sendMessage(
      conversationId,
      text,
      attachment: attachment,
    );
  }

  @override
  Future<void> markConversationRead(String conversationId) async {
    return _remoteDataSource.markConversationRead(conversationId);
  }

  @override
  Future<void> acceptRequest(String conversationId) async {
    return _remoteDataSource.acceptRequest(conversationId);
  }

  @override
  Future<void> declineRequest(String conversationId) async {
    return _remoteDataSource.declineRequest(conversationId);
  }

  @override
  Future<void> deleteMessage(
    String conversationId,
    String messageId, {
    required bool forEveryone,
  }) async {
    return _remoteDataSource.deleteMessage(
      conversationId,
      messageId,
      forEveryone: forEveryone,
    );
  }

  @override
  Future<void> blockUser(String targetUserId, {String? reason}) async {
    return _remoteDataSource.blockUser(targetUserId, reason: reason);
  }

  @override
  Future<void> reportUser({
    required String targetUserId,
    required String reason,
    String? details,
    String? conversationId,
  }) async {
    return _remoteDataSource.reportUser(
      targetUserId: targetUserId,
      reason: reason,
      details: details,
      conversationId: conversationId,
    );
  }

  @override
  Future<MessageAttachment> uploadAttachment(
    String filePath,
    AttachmentType type, {
    String? originalName,
    int? fileSize,
  }) async {
    return _remoteDataSource.uploadAttachment(
      filePath,
      type,
      originalName: originalName,
      fileSize: fileSize,
    );
  }
}
