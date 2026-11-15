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
import 'package:creatorconnect/features/discovery/presentation/bottom_sheets/d08_sort_bottom_sheet.dart';
import 'package:creatorconnect/features/discovery/presentation/bottom_sheets/d11_profile_more_options_sheet.dart';
import 'package:creatorconnect/features/discovery/presentation/bottom_sheets/d13_how_matching_works_sheet.dart';
import 'package:creatorconnect/features/discovery/presentation/bottom_sheets/d15_profile_quick_view_sheet.dart';
import 'package:creatorconnect/features/discovery/presentation/screens/d14_search_presearch_screen.dart';

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
      expect(find.text('COLLAB CALLS'), findsOneWidget);
    });

    testWidgets('D05DiscoverHomeScreen displays search input, category grid, and Phase 1 role tabs', (tester) async {
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
      expect(find.text('Creator'), findsOneWidget);
      expect(find.text('Podcaster'), findsOneWidget);
      expect(find.text('Brand'), findsNothing);
      expect(find.text('Production Pro'), findsNothing);
      expect(find.text('Explore Categories'), findsOneWidget);
      expect(find.text('Fashion & Styling'), findsOneWidget);
      expect(find.text('Tech & AI Gadgets'), findsOneWidget);
    });

    testWidgets('POP-D01 Location Primer renders Find Creators Near You and Enable Location', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showLocationPrimer(context),
                child: const Text('Open Location Primer'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Location Primer'));
      await tester.pumpAndSettle();

      expect(find.text('Find Creators Near You'), findsOneWidget);
      expect(find.text('Enable Location'), findsOneWidget);
      expect(find.text('Not Now'), findsOneWidget);
    });

    testWidgets('POP-D03 Profile Saved dialog renders Profile Saved and handle', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showProfileSavedDialog(context, handle: '@aanya.fashion'),
                child: const Text('Open Saved Dialog'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Saved Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('Profile Saved'), findsOneWidget);
      expect(find.text('Added @aanya.fashion to your saved collaborators list.'), findsOneWidget);
      expect(find.text('View Saved Profiles'), findsOneWidget);
      expect(find.text('Done'), findsOneWidget);
    });

    testWidgets('POP-D04 Block User dialog renders confirmation with target name', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showBlockUserConfirmation(context, 'Rohan Verma'),
                child: const Text('Open Block Dialog'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Block Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('Block Rohan Verma?'), findsOneWidget);
      expect(find.text('Block User'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('POP-D05 Report Profile sheet renders moderation reasons', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showReportProfileSheet(context, 'Spammy Bot'),
                child: const Text('Open Report Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Report Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Report Spammy Bot'), findsOneWidget);
      expect(find.text('Spam or fake profile / Bot activity'), findsOneWidget);
      expect(find.text('Off-platform payment solicitation'), findsOneWidget);
    });

    testWidgets('POP-D06 Reset Filters dialog renders confirmation message', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showResetFiltersConfirmation(context),
                child: const Text('Open Reset Dialog'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Reset Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('Reset All Filters?'), findsOneWidget);
      expect(find.text('Reset'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('POP-D07 Offline dialog renders You\'re Offline and Retry Connection', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showOfflineDialog(context),
                child: const Text('Open Offline Dialog'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Offline Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('You\'re Offline'), findsOneWidget);
      expect(find.text('Retry Connection'), findsOneWidget);
    });

    testWidgets('POP-D08 Share Profile sheet renders sharing channel icons and Copy Link', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showShareProfileSheet(
                  context,
                  name: 'Kabir Sen',
                  handle: '@kabirsen',
                ),
                child: const Text('Open Share Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Share Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Share Profile'), findsOneWidget);
      expect(find.text('WhatsApp'), findsOneWidget);
      expect(find.text('Instagram'), findsOneWidget);
      expect(find.text('Copy Link'), findsOneWidget);
    });

    testWidgets('D08SortBottomSheet renders all 5 sort criteria', (tester) async {
      String? selectedSort;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => D08SortBottomSheet.show(context, 'relevance').then((v) => selectedSort = v),
                child: const Text('Open Sort Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Sort Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Sort Results By'), findsOneWidget);
      expect(find.text('Relevance (Recommended)'), findsOneWidget);
      expect(find.text('Rating: High to Low'), findsOneWidget);
      expect(find.text('Followers: High to Low'), findsOneWidget);
      expect(find.text('Most Recently Active'), findsOneWidget);
      expect(find.text('Budget: Low to High'), findsOneWidget);

      await tester.tap(find.text('Rating: High to Low'));
      await tester.pumpAndSettle();
      expect(selectedSort, equals('rating'));
    });

    testWidgets('D11ProfileMoreOptionsSheet renders options for user handle', (tester) async {
      bool blocked = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => D11ProfileMoreOptionsSheet.show(
                  context,
                  userName: 'Sneha Patel',
                  userHandle: '@snehap',
                  userId: 'u-123',
                  onUserBlocked: () => blocked = true,
                ),
                child: const Text('Open Options Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Options Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Options for @snehap'), findsOneWidget);
      expect(find.text('Share Profile'), findsOneWidget);
      expect(find.text('Copy Profile Link'), findsOneWidget);
      expect(find.text('Save Profile to List'), findsOneWidget);
      expect(find.text('Block Sneha Patel'), findsOneWidget);
      expect(find.text('Report Sneha Patel'), findsOneWidget);
      expect(blocked, isFalse);
    });

    testWidgets('D13HowMatchingWorksSheet renders all 3 SOW §13 matching pillars', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => D13HowMatchingWorksSheet.show(context),
                child: const Text('Open Matching Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Matching Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('How Matching Works'), findsOneWidget);
      expect(find.text('Niche & Category Overlap'), findsOneWidget);
      expect(find.text('Geographic Proximity'), findsOneWidget);
      expect(find.text('Rating & Response Track Record'), findsOneWidget);
      expect(find.text('Got it'), findsOneWidget);

      await tester.ensureVisible(find.text('Got it'));
      await tester.tap(find.text('Got it'));
      await tester.pumpAndSettle();
      expect(find.text('How Matching Works'), findsNothing);
    });

    testWidgets('D14SearchPreSearchScreen renders recent searches and trending tags', (tester) async {
      String? selectedQuery;
      await tester.pumpWidget(
        MaterialApp(
          home: D14SearchPreSearchScreen(
            onSelectQuery: (q) => selectedQuery = q,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Recent Searches'), findsOneWidget);
      expect(find.text('Sustainable Fashion Mumbai'), findsOneWidget);
      expect(find.text('Trending Tags'), findsOneWidget);
      expect(find.text('Popular Categories'), findsOneWidget);

      await tester.tap(find.text('Sustainable Fashion Mumbai'));
      await tester.pumpAndSettle();
      expect(selectedQuery, equals('Sustainable Fashion Mumbai'));
    });

    testWidgets('D15ProfileQuickViewSheet renders profile preview and actions', (tester) async {
      const profile = ProfileCardModel(
        id: 'c-quick-01',
        name: 'Arjun Das',
        handle: '@arjundas',
        role: 'CREATOR',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
        niche: 'Tech Reviews',
        city: 'Bengaluru',
        rating: 4.9,
        reviewCount: 32,
        bio: 'Creating deep dive tech reviews and gadget tear downs.',
        portfolioThumbnails: [
          'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200',
        ],
      );

      bool viewFullTapped = false;
      bool connectTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => D15ProfileQuickViewSheet.show(
                  context,
                  profile: profile,
                  onViewFullProfile: () => viewFullTapped = true,
                  onConnect: () => connectTapped = true,
                ),
                child: const Text('Open Quick View'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Quick View'));
      await tester.pumpAndSettle();

      expect(find.text('Arjun Das'), findsOneWidget);
      expect(find.text('@arjundas • Bengaluru'), findsOneWidget);
      expect(find.text('View Full Profile'), findsOneWidget);
      expect(find.text('Connect'), findsOneWidget);

      await tester.tap(find.text('View Full Profile'));
      await tester.pumpAndSettle();
      expect(viewFullTapped, isTrue);
      expect(connectTapped, isFalse);
    });

    testWidgets('POP-D09 First Connection Note Dialog renders input and 140-char counter', (tester) async {
      String? submittedNote;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  submittedNote = await PopDialogs.showFirstConnectionNoteDialog(
                    context,
                    recipientName: 'Priya Sharma',
                  );
                },
                child: const Text('Open Note Dialog'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Note Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('Connect with Priya Sharma'), findsOneWidget);
      expect(find.text('Add an optional project note'), findsOneWidget);
      expect(find.text('Skip & Send'), findsOneWidget);
      expect(find.text('Send Note'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Loved your reels!');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Send Note'));
      await tester.pumpAndSettle();

      expect(submittedNote, equals('Loved your reels!'));
    });

    testWidgets('POP-D10 Unverified Social Warning Sheet renders Code-in-Bio guidance', (tester) async {
      bool verifyTapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showUnverifiedSocialWarningSheet(
                  context,
                  platform: 'Instagram',
                  onVerifyNow: () => verifyTapped = true,
                ),
                child: const Text('Open Warning Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Warning Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Unverified Instagram Profile'), findsOneWidget);
      expect(find.text('Verify Now'), findsOneWidget);
      expect(find.text('Dismiss'), findsOneWidget);

      await tester.tap(find.text('Verify Now'));
      await tester.pumpAndSettle();

      expect(verifyTapped, isTrue);
    });

    testWidgets('POP-D11 Daily Search Rate Limit Notice renders anti-scraping alert', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showDailySearchRateLimitNotice(context),
                child: const Text('Open Rate Limit'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Rate Limit'));
      await tester.pumpAndSettle();

      expect(find.text('Search Rate Limit Reached'), findsOneWidget);
      expect(find.text('Understood'), findsOneWidget);

      await tester.tap(find.text('Understood'));
      await tester.pumpAndSettle();
      expect(find.text('Search Rate Limit Reached'), findsNothing);
    });

    testWidgets('POP-D12 Report Profile Multi-Step Confirmation renders evidence toggle and submit', (tester) async {
      bool reportSubmitted = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => PopDialogs.showMultiStepReportConfirmation(
                  context,
                  targetName: 'Fake User',
                  reason: 'SPAM',
                  onConfirm: (r, d, e) async {
                    reportSubmitted = true;
                  },
                ),
                child: const Text('Open Multi-Step Report'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Multi-Step Report'));
      await tester.pumpAndSettle();

      expect(find.text('Report Fake User'), findsOneWidget);
      expect(find.text('Category: SPAM'), findsOneWidget);
      expect(find.text('Attach screenshot evidence'), findsOneWidget);
      expect(find.text('Submit Report'), findsOneWidget);

      await tester.tap(find.text('Attach screenshot evidence'));
      await tester.pumpAndSettle();
      expect(find.text('Screenshot evidence attached (chat_snapshot.png)'), findsOneWidget);

      await tester.tap(find.text('Submit Report'));
      await tester.pumpAndSettle();
      expect(reportSubmitted, isTrue);
    });
  });
}
