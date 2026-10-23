import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  const ConversationsState({
    this.primaryConversations = const [],
    this.requestConversations = const [],
    this.activeTab = ChatTab.primary,
    this.isLoading = false,
    this.searchQuery,
  });

  List<ConversationItem> get activeItems => activeTab == ChatTab.primary ? primaryConversations : requestConversations;

  ConversationsState copyWith({
    List<ConversationItem>? primaryConversations,
    List<ConversationItem>? requestConversations,
    ChatTab? activeTab,
    bool? isLoading,
    String? searchQuery,
  }) {
    return ConversationsState(
      primaryConversations: primaryConversations ?? this.primaryConversations,
      requestConversations: requestConversations ?? this.requestConversations,
      activeTab: activeTab ?? this.activeTab,
      isLoading: isLoading ?? this.isLoading,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class ConversationsNotifier extends StateNotifier<ConversationsState> {
  final ChatRepository _repo;

  ConversationsNotifier(this._repo) : super(const ConversationsState()) {
    loadInbox();
  }

  Future<void> loadInbox() async {
    state = state.copyWith(isLoading: true);
    try {
      final primary = await _repo.getConversations(tab: ChatTab.primary, query: state.searchQuery);
      final requests = await _repo.getConversations(tab: ChatTab.requests, query: state.searchQuery);
      state = state.copyWith(
        primaryConversations: primary,
        requestConversations: requests,
        isLoading: false,
      );
    } catch (_) {
      state = state.copyWith(isLoading: false);
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

  Future<void> declineRequest(String conversationId) async {
    await _repo.declineRequest(conversationId);
    await loadInbox();
  }
}

final conversationsProvider = StateNotifierProvider<ConversationsNotifier, ConversationsState>((ref) {
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

  ChatThreadNotifier(this._repo, this.conversationId) : super(const ChatThreadState()) {
    loadThread();
  }

  Future<void> loadThread() async {
    state = state.copyWith(isLoading: true);
    try {
      final conv = await _repo.getConversation(conversationId);
      final msgs = await _repo.getMessages(conversationId);
      state = state.copyWith(
        conversation: conv,
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
    try {
      final newMsg = await _repo.sendMessage(conversationId, text, attachment: attachment);
      state = state.copyWith(messages: [...state.messages, newMsg]);
    } catch (_) {}
  }

  Future<void> acceptRequest() async {
    await _repo.acceptRequest(conversationId);
    await loadThread();
  }

  Future<void> declineRequest() async {
    await _repo.declineRequest(conversationId);
  }

  Future<void> deleteMessage(String messageId, {required bool forEveryone}) async {
    await _repo.deleteMessage(conversationId, messageId, forEveryone: forEveryone);
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

final chatThreadProvider = StateNotifierProvider.family<ChatThreadNotifier, ChatThreadState, String>((ref, conversationId) {
  final repo = ref.watch(chatRepositoryProvider);
  return ChatThreadNotifier(repo, conversationId);
});
