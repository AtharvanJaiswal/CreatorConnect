import '../entities/chat_entities.dart';

abstract class ChatRepository {
  /// Fetches conversations for either the Primary or Requests tab
  Future<List<ConversationItem>> getConversations({ChatTab tab = ChatTab.primary, String? query});

  /// Creates a new direct conversation or retrieves the existing one between peers
  Future<ConversationItem> createOrGetDirectConversation(String recipientId);

  /// Fetches a single conversation item by ID
  Future<ConversationItem?> getConversation(String conversationId);

  /// Retrieves message history for a conversation
  Future<List<ChatMessage>> getMessages(
    String conversationId, {
    String? currentUserId,
    String? peerId,
    String? peerName,
    String? peerAvatar,
  });

  /// Sends a new message in a conversation thread
  Future<ChatMessage> sendMessage(
    String conversationId,
    String text, {
    MessageAttachment? attachment,
  });

  /// Marks a conversation as read by the user
  Future<void> markConversationRead(String conversationId);

  /// Accepts an unverified / inbound message request (SCR-E02, SCR-E05)
  Future<void> acceptRequest(String conversationId);

  /// Declines and discards an inbound message request (SCR-E02, SCR-E05)
  Future<void> declineRequest(String conversationId, {String? reason});

  /// Submits an introductory message request (max 500 characters)
  Future<MessageRequestItem> createMessageRequest({
    required String recipientId,
    required String initialMessage,
  });

  /// Lists inbound or outbound message requests
  Future<List<MessageRequestItem>> getMessageRequests({
    String direction = 'incoming',
    String status = 'PENDING',
  });

  /// Cancels an outgoing pending message request
  Future<void> cancelMessageRequest(String requestId);

  /// Generates a short-lived download URL for an attachment
  Future<String?> getAttachmentDownloadUrl({
    required String conversationId,
    required String attachmentId,
  });

  /// Deletes a message either locally or for everyone (DLG-E09)
  Future<void> deleteMessage(
    String conversationId,
    String messageId, {
    required bool forEveryone,
  });

  /// Permanently blocks a peer from messaging or viewing profile (DLG-E10)
  Future<void> blockUser(String targetUserId, {String? reason});

  /// Dispatches incident report to the Admin moderation queue (DLG-E11)
  Future<void> reportUser({
    required String targetUserId,
    required String reason,
    String? details,
    String? conversationId,
  });

  /// Uploads multimedia or document attachment to storage (SCR-E06, DLG-E08)
  Future<MessageAttachment> uploadAttachment(
    String filePath,
    AttachmentType type, {
    String? originalName,
    int? fileSize,
  });
}
