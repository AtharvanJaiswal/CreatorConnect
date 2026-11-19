import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:creatorconnect/features/chat/domain/entities/chat_entities.dart';
import 'package:creatorconnect/features/chat/domain/repositories/chat_repository.dart';
import 'package:creatorconnect/features/chat/data/datasources/chat_remote_datasource.dart';
import 'package:creatorconnect/features/chat/presentation/controllers/chat_controllers.dart';
import 'package:creatorconnect/features/chat/presentation/screens/e01_conversations_list_screen.dart';
import 'package:creatorconnect/features/chat/presentation/widgets/pinned_brief_banner_widget.dart';
import 'package:creatorconnect/features/chat/presentation/widgets/message_bubble_widget.dart';
import 'package:creatorconnect/features/chat/presentation/widgets/typing_indicator_widget.dart';
import 'package:creatorconnect/features/chat/presentation/screens/e04_chat_thread_screen.dart';
import 'package:creatorconnect/features/chat/presentation/screens/e07_attachment_viewer_screen.dart';
import 'package:creatorconnect/features/chat/presentation/dialogs/dlg_e09_delete_message_dialog.dart';
import 'package:creatorconnect/features/chat/presentation/dialogs/dlg_e10_block_user_dialog.dart';
import 'package:creatorconnect/features/chat/presentation/bottom_sheets/dlg_e08_attachment_picker_sheet.dart';
import 'package:creatorconnect/features/chat/presentation/bottom_sheets/dlg_e11_report_user_sheet.dart';

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
  Future<ConversationItem> createOrGetDirectConversation(String recipientId) async {
    final existing = _conversations.where((c) => c.peerId == recipientId).toList();
    if (existing.isNotEmpty) {
      return existing.first;
    }
    final newConv = ConversationItem(
      id: 'conv-new-${_conversations.length + 1}',
      peerId: recipientId,
      peerName: 'Collaborator',
      peerHandle: '@collaborator',
      peerRole: 'CREATOR',
      peerAvatar: '',
      lastMessage: 'Started new direct chat',
      lastMessageTime: 'Just now',
      isAccepted: true,
    );
    _conversations.add(newConv);
    return newConv;
  }

  @override
  Future<ConversationItem?> getConversation(String conversationId) async {
    return _conversations.firstWhere((c) => c.id == conversationId);
  }

  @override
  Future<List<ChatMessage>> getMessages(
    String conversationId, {
    String? currentUserId,
    String? peerId,
    String? peerName,
    String? peerAvatar,
  }) async {
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

class EmptyFakeChatRepository extends FakeChatRepository {
  @override
  Future<List<ConversationItem>> getConversations({ChatTab tab = ChatTab.primary, String? query}) async {
    return [];
  }
}

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({'user_auth_id': 'me'});
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

    testWidgets('E01ConversationsListScreen renders empty state with "Explore Collaborators →" button', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            chatRepositoryProvider.overrideWithValue(EmptyFakeChatRepository()),
          ],
          child: const MaterialApp(
            home: E01ConversationsListScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No conversations yet'), findsOneWidget);
      expect(find.text('Explore Collaborators →'), findsOneWidget);
    });

    testWidgets('E04ChatThreadScreen renders locked request panel for pending requests (SCR-E05)', (tester) async {
      const requestConv = ConversationItem(
        id: 'conv-test-03',
        peerId: 'creator-02',
        peerName: 'Ananya Sen',
        peerHandle: '@ananya.style',
        peerRole: 'CREATOR',
        peerAvatar: '',
        isPeerVerified: false,
        lastMessage: 'Hey, loved your lookbook!',
        lastMessageTime: 'Yesterday',
        isRequest: true,
        isAccepted: false,
        pinnedBrief: PinnedBriefContext(
          id: 'b-1',
          title: 'Summer Fashion Collab',
          budgetRange: '₹10k–20k',
          location: 'Mumbai',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            chatRepositoryProvider.overrideWithValue(FakeChatRepository()),
          ],
          child: MaterialApp(
            home: E04ChatThreadScreen(
              conversationId: 'conv-test-03',
              initialPeer: requestConv,
              initialBrief: requestConv.pinnedBrief,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Ananya Sen'), findsWidgets);
      expect(find.text('Summer Fashion Collab'), findsOneWidget);
      expect(find.text('Accept Request'), findsOneWidget);
      expect(find.text('Decline'), findsOneWidget);
      expect(find.byTooltip('Block User'), findsOneWidget);
      expect(find.textContaining('Phone numbers and direct contact details are shielded', findRichText: true), findsOneWidget);
    });

    testWidgets('DlgE08AttachmentPickerSheet renders attachment options and triggers selection callback', (tester) async {
      AttachmentType? selectedType;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  selectedType = await DlgE08AttachmentPickerSheet.show(context);
                },
                child: const Text('Open Picker'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Picker'));
      await tester.pumpAndSettle();

      expect(find.text('Share Content'), findsOneWidget);
      expect(find.text('Camera'), findsOneWidget);
      expect(find.text('Photos'), findsOneWidget);
      expect(find.text('Video Clip'), findsOneWidget);
      expect(find.text('Document'), findsOneWidget);
      expect(find.text('Attach Collaboration Brief'), findsOneWidget);

      await tester.tap(find.text('Document'));
      await tester.pumpAndSettle();
      expect(selectedType, AttachmentType.document);
    });

    testWidgets('DlgE09DeleteMessageDialog returns DeleteMessageChoice for everyone and me', (tester) async {
      DeleteMessageChoice? choice;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  choice = await DlgE09DeleteMessageDialog.show(context);
                },
                child: const Text('Delete'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();

      expect(find.text('Delete Message'), findsOneWidget);
      expect(find.text('Delete for Everyone'), findsOneWidget);
      expect(find.text('Delete for Me'), findsOneWidget);

      await tester.tap(find.text('Delete for Everyone'));
      await tester.pumpAndSettle();
      expect(choice, DeleteMessageChoice.forEveryone);
    });

    testWidgets('DlgE10BlockUserDialog confirms user blocking', (tester) async {
      bool? blocked;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  blocked = await DlgE10BlockUserDialog.show(context, peerName: 'Bad Actor');
                },
                child: const Text('Block'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Block'));
      await tester.pumpAndSettle();

      expect(find.text('Block Bad Actor?'), findsOneWidget);
      expect(find.text('Block User'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);

      await tester.tap(find.text('Block User'));
      await tester.pumpAndSettle();
      expect(blocked, isTrue);
    });

    testWidgets('DlgE11ReportUserSheet allows selecting reason and submitting report', (tester) async {
      ReportResult? result;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  result = await DlgE11ReportUserSheet.show(context, peerName: 'Suspicious User');
                },
                child: const Text('Report'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Report'));
      await tester.pumpAndSettle();

      expect(find.text('Report Conversation'), findsOneWidget);
      expect(find.text('Off-platform payment soliciting'), findsOneWidget);
      expect(find.text('Harassment or abusive conduct'), findsOneWidget);
      expect(find.text('Submit Report'), findsOneWidget);

      await tester.tap(find.text('Harassment or abusive conduct'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Submit Report'));
      await tester.pumpAndSettle();

      expect(result, isNotNull);
      expect(result!.reason, 'Harassment or abusive conduct');
    });

    testWidgets('E07AttachmentViewerScreen renders document attachment details and metadata', (tester) async {
      const att = MessageAttachment(
        id: 'att-pdf-1',
        type: AttachmentType.document,
        fileName: 'Deliverables_Agreement.pdf',
        fileSize: '3.4 MB',
        url: 'https://example.com/agreement.pdf',
        pageCount: 8,
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: E07AttachmentViewerScreen(
            attachment: att,
            sentBy: 'Zara India',
            timestamp: '11:20 AM',
          ),
        ),
      );

      expect(find.text('Deliverables_Agreement.pdf'), findsWidgets);
      expect(find.text('3.4 MB'), findsOneWidget);
      expect(find.text('Sent by Zara India • 11:20 AM'), findsOneWidget);
      expect(find.text('8 Pages • Verified Cloudflare R2 Upload'), findsOneWidget);
      expect(find.text('Download File'), findsOneWidget);
    });
  });

  group('Module E: Two-Sided Real-Time Messaging & Sender Identification Tests', () {
    const userAUuid = 'user-a-uuid-1111';
    const userBUuid = 'user-b-uuid-2222';

    test('ChatMessage.fromJson correctly identifies sender for Current User A (Sender perspective)', () {
      final jsonSentByA = {
        'id': 'msg-101',
        'conversationId': 'conv-ab',
        'senderId': userAUuid,
        'senderName': 'Alice',
        'text': 'Hi Zara! Excited to collaborate.',
        'createdAt': '2026-11-14T10:00:00.000Z',
        'deliveryStatus': 'read',
      };

      final msgFromAPerspective = ChatMessage.fromJson(
        jsonSentByA,
        currentUserId: userAUuid,
        peerId: userBUuid,
        peerName: 'Zara India',
      );

      expect(msgFromAPerspective.isMe, isTrue);
      expect(msgFromAPerspective.senderName, 'You');
      expect(msgFromAPerspective.status, MessageStatus.read);
    });

    test('ChatMessage.fromJson correctly identifies sender for Current User B (Receiver perspective)', () {
      final jsonSentByA = {
        'id': 'msg-101',
        'conversationId': 'conv-ab',
        'senderId': userAUuid,
        'senderName': 'Alice',
        'text': 'Hi Zara! Excited to collaborate.',
        'createdAt': '2026-11-14T10:00:00.000Z',
        'deliveryStatus': 'read',
      };

      final msgFromBPerspective = ChatMessage.fromJson(
        jsonSentByA,
        currentUserId: userBUuid,
        peerId: userAUuid,
        peerName: 'Alice',
      );

      expect(msgFromBPerspective.isMe, isFalse);
      expect(msgFromBPerspective.senderName, 'Alice');
    });

    test('ChatMessage.fromJson dual-guard fallback works when currentUserId is empty but peerId is known', () {
      final jsonPeerMsg = {
        'id': 'msg-102',
        'conversationId': 'conv-ab',
        'senderId': userBUuid,
        'senderName': 'Zara India',
        'text': 'Sounds great, Alice!',
        'createdAt': '2026-11-14T10:05:00.000Z',
      };

      final jsonOwnMsg = {
        'id': 'msg-103',
        'conversationId': 'conv-ab',
        'senderId': userAUuid,
        'senderName': 'Alice',
        'text': 'Let us finalize the deliverables.',
        'createdAt': '2026-11-14T10:06:00.000Z',
      };

      // In thread with peer userBUuid (currentUserId unknown / empty string)
      final peerMsg = ChatMessage.fromJson(jsonPeerMsg, peerId: userBUuid, peerName: 'Zara India');
      final ownMsg = ChatMessage.fromJson(jsonOwnMsg, peerId: userBUuid, peerName: 'Zara India');

      expect(peerMsg.isMe, isFalse);
      expect(peerMsg.senderName, 'Zara India');

      expect(ownMsg.isMe, isTrue);
      expect(ownMsg.senderName, 'You');
    });

    testWidgets('Sent message aligns RIGHT in yellow bubble with delivery tick receipt', (tester) async {
      final sentMsg = ChatMessage(
        id: 'msg-sent-1',
        conversationId: 'c-1',
        senderId: 'user-me',
        senderName: 'You',
        isMe: true,
        text: 'Hi Zara! I am good.',
        timestamp: DateTime(2026, 11, 14, 10, 31),
        status: MessageStatus.read,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubbleWidget(message: sentMsg),
          ),
        ),
      );

      expect(find.text('Hi Zara! I am good.'), findsOneWidget);
      expect(find.text('10:31 AM'), findsOneWidget);
      expect(find.byIcon(Icons.done_all_rounded), findsOneWidget);

      // Sent message Row is right-aligned
      final row = tester.widget<Row>(find.byType(Row).first);
      expect(row.mainAxisAlignment, MainAxisAlignment.end);

      // Verify no peer avatar is present for sent message
      expect(find.byType(CircleAvatar), findsNothing);
    });

    testWidgets('Received message aligns LEFT in white bubble with sender avatar and name', (tester) async {
      final receivedMsg = ChatMessage(
        id: 'msg-rec-1',
        conversationId: 'c-1',
        senderId: 'user-peer',
        senderName: 'Zara India',
        isMe: false,
        text: 'Hey! How are you?',
        timestamp: DateTime(2026, 11, 14, 10, 30),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubbleWidget(
              message: receivedMsg,
              showAvatar: true,
              showSenderName: true,
              peerName: 'Zara India',
            ),
          ),
        ),
      );

      expect(find.text('Hey! How are you?'), findsOneWidget);
      expect(find.text('Zara India'), findsOneWidget);
      expect(find.text('10:30 AM'), findsOneWidget);
      expect(find.byType(CircleAvatar), findsOneWidget);

      // Received message Row is left-aligned
      final row = tester.widget<Row>(find.byType(Row).first);
      expect(row.mainAxisAlignment, MainAxisAlignment.start);
    });

    testWidgets('Consecutive received messages omit repeated avatar and sender name', (tester) async {
      final middleMsg = ChatMessage(
        id: 'msg-rec-2',
        conversationId: 'c-1',
        senderId: 'user-peer',
        senderName: 'Zara India',
        isMe: false,
        text: 'Following up on our campaign brief.',
        timestamp: DateTime(2026, 11, 14, 10, 32),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubbleWidget(
              message: middleMsg,
              showAvatar: false, // Consecutive message in cluster
              showSenderName: false,
              peerName: 'Zara India',
            ),
          ),
        ),
      );

      expect(find.text('Following up on our campaign brief.'), findsOneWidget);
      // Sender name and CircleAvatar omitted to avoid clutter
      expect(find.text('Zara India'), findsNothing);
      expect(find.byType(CircleAvatar), findsNothing);
    });

    testWidgets('E04ChatThreadScreen displays two-sided chat layout with date separator badges', (tester) async {
      final yesterday = DateTime.now().subtract(const Duration(days: 1));
      final today = DateTime.now();

      final fakeRepo = FakeChatRepository();
      const testConvId = 'conv-two-sided-test';

      final convItem = const ConversationItem(
        id: testConvId,
        peerId: 'peer-zara',
        peerName: 'Zara India',
        peerHandle: '@zara_india',
        peerRole: 'BRAND',
        peerAvatar: '',
        isAccepted: true,
        lastMessage: 'Looking forward to it!',
        lastMessageTime: '10:33 AM',
      );

      fakeRepo._conversations.add(convItem);
      fakeRepo._messages[testConvId] = [
        ChatMessage(
          id: 'msg-1',
          conversationId: testConvId,
          senderId: 'peer-zara',
          senderName: 'Zara India',
          isMe: false,
          text: 'Hey! How are you?',
          timestamp: yesterday,
        ),
        ChatMessage(
          id: 'msg-2',
          conversationId: testConvId,
          senderId: 'me',
          senderName: 'You',
          isMe: true,
          text: 'Hi Zara! I am good.',
          timestamp: today.subtract(const Duration(minutes: 2)),
          status: MessageStatus.read,
        ),
        ChatMessage(
          id: 'msg-3',
          conversationId: testConvId,
          senderId: 'peer-zara',
          senderName: 'Zara India',
          isMe: false,
          text: 'That is great!',
          timestamp: today.subtract(const Duration(minutes: 1)),
        ),
        ChatMessage(
          id: 'msg-4',
          conversationId: testConvId,
          senderId: 'me',
          senderName: 'You',
          isMe: true,
          text: 'Thank you!',
          timestamp: today,
          status: MessageStatus.sent,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            chatRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: MaterialApp(
            home: E04ChatThreadScreen(
              conversationId: testConvId,
              initialPeer: convItem,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Check messages are present
      expect(find.text('Hey! How are you?'), findsOneWidget);
      expect(find.text('Hi Zara! I am good.'), findsOneWidget);
      expect(find.text('That is great!'), findsOneWidget);
      expect(find.text('Thank you!'), findsOneWidget);

      // Verify date separators
      expect(find.text('YESTERDAY'), findsOneWidget);
      expect(find.text('TODAY'), findsOneWidget);
    });
  });
}
