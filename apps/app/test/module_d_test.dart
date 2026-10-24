import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:creatorconnect/features/discovery/domain/entities/discovery_entities.dart';
import 'package:creatorconnect/features/discovery/presentation/widgets/profile_discovery_card.dart';
import 'package:creatorconnect/features/discovery/presentation/widgets/category_grid_card.dart';
import 'package:creatorconnect/features/discovery/presentation/dialogs/pop_dialogs.dart';
import 'package:creatorconnect/features/discovery/presentation/screens/d01_creator_home_screen.dart';
import 'package:creatorconnect/features/discovery/presentation/screens/d05_discover_home_screen.dart';

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
  // 1x1 transparent PNG bytes
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

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    HttpOverrides.global = TestHttpOverrides();
  });

  tearDownAll(() {
    HttpOverrides.global = null;
  });

  group('Module D: Production Tests', () {
    testWidgets('ProfileDiscoveryCard renders correctly and handles button clicks without layout overflow',
        (tester) async {
      const profile = ProfileCardModel(
        id: 'c-test-01',
        name: 'Super Long Name That Might Exceed Bounds If Not Handled With Flex Ellipsis Properly',
        handle: '@superlongnametest',
        role: 'CREATOR',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
        niche: 'Fashion & Sustainable Streetwear Extra Long Tag',
        city: 'Mumbai MMR',
        deliverableTags: ['Reels', 'Lookbooks'],
        matchReasons: [
          MatchReason(label: 'Matches your niche: Fashion', icon: '⭐'),
        ],
      );

      bool connectTapped = false;
      bool cardTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 320, // Strict narrow screen boundary test
              child: ProfileDiscoveryCard(
                profile: profile,
                onTap: () => cardTapped = true,
                onConnect: () => connectTapped = true,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Connect'), findsOneWidget);
      expect(find.text('Matches your niche: Fashion'), findsOneWidget);

      await tester.tap(find.text('Connect'));
      await tester.pump();
      expect(connectTapped, isTrue);

      await tester.tap(find.byType(ProfileDiscoveryCard));
      await tester.pump();
      expect(cardTapped, isTrue);

      // Verify no RenderFlex errors were thrown
      expect(tester.takeException(), isNull);
    });

    testWidgets('CategoryGridCard renders pastel theme and executes onTap callback', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CategoryGridCard(
              title: 'Fashion & Styling',
              subtitle: '1.2K Creators',
              backgroundColor: const Color(0xFFFFD64A),
              icon: Icons.checkroom_rounded,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Fashion & Styling'), findsOneWidget);
      expect(find.text('1.2K Creators'), findsOneWidget);

      await tester.tap(find.byType(CategoryGridCard));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('PopDialogs.showQuotaPaywall displays Free-tier limit notice (SOW §17)', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showQuotaPaywall(context),
                child: const Text('Trigger Paywall'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Trigger Paywall'));
      await tester.pumpAndSettle();

      expect(find.text('Daily Outreach Limit Reached'), findsOneWidget);
      expect(find.text('Upgrade to Creator Pro (₹499/mo) →'), findsOneWidget);
    });

    testWidgets('D01CreatorHomeScreen mounts and displays greeting and stats', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: D01CreatorHomeScreen(
              onNavigateToNotifications: () {},
              onNavigateToChat: () {},
              onOpenProfile: (_) {},
              onApplyOpportunity: (_) {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('CreatorConnect'), findsOneWidget);
      expect(find.text('PROFILE VIEWS'), findsOneWidget);
      expect(find.text('AVG RATING'), findsOneWidget);
      expect(find.text('OPEN BRIEFS'), findsOneWidget);
    });

    testWidgets('D05DiscoverHomeScreen displays search input and category grid', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: D05DiscoverHomeScreen(
              onOpenProfile: (_) {},
              onOpenSearch: () {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Search creators, niches, or cities...'), findsOneWidget);
      expect(find.text('Explore Categories'), findsOneWidget);
      expect(find.text('Fashion & Styling'), findsOneWidget);
      expect(find.text('Tech & AI Gadgets'), findsOneWidget);
    });
  });
}
