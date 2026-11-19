import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:creatorconnect/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:creatorconnect/features/auth/domain/entities/user_role.dart';
import 'package:creatorconnect/features/profile/data/datasources/profile_local_datasource.dart';
import 'package:creatorconnect/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:creatorconnect/features/profile/data/repositories/profile_repository_impl.dart';
import 'package:creatorconnect/features/profile/domain/entities/profile_entities.dart';
import 'package:creatorconnect/features/profile/domain/entities/taxonomy_data.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c02_basic_information_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c03_category_and_skills_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c05_professional_details_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c06_podcast_details_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c07_company_details_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c14_verification_result_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/user_profile_screen.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    ProfileRepositoryImpl.resetForTesting();
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1080, 2400);
    binding.platformDispatcher.views.first.devicePixelRatio = 2.0;
  });

  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  ProfileRepositoryImpl buildFailingRemoteRepo() {
    final failingHttp = MockClient((request) async {
      return http.Response(
        jsonEncode({'error': 'Database pooler unavailable'}),
        500,
      );
    });
    return ProfileRepositoryImpl(
      remoteDataSource: ProfileRemoteDataSource(httpClient: failingHttp),
    );
  }

  group('Module C Regression Fixes', () {
    test('Remote taxonomy falls back to canonical categories & skills on HTTP 500', () async {
      final repo = buildFailingRemoteRepo();
      final categories = await repo.getCategories();
      final skills = await repo.getSkills();

      expect(categories.length, 8);
      expect(categories.first.name, 'Fashion & Lifestyle');
      expect(categories.first.subcategories, isNotEmpty);
      expect(skills.length, 8);
      expect(skills.any((s) => s.name == 'Video Editing'), isTrue);
    });

    test('Local-first writes succeed and persist even when remote API returns 500', () async {
      final failingRepo = buildFailingRemoteRepo();
      ProfileRepositoryImpl.setMockInstanceForTesting(failingRepo);

      await failingRepo.updateBasicInfo(const BasicInfoData(
        displayName: 'Anjana Creates',
        bio: 'Short-form filmmaker',
        city: 'Mumbai',
        hubName: 'Andheri West',
        languages: ['English', 'Hindi'],
      ));

      await failingRepo.updateUserSkills(
        const [
          UserSkillSelection(
            skillId: '018f0002-0000-7000-8000-000000000001',
            name: 'Video Editing',
            proficiency: SkillProficiencyLevel.expert,
          ),
        ],
        const ['018f0001-0000-7000-8000-000000000001'],
      );

      await failingRepo.updateCreatorDetails(const CreatorDetailsData(
        contentTypes: ['Reels / Shorts'],
        minRate: 12000,
        rateUnit: RateUnit.perPost,
        availability: AvailabilityStatus.availableNow,
      ));

      await failingRepo.connectSocialAccount('YouTube', '@anjanacuts');
      await failingRepo.submitCreatorVerification('YouTube', 'anjanacuts', 'CC-42424');
      await failingRepo.addSecondaryRole(UserRole.professional);

      final resolvedRole = await failingRepo.resolveActiveRole();
      expect(resolvedRole, UserRole.professional);

      final ver = await failingRepo.getVerificationData();
      expect(ver.state, VerificationState.underReview);
      expect(ver.submittedAccount, 'YouTube @anjanacuts');

      // Re-instantiate repository with failing HTTP client to verify disk persistence
      final reloadedRepo = buildFailingRemoteRepo();
      final loadedBasic = await reloadedRepo.getBasicInfo();
      final loadedSocials = await reloadedRepo.getSocialAccounts();
      expect(loadedBasic.displayName, 'Anjana Creates');
      expect(loadedBasic.city, 'Mumbai');
      expect(
        loadedSocials.firstWhere((s) => s.platform == 'YouTube').handle,
        'anjanacuts',
      );
    });

    testWidgets('Brand UserProfileScreen renders Company Details without ParentData crash', (tester) async {
      await AuthLocalDataSource().saveSelectedRole('BRAND');
      final repo = buildFailingRemoteRepo();
      ProfileRepositoryImpl.setMockInstanceForTesting(repo);
      await repo.updateCompanyDetails(const CompanyDetailsData(
        companyName: 'Acme Apparel',
        description: 'Direct-to-consumer streetwear brand',
        businessCategory: 'D2C & Retail',
        city: 'Bengaluru',
        teamSize: '11-50',
        websiteUrl: 'https://acmeapparel.in',
      ));

      await tester.pumpWidget(const MaterialApp(home: UserProfileScreen()));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Company Details'), findsOneWidget);
      expect(find.text('Acme Apparel'), findsOneWidget);
      expect(find.text('D2C & Retail'), findsOneWidget);
      expect(find.text('https://acmeapparel.in'), findsOneWidget);
    });

    testWidgets('C02 does not lock city pickup when saving without a city selected', (tester) async {
      final repo = buildFailingRemoteRepo();
      ProfileRepositoryImpl.setMockInstanceForTesting(repo);
      await repo.saveBasicInfoDraft(const BasicInfoData(
        displayName: 'New Creator',
        bio: 'Testing empty city cooldown',
        city: '',
        languages: ['English'],
      ));

      await tester.pumpWidget(MaterialApp(home: C02BasicInformationScreen(repository: repo)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Save & continue'));
      await tester.pumpAndSettle();

      final saved = await ProfileLocalDataSource().getBasicInfo();
      expect(saved?.city ?? '', isEmpty);
      expect(saved?.cityLastChangedAt, isNull);
    });

    testWidgets('C03 shows search bar, 0 of 10 limit badge, and fallback taxonomy', (tester) async {
      final repo = buildFailingRemoteRepo();
      await tester.pumpWidget(MaterialApp(home: C03CategoryAndSkillsScreen(repository: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Fashion & Lifestyle'), findsOneWidget);
      expect(find.text('0 of 10'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Search skills'), findsOneWidget);
      expect(find.text('Subcategories'), findsOneWidget);
    });

    testWidgets('C05, C06, C07 safely ignore out-of-list dropdown values and show C05 portfolio card', (tester) async {
      final repo = buildFailingRemoteRepo();
      await repo.updateProfessionalDetails(const ProfessionalDetailsData(
        professionalType: 'Custom Unlisted Role',
        experience: 'Custom Tier',
        tools: ['DaVinci Resolve'],
        minRate: 5000,
      ));
      await repo.updatePodcastDetails(const PodcastDetailsData(
        showName: 'Tech Talk',
        category: 'Unlisted Genre',
        description: 'Weekly creator interviews',
        platformLinks: ['https://open.spotify.com/show/abc'],
      ));
      await repo.updateCompanyDetails(const CompanyDetailsData(
        companyName: 'Studio Test',
        description: 'Creative agency',
        businessCategory: 'Unlisted Industry',
        city: 'Delhi NCR',
        teamSize: '1-10',
        websiteUrl: 'https://studiotest.in',
      ));

      await tester.pumpWidget(MaterialApp(home: C05ProfessionalDetailsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Portfolio sample'), findsOneWidget);

      await tester.pumpWidget(MaterialApp(home: C06PodcastDetailsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(MaterialApp(home: C07CompanyDetailsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('C14 changesNeeded state displays Fix and resubmit button', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: C14VerificationResultScreen(
            data: VerificationData(
              state: VerificationState.changesNeeded,
              feedbackReason: 'Bio code missing at crawl time',
              attemptsRemaining: 2,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Changes Requested'), findsOneWidget);
      expect(find.text('Fix and resubmit'), findsOneWidget);
      expect(find.text('Return to Profile Setup'), findsOneWidget);
    });
  });
}

