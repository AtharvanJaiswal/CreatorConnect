import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/data/datasources/auth_local_datasource.dart';
import '../../domain/entities/chat_entities.dart';
import '../../domain/repositories/chat_repository.dart';
import '../../data/repositories/chat_repository_impl.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  return ChatRepositoryImpl();
});

// -----------------------------------------------------------------------------
// 1. Conversations Inbox Notifier (E01, E02)
// -----------------------------------------------------------------------------

class ConversationsState {
  final List<ConversationItem> primaryConversations;
  final List<ConversationItem> requestConversations;
  final ChatTab activeTab;
  final bool isLoading;
  final String? searchQuery;
  final String? errorMessage;

  const ConversationsState({
    this.primaryConversations = const [],
    this.requestConversations = const [],
    this.activeTab = ChatTab.primary,
    this.isLoading = false,
    this.searchQuery,
    this.errorMessage,
  });

  List<ConversationItem> get activeItems => activeTab == ChatTab.primary
      ? primaryConversations
      : requestConversations;

  ConversationsState copyWith({
    List<ConversationItem>? primaryConversations,
    List<ConversationItem>? requestConversations,
    ChatTab? activeTab,
    bool? isLoading,
    String? searchQuery,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ConversationsState(
      primaryConversations: primaryConversations ?? this.primaryConversations,
      requestConversations: requestConversations ?? this.requestConversations,
      activeTab: activeTab ?? this.activeTab,
      isLoading: isLoading ?? this.isLoading,
      searchQuery: searchQuery ?? this.searchQuery,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class ConversationsNotifier extends StateNotifier<ConversationsState> {
  final ChatRepository _repo;

  ConversationsNotifier(this._repo) : super(const ConversationsState()) {
    loadInbox();
  }

  Future<void> loadInbox() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final primary = await _repo.getConversations(
        tab: ChatTab.primary,
        query: state.searchQuery,
      );
      final requests = await _repo.getConversations(
        tab: ChatTab.requests,
        query: state.searchQuery,
      );
      state = state.copyWith(
        primaryConversations: primary,
        requestConversations: requests,
        isLoading: false,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage:
            'Unable to connect to messaging server: ${e.toString().split('\n').first}',
      );
    }
  }

  void setTab(ChatTab tab) {
    state = state.copyWith(activeTab: tab);
  }

  void setSearchQuery(String? query) {
    state = state.copyWith(searchQuery: query);
    loadInbox();
  }

  Future<void> acceptRequest(String conversationId) async {
    await _repo.acceptRequest(conversationId);
    await loadInbox();
  }

  Future<void> declineRequest(String conversationId, {String? reason}) async {
    await _repo.declineRequest(conversationId, reason: reason);
    await loadInbox();
  }

  Future<MessageRequestItem> sendIntroductoryRequest({
    required String recipientId,
    required String initialMessage,
  }) async {
    final result = await _repo.createMessageRequest(
      recipientId: recipientId,
      initialMessage: initialMessage,
    );
    await loadInbox();
    return result;
  }
}

final conversationsProvider =
    StateNotifierProvider<ConversationsNotifier, ConversationsState>((ref) {
      final repo = ref.watch(chatRepositoryProvider);
      return ConversationsNotifier(repo);
    });

// -----------------------------------------------------------------------------
// 2. Chat Thread Notifier (E04, E05, E06)
// -----------------------------------------------------------------------------

class ChatThreadState {
  final ConversationItem? conversation;
  final List<ChatMessage> messages;
  final bool isLoading;
  final bool isTyping;

  const ChatThreadState({
    this.conversation,
    this.messages = const [],
    this.isLoading = false,
    this.isTyping = false,
  });

  ChatThreadState copyWith({
    ConversationItem? conversation,
    List<ChatMessage>? messages,
    bool? isLoading,
    bool? isTyping,
  }) {
    return ChatThreadState(
      conversation: conversation ?? this.conversation,
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      isTyping: isTyping ?? this.isTyping,
    );
  }
}

class ChatThreadNotifier extends StateNotifier<ChatThreadState> {
  final ChatRepository _repo;
  final String conversationId;
  Timer? _pollTimer;

  ChatThreadNotifier(this._repo, this.conversationId)
    : super(const ChatThreadState()) {
    loadThread();
    _startLivePolling();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startLivePolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      _pollNewMessages();
    });
  }

  Future<void> _pollNewMessages() async {
    if (!mounted || state.isLoading) return;
    try {
      final conv = state.conversation;
      final currentUserId =
          await AuthLocalDataSource().getCurrentUserId() ?? '';
      final latestMsgs = await _repo.getMessages(
        conversationId,
        currentUserId: currentUserId,
        peerId: conv?.peerId,
        peerName: conv?.peerName,
        peerAvatar: conv?.peerAvatar,
      );
      if (!mounted) return;
      if (latestMsgs.length != state.messages.length) {
        state = state.copyWith(messages: latestMsgs);
      }
    } catch (_) {}
  }

  void setInitialConversation(ConversationItem? conv) {
    if (conv != null && state.conversation == null) {
      state = state.copyWith(conversation: conv);
    }
  }

  Future<void> loadThread() async {
    state = state.copyWith(isLoading: true);
    try {
      final conv = await _repo.getConversation(conversationId);
      final currentUserId =
          await AuthLocalDataSource().getCurrentUserId() ?? '';
      final msgs = await _repo.getMessages(
        conversationId,
        currentUserId: currentUserId,
        peerId: conv?.peerId,
        peerName: conv?.peerName,
        peerAvatar: conv?.peerAvatar,
      );
      state = state.copyWith(
        conversation: conv ?? state.conversation,
        messages: msgs,
        isLoading: false,
      );
      if (conv != null && !conv.isRequest) {
        await _repo.markConversationRead(conversationId);
      }
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> sendMessage(String text, {MessageAttachment? attachment}) async {
    if (text.trim().isEmpty && attachment == null) return;

    final tempId = 'temp-${DateTime.now().millisecondsSinceEpoch}';
    final currentUserId = await AuthLocalDataSource().getCurrentUserId() ?? '';

    // 1. Optimistic insertion on the RIGHT side immediately with pending status
    final optimisticMsg = ChatMessage(
      id: tempId,
      conversationId: conversationId,
      senderId: currentUserId,
      senderName: 'You',
      isMe: true,
      text: text,
      timestamp: DateTime.now(),
      status: MessageStatus.pending,
      attachment: attachment,
      isSecurityShielded: false,
    );

    state = state.copyWith(messages: [...state.messages, optimisticMsg]);

    try {
      final serverMsg = await _repo.sendMessage(
        conversationId,
        text,
        attachment: attachment,
      );
      final confirmedMsg = serverMsg.copyWith(
        isMe: true,
        status: MessageStatus.sent,
      );

      // 2. Replace optimistic message with confirmed server message without duplication
      final updated = state.messages
          .map((m) => m.id == tempId ? confirmedMsg : m)
          .toList();
      state = state.copyWith(messages: updated);
    } catch (_) {
      // 3. Mark failed/pending
      final updated = state.messages.map((m) {
        if (m.id == tempId) {
          return m.copyWith(status: MessageStatus.pending);
        }
        return m;
      }).toList();
      state = state.copyWith(messages: updated);
    }
  }

  void setTyping(bool isTyping) {
    if (state.isTyping != isTyping) {
      state = state.copyWith(isTyping: isTyping);
    }
  }

  Future<void> acceptRequest() async {
    await _repo.acceptRequest(conversationId);
    await loadThread();
  }

  Future<void> declineRequest({String? reason}) async {
    await _repo.declineRequest(conversationId, reason: reason);
  }

  Future<void> deleteMessage(
    String messageId, {
    required bool forEveryone,
  }) async {
    await _repo.deleteMessage(
      conversationId,
      messageId,
      forEveryone: forEveryone,
    );
    final updated = state.messages.where((m) => m.id != messageId).toList();
    state = state.copyWith(messages: updated);
  }

  Future<void> blockUser({String? reason}) async {
    if (state.conversation != null) {
      await _repo.blockUser(state.conversation!.peerId, reason: reason);
      state = state.copyWith(
        conversation: state.conversation!.copyWith(isBlocked: true),
      );
    }
  }

  Future<void> reportUser(String reason, {String? details}) async {
    if (state.conversation != null) {
      await _repo.reportUser(
        targetUserId: state.conversation!.peerId,
        reason: reason,
        details: details,
        conversationId: conversationId,
      );
    }
  }
}

final chatThreadProvider =
    StateNotifierProvider.family<ChatThreadNotifier, ChatThreadState, String>((
      ref,
      conversationId,
    ) {
      final repo = ref.watch(chatRepositoryProvider);
      return ChatThreadNotifier(repo, conversationId);
    });
