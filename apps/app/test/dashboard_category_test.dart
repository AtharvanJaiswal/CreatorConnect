import 'package:creatorconnect/core/config/feature_flags.dart';
import 'package:creatorconnect/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:creatorconnect/features/discovery/data/datasources/module_d_remote_datasource.dart';
import 'package:creatorconnect/features/discovery/presentation/controllers/module_d_controllers.dart';
import 'package:creatorconnect/features/discovery/presentation/screens/d01_creator_home_screen.dart';
import 'package:creatorconnect/features/discovery/presentation/screens/d02_brand_home_screen.dart';
import 'package:creatorconnect/features/discovery/presentation/screens/d03_empty_home_screen.dart';
import 'package:creatorconnect/features/discovery/presentation/screens/module_d_shell_screen.dart';
import 'package:creatorconnect/features/discovery/presentation/widgets/dashboard_category_strip.dart';
import 'package:creatorconnect/features/discovery/presentation/widgets/offline_banner_widget.dart';
import 'package:creatorconnect/features/profile/data/repositories/profile_repository_impl.dart';
import 'package:creatorconnect/features/profile/domain/entities/profile_entities.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockDashboardRemoteDataSource extends ModuleDRemoteDataSource {
  final Map<String, dynamic>? responseOverride;
  final bool shouldThrow;
  String? lastRequestedRole;

  _MockDashboardRemoteDataSource({
    this.responseOverride,
    this.shouldThrow = false,
  });

  @override
  Future<Map<String, dynamic>> getHomeDashboard({
    String? role,
    String? userId,
  }) async {
    lastRequestedRole = role;
    if (shouldThrow) {
      throw Exception('Connection timed out');
    }
    return responseOverride ??
        {
          'role': 'CREATOR',
          'completionPercentage': 90,
          'greeting': 'Good morning 👋',
          'stats': {
            'profileViews': 124,
            'rating': 4.9,
            'openBriefsCount': 2,
          },
          'recommendedProfiles': [
            {
              'id': 'rec-1',
              'name': 'Urban Vogue',
              'handle': '@urbanvogue',
              'role': 'BRAND',
              'niche': 'Fashion & Lifestyle',
              'city': 'Bengaluru',
              'avatarUrl': '',
            },
            {
              'id': 'rec-2',
              'name': 'PixelForge',
              'handle': '@pixelforge',
              'role': 'BRAND',
              'niche': 'Tech',
              'city': 'Bengaluru',
              'avatarUrl': '',
            },
          ],
          'nearbyOpportunities': [
            {
              'id': 'opp-fashion',
              'title': 'Summer Lookbook Reels Shoot',
              'brandName': 'Urban Vogue',
              'category': 'Fashion & Lifestyle',
              'budget': 22000,
              'location': 'Bengaluru',
              'deadline': '2 days left',
              'deliverableType': '2 Reels',
            },
            {
              'id': 'opp-tech',
              'title': 'AI Laptop Unboxing Series',
              'brandName': 'PixelForge',
              'category': 'Tech',
              'budget': 30000,
              'location': 'Bengaluru',
              'deadline': '4 days left',
              'deliverableType': '1 YouTube Video',
            },
          ],
        };
  }
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    ProfileRepositoryImpl.resetForTesting();
  });

  group('Dashboard Category & Persona Tests', () {
    test('HomeDashboardNotifier preserves PROFESSIONAL and PODCASTER roles when backend falls back to CREATOR', () async {
      final authLocal = AuthLocalDataSource();
      await authLocal.saveSelectedRole('PROFESSIONAL');

      final profileRepo = ProfileRepositoryImpl.instance;
      await profileRepo.saveBasicInfoDraft(
        const BasicInfoData(displayName: 'Arjun', city: 'Bengaluru'),
      );
      await profileRepo.saveCategorySelection(const [
        '018f0001-0000-7000-8000-000000000004', // Tech
      ]);
      await profileRepo.saveProfessionalDetailsDraft(
        const ProfessionalDetailsData(
          professionalType: 'Cinematographer',
          experience: '3–5 years',
        ),
      );

      final mockDs = _MockDashboardRemoteDataSource(
        responseOverride: {
          'role': 'CREATOR', // Backend currently returns 'CREATOR' for non-BRAND roles
          'completionPercentage': 80,
          'greeting': 'Good morning, Arjun 👋',
          'stats': {'profileViews': 40, 'rating': 4.8, 'openBriefsCount': 2},
          'recommendedProfiles': [],
          'nearbyOpportunities': [],
        },
      );

      final notifier = HomeDashboardNotifier(mockDs, authLocal, profileRepo);
      await notifier.loadDashboard('PROFESSIONAL');

      expect(notifier.state.role, 'PROFESSIONAL');
      expect(await authLocal.getSelectedRole(), 'PROFESSIONAL');
      expect(notifier.state.city, 'Bengaluru');
      expect(notifier.state.roleSpecialty, 'Cinematographer');
      expect(notifier.state.selectedCategories, contains('Tech'));

      await notifier.loadDashboard('PODCASTER');
      expect(notifier.state.role, 'PODCASTER');
      expect(await authLocal.getSelectedRole(), 'PODCASTER');
    });

    test('HomeDashboardNotifier offline fallback builds category-matched items and shows offline flag', () async {
      final authLocal = AuthLocalDataSource();
      await authLocal.saveSelectedRole('PODCASTER');

      final profileRepo = ProfileRepositoryImpl.instance;
      await profileRepo.saveBasicInfoDraft(
        const BasicInfoData(displayName: 'Meera', city: 'Delhi NCR'),
      );
      await profileRepo.savePodcastDetailsDraft(
        const PodcastDetailsData(
          showName: 'Founder Frequency',
          category: 'Tech',
        ),
      );

      final mockDs = _MockDashboardRemoteDataSource(shouldThrow: true);
      final notifier = HomeDashboardNotifier(mockDs, authLocal, profileRepo);
      await notifier.loadDashboard('PODCASTER');

      expect(notifier.state.isOfflineFallback, isTrue);
      expect(notifier.state.role, 'PODCASTER');
      expect(notifier.state.city, 'Delhi NCR');
      expect(notifier.state.roleSpecialty, 'Founder Frequency');
      expect(notifier.state.recommendedProfiles, isNotEmpty);
      expect(notifier.state.nearbyOpportunities, isNotEmpty);

      // Category filtering narrows and resets cleanly
      notifier.selectCategoryFilter('Tech');
      expect(notifier.state.activeCategoryFilter, 'Tech');
      expect(notifier.state.filteredOpportunities.length, 1);

      notifier.selectCategoryFilter(null);
      expect(notifier.state.activeCategoryFilter, isNull);
      expect(notifier.state.filteredOpportunities.length, 2);
    });

    testWidgets('D01CreatorHomeScreen adapts UI for CREATOR, filters by category chips, and preserves KPI labels', (tester) async {
      final profileRepo = ProfileRepositoryImpl.instance;
      await profileRepo.saveBasicInfoDraft(
        const BasicInfoData(displayName: 'Priya', city: 'Bengaluru'),
      );
      await profileRepo.saveCategorySelection(const [
        '018f0001-0000-7000-8000-000000000001', // Fashion & Lifestyle
        '018f0001-0000-7000-8000-000000000004', // Tech
      ]);

      final mockDs = _MockDashboardRemoteDataSource();
      String? appliedOppId;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            moduleDDataSourceProvider.overrideWithValue(mockDs),
          ],
          child: MaterialApp(
            home: D01CreatorHomeScreen(
              onNavigateToNotifications: () {},
              onNavigateToChat: () {},
              onOpenProfile: (_) {},
              onApplyOpportunity: (id) => appliedOppId = id,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Core header & KPI labels preserved
      expect(find.text('CreatorConnect'), findsOneWidget);
      expect(find.text('CREATOR'), findsOneWidget);
      expect(find.text('PROFILE VIEWS'), findsOneWidget);
      expect(find.text('AVG RATING'), findsOneWidget);
      expect(find.text('COLLAB CALLS'), findsOneWidget);
      expect(find.textContaining('Bengaluru'), findsAtLeastNWidgets(1));

      // Category filter bar renders user's categories and filters opportunities
      expect(find.text('Your Categories'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('AI Laptop Unboxing Series'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Summer Lookbook Reels Shoot'), findsOneWidget);
      expect(find.text('AI Laptop Unboxing Series'), findsOneWidget);

      await tester.drag(find.byType(CustomScrollView), const Offset(0, 900));
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(DashboardCategoryFilterBar),
          matching: find.text('Tech'),
        ),
      );
      await tester.pumpAndSettle();

      await tester.drag(find.byType(CustomScrollView), const Offset(0, -650));
      await tester.pumpAndSettle();
      expect(find.text('Summer Lookbook Reels Shoot'), findsNothing);
      expect(find.text('AI Laptop Unboxing Series'), findsOneWidget);

      await tester.drag(find.byType(CustomScrollView), const Offset(0, 900));
      await tester.pumpAndSettle();
      // Alert banner "View" button targets filtered opportunity
      await tester.tap(find.text('View'));
      expect(appliedOppId, 'opp-tech');
    });

    testWidgets('D01CreatorHomeScreen adapts headings for PRODUCTION PRO and PODCASTER categories', (tester) async {
      final authLocal = AuthLocalDataSource();
      await authLocal.saveSelectedRole('PROFESSIONAL');

      final profileRepo = ProfileRepositoryImpl.instance;
      await profileRepo.saveBasicInfoDraft(
        const BasicInfoData(displayName: 'Rohan', city: 'Pune'),
      );
      await profileRepo.saveProfessionalDetailsDraft(
        const ProfessionalDetailsData(professionalType: 'Video editor'),
      );

      final mockDs = _MockDashboardRemoteDataSource(shouldThrow: true);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            moduleDDataSourceProvider.overrideWithValue(mockDs),
          ],
          child: MaterialApp(
            home: Consumer(
              builder: (context, ref, _) {
                return D01CreatorHomeScreen(
                  onNavigateToNotifications: () {},
                  onNavigateToChat: () {},
                  onOpenProfile: (_) {},
                  onApplyOpportunity: (_) {},
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(OfflineBannerWidget), findsOneWidget);
      expect(find.text('PRODUCTION PRO'), findsOneWidget);
      expect(find.textContaining('Production Pro Workspace'), findsOneWidget);
      expect(find.text('Creators & Studios Hiring'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Production Gigs Near You'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Production Gigs Near You'), findsOneWidget);

      // Verify PODCASTER persona copy via switchRole
      final element = tester.element(find.byType(D01CreatorHomeScreen));
      final container = ProviderScope.containerOf(element);
      container.read(homeDashboardProvider.notifier).switchRole('PODCASTER');
      await tester.pumpAndSettle();

      await tester.drag(find.byType(CustomScrollView), const Offset(0, 350));
      await tester.pumpAndSettle();
      expect(find.text('PODCASTER'), findsOneWidget);
      expect(find.textContaining('Podcast Show Cockpit'), findsOneWidget);
      expect(find.text('Guest & Audio Matches'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Podcast Collabs & Guests Nearby'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Podcast Collabs & Guests Nearby'), findsOneWidget);
    });

    testWidgets('D02BrandHomeScreen renders real backend metrics, brief categories, and applicant callback', (tester) async {
      final authLocal = AuthLocalDataSource();
      await authLocal.saveSelectedRole('BRAND');

      final profileRepo = ProfileRepositoryImpl.instance;
      await profileRepo.saveCompanyDetailsDraft(
        const CompanyDetailsData(
          companyName: 'Verve Skincare',
          businessCategory: 'Fashion & Lifestyle',
          city: 'Mumbai MMR',
        ),
      );

      final mockDs = _MockDashboardRemoteDataSource(
        responseOverride: {
          'role': 'BRAND',
          'completionPercentage': 100,
          'greeting': 'Welcome back, Verve Skincare 👋',
          'stats': {
            'totalApplicants': 42,
            'activeBriefs': 3,
            'hiredCount': 7,
          },
          'campaignPipeline': [
            {
              'id': 'b-101',
              'title': 'Festive Glow Reels',
              'category': 'Fashion & Lifestyle',
              'appliedCount': 15,
              'maxApplicants': 30,
              'daysLeft': 5,
            },
          ],
          'activeCampaigns': [
            {
              'id': 'b-101',
              'title': 'Festive Glow Reels',
              'category': 'Fashion & Lifestyle',
              'appliedCount': 15,
              'maxApplicants': 30,
              'daysLeft': 5,
            },
          ],
          'featuredCreators': [
            {
              'id': 'cr-9',
              'name': 'Kavya Nair',
              'handle': '@kavyanair',
              'role': 'CREATOR',
              'niche': 'Fashion & Lifestyle',
              'city': 'Mumbai',
              'avatarUrl': '',
            },
          ],
        },
      );

      String? managedBriefId;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            moduleDDataSourceProvider.overrideWithValue(mockDs),
          ],
          child: MaterialApp(
            home: D02BrandHomeScreen(
              onNavigateToNotifications: () {},
              onNavigateToChat: () {},
              onOpenProfile: (_) {},
              onManageApplicants: (id) => managedBriefId = id,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('BRAND'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.text('APPLICANTS'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('ACTIVE BRIEFS'), findsOneWidget);
      expect(find.text('7'), findsOneWidget);
      expect(find.text('HIRED SO FAR'), findsOneWidget);

      await tester.drag(find.byType(CustomScrollView), const Offset(0, -450));
      await tester.pumpAndSettle();
      expect(find.text('Festive Glow Reels'), findsOneWidget);

      await tester.tap(find.text('Manage Applicants →'));
      expect(managedBriefId, 'b-101');
    });

    testWidgets('D03EmptyHomeScreen renders dynamic completion percentage and selected category chips', (tester) async {
      var pickCatCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: D03EmptyHomeScreen(
            completionPercentage: 65,
            roleKey: 'CREATOR',
            selectedCategories: const ['Tech', 'Gaming & Esports'],
            onContinueProfileSetup: () {},
            onExploreDiscovery: () {},
            onPickCategories: () => pickCatCalled = true,
          ),
        ),
      );

      expect(find.text('65%'), findsOneWidget);
      expect(find.text('Your profile is 65% complete'), findsOneWidget);
      expect(find.text('Tech'), findsOneWidget);
      expect(find.text('Gaming & Esports'), findsOneWidget);

      await tester.ensureVisible(find.text('Set Preferences'));
      await tester.tap(find.text('Set Preferences'));
      expect(pickCatCalled, isTrue);
    });

    testWidgets('ModuleDShellScreen falls back BRAND role to D01CreatorHomeScreen and shows Phase 1 FAB actions', (tester) async {
      FeatureFlags.resetToPhase1Defaults();
      final authLocal = AuthLocalDataSource();
      await authLocal.saveSelectedRole('BRAND');

      final mockDs = _MockDashboardRemoteDataSource(
        responseOverride: {
          'role': 'BRAND',
          'completionPercentage': 90,
          'greeting': 'Welcome 👋',
          'stats': {'profileViews': 10, 'rating': 4.9, 'openBriefsCount': 2},
          'recommendedProfiles': [],
          'nearbyOpportunities': [],
        },
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            moduleDDataSourceProvider.overrideWithValue(mockDs),
          ],
          child: const MaterialApp(
            home: ModuleDShellScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Brand dashboard is gated in Phase 1 -> cleanly renders Creator Home fallback
      expect(find.byType(D02BrandHomeScreen), findsNothing);
      expect(find.byType(D01CreatorHomeScreen), findsOneWidget);
      expect(find.text('COLLAB CALLS'), findsOneWidget);

      // Tap central '+' FAB -> shows Phase 1 creator-friendly actions only
      await tester.tap(find.byIcon(Icons.add_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Customize Content Categories & Skills'), findsOneWidget);
      expect(find.text('Upload to Media Vault / Portfolio'), findsOneWidget);
      expect(find.text('Start a Collaboration Chat'), findsOneWidget);
      expect(find.text('Post Collaboration Brief'), findsNothing);
    });
  });
}
