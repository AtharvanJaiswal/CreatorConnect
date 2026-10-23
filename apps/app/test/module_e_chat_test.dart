import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:creatorconnect/features/chat/domain/entities/chat_entities.dart';
import 'package:creatorconnect/features/chat/domain/repositories/chat_repository.dart';
import 'package:creatorconnect/features/chat/data/datasources/chat_remote_datasource.dart';
import 'package:creatorconnect/features/chat/presentation/controllers/chat_controllers.dart';
import 'package:creatorconnect/features/chat/presentation/screens/e01_conversations_list_screen.dart';
import 'package:creatorconnect/features/chat/presentation/widgets/pinned_brief_banner_widget.dart';
import 'package:creatorconnect/features/chat/presentation/widgets/message_bubble_widget.dart';
import 'package:creatorconnect/features/chat/presentation/widgets/typing_indicator_widget.dart';

// Mock HttpOverrides to avoid NetworkImage 400 errors during widget testing
class TestHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return _MockHttpClient();
  }
}

class _MockHttpClient implements HttpClient {
  @override
  Future<HttpClientRequest> getUrl(Uri url) async => _MockHttpClientRequest();

  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async => _MockHttpClientRequest();

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockHttpClientRequest implements HttpClientRequest {
  @override
  HttpHeaders get headers => _MockHttpHeaders();

  @override
  Future<HttpClientResponse> close() async => _MockHttpClientResponse();

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockHttpHeaders implements HttpHeaders {
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockHttpClientResponse implements HttpClientResponse {
  static final List<int> _kTransparentImage = [
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
  ];

  @override
  int get statusCode => 200;

  @override
  int get contentLength => _kTransparentImage.length;

  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;

  @override
  StreamSubscription<List<int>> listen(
    void Function(List<int> event)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) {
    return Stream<List<int>>.fromIterable([_kTransparentImage]).listen(
      onData,
      onError: onError,
      onDone: onDone,
      cancelOnError: cancelOnError,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class FakeChatRepository implements ChatRepository {
  final List<ConversationItem> _conversations = [
    const ConversationItem(
      id: 'conv-test-01',
      peerId: 'brand-01',
      peerName: 'Zara India',
      peerHandle: '@zara_india',
      peerRole: 'BRAND',
      peerAvatar: 'https://example.com/avatar.jpg',
      isPeerVerified: true,
      lastMessage: 'Here is the official campaign brief',
      lastMessageTime: '10:45 AM',
      unreadCount: 1,
      isRequest: false,
      isAccepted: true,
    ),
    const ConversationItem(
      id: 'conv-test-02',
      peerId: 'creator-01',
      peerName: 'Kabir Sen',
      peerHandle: '@kabir_cinematics',
      peerRole: 'CREATOR',
      peerAvatar: 'https://example.com/avatar2.jpg',
      isPeerVerified: false,
      lastMessage: 'Draft edit is rendering now',
      lastMessageTime: '09:30 AM',
      unreadCount: 0,
      isRequest: false,
      isAccepted: true,
    ),
    const ConversationItem(
      id: 'conv-test-03',
      peerId: 'creator-02',
      peerName: 'Ananya Sen',
      peerHandle: '@ananya.style',
      peerRole: 'CREATOR',
      peerAvatar: 'https://example.com/avatar3.jpg',
      isPeerVerified: false,
      lastMessage: 'Hey, loved your lookbook! Open to collab?',
      lastMessageTime: 'Yesterday',
      unreadCount: 1,
      isRequest: true,
      isAccepted: false,
    ),
  ];

  final Map<String, List<ChatMessage>> _messages = {
    'conv-test-03': [
      ChatMessage(
        id: 'm-ananya-1',
        conversationId: 'conv-test-03',
        senderId: 'creator-02',
        senderName: 'Ananya Sen',
        isMe: false,
        text: 'Hey, loved your lookbook! Open to collab?',
        timestamp: DateTime.now().subtract(const Duration(hours: 2)),
        isSecurityShielded: true,
      ),
    ],
    'conv-test-01': [
      ChatMessage(
        id: 'm-1',
        conversationId: 'conv-test-01',
        senderId: 'brand-01',
        senderName: 'Zara India',
        isMe: false,
        text: 'Here is the official campaign brief',
        timestamp: DateTime.now().subtract(const Duration(minutes: 10)),
      ),
    ],
  };

  @override
  Future<List<ConversationItem>> getConversations({ChatTab tab = ChatTab.primary, String? query}) async {
    return _conversations.where((c) {
      if (tab == ChatTab.primary) return !c.isRequest || c.isAccepted;
      return c.isRequest && !c.isAccepted;
    }).toList();
  }

  @override
  Future<ConversationItem?> getConversation(String conversationId) async {
    return _conversations.firstWhere((c) => c.id == conversationId);
  }

  @override
  Future<List<ChatMessage>> getMessages(String conversationId) async {
    return _messages[conversationId] ?? [];
  }

  @override
  Future<ChatMessage> sendMessage(String conversationId, String text, {MessageAttachment? attachment}) async {
    final msg = ChatMessage(
      id: 'm-new',
      conversationId: conversationId,
      senderId: 'me',
      senderName: 'You',
      isMe: true,
      text: text,
      timestamp: DateTime.now(),
    );
    _messages.putIfAbsent(conversationId, () => []).add(msg);
    return msg;
  }

  @override
  Future<void> markConversationRead(String conversationId) async {}

  @override
  Future<void> acceptRequest(String conversationId) async {
    final idx = _conversations.indexWhere((c) => c.id == conversationId);
    if (idx != -1) {
      _conversations[idx] = _conversations[idx].copyWith(isRequest: false, isAccepted: true);
    }
    if (_messages.containsKey(conversationId)) {
      _messages[conversationId] = _messages[conversationId]!
          .map((m) => m.copyWith(isSecurityShielded: false))
          .toList();
    }
  }

  @override
  Future<void> declineRequest(String conversationId) async {
    _conversations.removeWhere((c) => c.id == conversationId);
    _messages.remove(conversationId);
  }

  @override
  Future<void> deleteMessage(String conversationId, String messageId, {required bool forEveryone}) async {}

  @override
  Future<void> blockUser(String targetUserId, {String? reason}) async {}

  @override
  Future<void> reportUser({required String targetUserId, required String reason, String? details, String? conversationId}) async {}

  @override
  Future<MessageAttachment> uploadAttachment(String filePath, AttachmentType type, {String? originalName, int? fileSize}) async {
    return MessageAttachment(
      id: 'att-test',
      type: type,
      fileName: originalName ?? 'file.png',
      fileSize: '1 MB',
      url: 'https://example.com/file.png',
    );
  }
}

void main() {
  setUpAll(() {
    HttpOverrides.global = TestHttpOverrides();
  });

  group('Module E: Chat & Messaging Domain & Anti-Circumvention Tests', () {
    test('Anti-circumvention rule correctly masks phone numbers, emails, and URLs when shielded', () {
      final unshielded = ChatMessage(
        id: 'msg-1',
        conversationId: 'c-1',
        senderId: 'user-1',
        senderName: 'Ananya',
        isMe: false,
        text: 'Call me on 9820012345 or email ananya@style.com or check https://ananyastyle.com',
        timestamp: DateTime.now(),
        isSecurityShielded: false,
      );
      expect(unshielded.displayText, contains('9820012345'));
      expect(unshielded.displayText, contains('ananya@style.com'));
      expect(unshielded.displayText, contains('https://ananyastyle.com'));

      final shielded = unshielded.copyWith(isSecurityShielded: true);
      expect(shielded.displayText, isNot(contains('9820012345')));
      expect(shielded.displayText, isNot(contains('ananya@style.com')));
      expect(shielded.displayText, isNot(contains('https://ananyastyle.com')));
      expect(shielded.displayText, contains('[Contact Shielded]'));
      expect(shielded.displayText, contains('[Email Shielded]'));
      expect(shielded.displayText, contains('[Link Shielded]'));
    });

    test('ConversationItem.fromJson parses peer details, pinned brief, and request quarantine status', () {
      final json = {
        'id': 'conv-01',
        'peerId': 'peer-01',
        'peerName': 'Zara India',
        'peerHandle': '@zara_in',
        'peerRole': 'BRAND',
        'peerAvatar': 'https://example.com/avatar.jpg',
        'isPeerVerified': true,
        'isOnline': true,
        'lastMessage': 'Here is the brief',
        'lastMessageTime': '10:45 AM',
        'unreadCount': 2,
        'isRequest': false,
        'pinnedBrief': {
          'id': 'b-1',
          'title': 'Summer Reels Campaign',
          'budgetRange': '₹8k–15k',
          'location': 'Mumbai',
        },
      };

      final conv = ConversationItem.fromJson(json);
      expect(conv.id, 'conv-01');
      expect(conv.peerName, 'Zara India');
      expect(conv.peerRole, 'BRAND');
      expect(conv.isPeerVerified, isTrue);
      expect(conv.isOnline, isTrue);
      expect(conv.pinnedBrief, isNotNull);
      expect(conv.pinnedBrief!.title, 'Summer Reels Campaign');
      expect(conv.pinnedBrief!.budgetRange, '₹8k–15k');
    });

    test('MessageAttachment.fromJson handles document, video, and image types', () {
      final docJson = {
        'id': 'att-1',
        'type': 'document',
        'fileName': 'Zara_Summer_Brief.pdf',
        'fileSize': '3.2 MB',
        'url': 'https://example.com/brief.pdf',
        'pageCount': 12,
      };
      final docAtt = MessageAttachment.fromJson(docJson);
      expect(docAtt.type, AttachmentType.document);
      expect(docAtt.fileName, 'Zara_Summer_Brief.pdf');
      expect(docAtt.pageCount, 12);

      final vidJson = {
        'id': 'att-2',
        'type': 'video',
        'fileName': 'Clip_01.mp4',
        'fileSize': '24.5 MB',
        'url': 'https://example.com/clip.mp4',
      };
      final vidAtt = MessageAttachment.fromJson(vidJson);
      expect(vidAtt.type, AttachmentType.video);
      expect(vidAtt.fileSize, '24.5 MB');
    });
  });

  group('Module E: Chat Repository & Datasource Flow Tests', () {
    late FakeChatRepository repository;

    setUp(() {
      repository = FakeChatRepository();
    });

    test('ChatRemoteDataSource does not return mock data when backend unreachable', () async {
      final ds = ChatRemoteDataSource();
      expect(() => ds.getConversations(), throwsA(anything));
    });

    test('Separates Primary conversations from Quarantined Requests tab', () async {
      final primaryItems = await repository.getConversations(tab: ChatTab.primary);
      expect(primaryItems, isNotEmpty);
      expect(primaryItems.any((c) => c.peerName == 'Zara India'), isTrue);
      expect(primaryItems.any((c) => c.peerName == 'Kabir Sen'), isTrue);

      final requestItems = await repository.getConversations(tab: ChatTab.requests);
      expect(requestItems, isNotEmpty);
      expect(requestItems.any((c) => c.peerName == 'Ananya Sen'), isTrue);
      expect(requestItems.every((c) => c.isRequest && !c.isAccepted), isTrue);
    });

    test('Accepting inbound request moves it to Primary tab and unshields contact', () async {
      final initialRequests = await repository.getConversations(tab: ChatTab.requests);
      final ananya = initialRequests.firstWhere((c) => c.peerName == 'Ananya Sen');

      await repository.acceptRequest(ananya.id);

      final updatedRequests = await repository.getConversations(tab: ChatTab.requests);
      expect(updatedRequests.any((c) => c.id == ananya.id), isFalse);

      final updatedPrimary = await repository.getConversations(tab: ChatTab.primary);
      expect(updatedPrimary.any((c) => c.id == ananya.id), isTrue);

      final msgs = await repository.getMessages(ananya.id);
      expect(msgs.first.isSecurityShielded, isFalse);
    });

    test('Sending message appends to message thread with sent status', () async {
      const convId = 'conv-test-01';
      final before = await repository.getMessages(convId);
      final countBefore = before.length;

      final sent = await repository.sendMessage(convId, 'Looking forward to the production schedule!');
      expect(sent.text, 'Looking forward to the production schedule!');
      expect(sent.isMe, isTrue);

      final after = await repository.getMessages(convId);
      expect(after.length, countBefore + 1);
      expect(after.last.text, 'Looking forward to the production schedule!');
    });
  });

  group('Module E: Presentation Widgets & Screens Render Tests', () {
    testWidgets('PinnedBriefBannerWidget renders brief context and responds to tap', (tester) async {
      bool tapped = false;
      const brief = PinnedBriefContext(
        id: 'b-test-1',
        title: 'Summer Reels Campaign',
        budgetRange: '₹8k–15k',
        location: 'Mumbai',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PinnedBriefBannerWidget(
              brief: brief,
              onViewBrief: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Summer Reels Campaign'), findsOneWidget);
      expect(find.text('Budget: ₹8k–15k • Mumbai'), findsOneWidget);
      expect(find.text('View Brief'), findsOneWidget);

      await tester.tap(find.text('View Brief'));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('MessageBubbleWidget renders text, timestamp, and read receipts', (tester) async {
      final msg = ChatMessage(
        id: 'm-1',
        conversationId: 'c-1',
        senderId: 'me',
        senderName: 'You',
        isMe: true,
        text: 'Reviewing the guidelines now.',
        timestamp: DateTime(2026, 10, 23, 10, 30),
        status: MessageStatus.delivered,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubbleWidget(message: msg),
          ),
        ),
      );

      expect(find.text('Reviewing the guidelines now.'), findsOneWidget);
      expect(find.text('10:30 AM'), findsOneWidget);
      expect(find.byIcon(Icons.done_all_rounded), findsOneWidget);
    });

    testWidgets('TypingIndicatorWidget renders active socket typing indicator', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TypingIndicatorWidget(peerName: 'Kabir Sen'),
          ),
        ),
      );

      expect(find.text('Kabir Sen is typing'), findsOneWidget);
    });

    testWidgets('E01ConversationsListScreen renders tabs, search bar, and conversation cards', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            chatRepositoryProvider.overrideWithValue(FakeChatRepository()),
          ],
          child: const MaterialApp(
            home: E01ConversationsListScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Messages'), findsOneWidget);
      expect(find.text('Search conversations or messages...'), findsOneWidget);
      expect(find.text('Primary'), findsOneWidget);
      expect(find.text('Requests'), findsOneWidget);

      // Verify Primary list contains Zara India and Kabir Sen
      expect(find.text('Zara India'), findsOneWidget);
      expect(find.text('Kabir Sen'), findsOneWidget);

      // Switch to Requests tab by tapping the tab container
      await tester.tap(find.text('Requests'));
      await tester.pumpAndSettle();

      // Verify Explanatory Quarantine Banner
      expect(
        find.text('People you aren\'t connected with. They won\'t know you\'ve read their message until you accept.'),
        findsOneWidget,
      );

      // Verify request items and Accept/Decline action buttons
      expect(find.text('Ananya Sen'), findsOneWidget);
      expect(find.text('Accept Chat'), findsWidgets);
      expect(find.text('Decline'), findsWidgets);
    });
  });
}
