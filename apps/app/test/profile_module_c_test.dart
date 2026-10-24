import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:creatorconnect/features/auth/domain/entities/user_role.dart';
import 'package:creatorconnect/features/profile/domain/entities/profile_entities.dart';
import 'package:creatorconnect/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:creatorconnect/features/profile/data/repositories/profile_repository_impl.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c01_profile_completion_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c02_basic_information_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c03_category_and_skills_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c04_creator_details_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c05_professional_details_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c06_podcast_details_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c07_company_details_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c08_social_accounts_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c12_verification_centre_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c13_verification_request_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c14_verification_result_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c15_add_another_role_screen.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    ProfileRepositoryImpl.resetForTesting();
    final mockHttpClient = MockClient((request) async {
      if (request.url.path.contains('/discovery/categories')) {
        return http.Response(jsonEncode([
          {'id': 'cat-fashion', 'name': 'Fashion & Style', 'slug': 'fashion'},
          {'id': 'cat-lifestyle', 'name': 'Lifestyle', 'slug': 'lifestyle'},
        ]), 200);
      }
      if (request.url.path.contains('/discovery/skills')) {
        return http.Response(jsonEncode([
          {'id': 'sk-1', 'name': 'Photography', 'slug': 'photography'},
          {'id': 'sk-2', 'name': 'Video Editing', 'slug': 'video-editing'},
        ]), 200);
      }
      if (request.url.path.contains('/profiles/me')) {
        return http.Response(jsonEncode({
          'user': {'id': 'test-user', 'email': 'test@example.com'},
          'creator': null,
          'brand': null,
          'professional': null,
          'podcaster': null,
        }), 200);
      }
      if (request.url.path.contains('/profiles/verification/status')) {
        return http.Response(jsonEncode({
          'state': 'UNDER_REVIEW',
          'attemptsRemaining': 3,
        }), 200);
      }
      return http.Response(jsonEncode({'status': 'ok'}), 200);
    });
    final mockRemoteDs = ProfileRemoteDataSource(httpClient: mockHttpClient);
    ProfileRepositoryImpl.setMockInstanceForTesting(ProfileRepositoryImpl(remoteDataSource: mockRemoteDs));
  });

  group('Module C - Profile Repository & Domain Logic', () {
    test('Calculates Creator profile overview with Level 1 progression', () async {
      final repo = ProfileRepositoryImpl();
      // Fresh user starts with empty fields and 0%
      final initialOverview = await repo.getProfileOverview(role: UserRole.creator);
      expect(initialOverview.completionPercentage, 0);

      // Once user fills real data, completion increases
      await repo.updateBasicInfo(const BasicInfoData(
        displayName: 'Real Creator',
        bio: 'Tech and travel creator',
        city: 'Mumbai',
        languages: ['English'],
      ));
      final updatedOverview = await repo.getProfileOverview(role: UserRole.creator);
      expect(updatedOverview.completionPercentage, greaterThan(0));
      expect(updatedOverview.requiredSections.length, 3);
      expect(updatedOverview.requiredSections.any((s) => s.key == 'basicInfo'), isTrue);
      expect(updatedOverview.requiredSections.any((s) => s.key == 'categorySkills'), isTrue);
      expect(updatedOverview.requiredSections.any((s) => s.key == 'roleDetails'), isTrue);
      expect(updatedOverview.verificationSections.any((s) => s.key == 'socialAccounts'), isTrue);
      expect(updatedOverview.verificationSections.any((s) => s.key == 'verification'), isTrue);
    });

    test('Calculates Brand profile overview with Company Details and Verification', () async {
      final repo = ProfileRepositoryImpl();
      final overview = await repo.getProfileOverview(role: UserRole.brand);

      expect(overview.requiredSections.length, 1);
      expect(overview.requiredSections.first.key, 'companyDetails');
      expect(overview.verificationSections.any((s) => s.key == 'verification'), isTrue);
    });

    test('Connects and disconnects social platform accounts', () async {
      final repo = ProfileRepositoryImpl();
      final connected = await repo.connectSocialAccount('YouTube', 'anjana_films');

      expect(connected.platform, 'YouTube');
      expect(connected.status, SocialPlatformStatus.connected);

      final accounts = await repo.getSocialAccounts();
      final yt = accounts.firstWhere((a) => a.platform == 'YouTube');
      expect(yt.status, SocialPlatformStatus.connected);
      expect(yt.handle, 'anjana_films');

      await repo.disconnectSocialAccount('YouTube');
      final afterDisconnect = await repo.getSocialAccounts();
      final ytAfter = afterDisconnect.firstWhere((a) => a.platform == 'YouTube');
      expect(ytAfter.status, SocialPlatformStatus.notConnected);
    });

    test('Submits Creator verification request with one-time code in bio', () async {
      final repo = ProfileRepositoryImpl();
      await repo.submitCreatorVerification('Instagram', 'anjana.creates', 'CC-4F9K2');

      final vData = await repo.getVerificationData();
      expect(vData.state, VerificationState.underReview);
      expect(vData.submittedAccount, 'Instagram @anjana.creates');
      expect(vData.oneTimeCode, 'CC-4F9K2');
    });

    test('Submits Brand business document verification', () async {
      final repo = ProfileRepositoryImpl();
      await repo.submitBrandVerification(
        businessName: 'Studio Frame Co.',
        regNumber: '29ABCDE1234F1Z5',
        person: 'Anjana Rao',
        documents: ['GST_2026.pdf'],
      );

      final vData = await repo.getVerificationData();
      expect(vData.state, VerificationState.underReview);
      expect(vData.submittedAccount, 'Studio Frame Co.');
      expect(vData.brandDocumentNames.contains('GST_2026.pdf'), isTrue);
    });
  });

  group('Module C - Presentation Screens Render Tests', () {
    setUp(() {
      final binding = TestWidgetsFlutterBinding.ensureInitialized();
      binding.platformDispatcher.views.first.physicalSize = const Size(1080, 2400);
      binding.platformDispatcher.views.first.devicePixelRatio = 2.0;
    });

    tearDown(() {
      final binding = TestWidgetsFlutterBinding.ensureInitialized();
      binding.platformDispatcher.views.first.resetPhysicalSize();
      binding.platformDispatcher.views.first.resetDevicePixelRatio();
    });

    Widget buildTestScreen(Widget child) {
      return MaterialApp(
        home: child,
      );
    }

    testWidgets('C01 Profile Completion Screen renders overview and checklist', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C01ProfileCompletionScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Profile Setup'), findsOneWidget);
      expect(find.text('REQUIRED FOR LEVEL 1'), findsOneWidget);
      expect(find.text('Basic information'), findsWidgets);
      expect(find.text('Category and skills'), findsOneWidget);
      expect(find.text('Add another profile role'), findsOneWidget);
    });

    testWidgets('C02 Basic Information Screen renders form and bio counter', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C02BasicInformationScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Basic Information'), findsOneWidget);
      expect(find.text('Display name'), findsOneWidget);
      expect(find.text('Bio'), findsOneWidget);
      expect(find.text('Location & Creator Hub'), findsOneWidget);
      expect(find.text('Languages spoken'), findsOneWidget);
      expect(find.text('Save & continue'), findsOneWidget);
    });

    testWidgets('C03 Category and Skills Screen renders taxonomy options', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C03CategoryAndSkillsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Category & Skills'), findsOneWidget);
      expect(find.text('Primary Categories'), findsOneWidget);
      expect(find.text('Skills & Expertise'), findsOneWidget);
      expect(find.textContaining('Save ('), findsOneWidget);
    });

    testWidgets('C04 Creator Details Screen renders formats, rates & availability', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C04CreatorDetailsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Creator Details'), findsOneWidget);
      expect(find.text('Content Formats'), findsOneWidget);
      expect(find.text('Commercial Rates (INR ₹)'), findsOneWidget);
      expect(find.text('Collaboration Availability'), findsOneWidget);
      expect(find.text('Save details'), findsOneWidget);
    });

    testWidgets('C05 Professional Details Screen renders creative roles and tools', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C05ProfessionalDetailsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Professional Details'), findsOneWidget);
      expect(find.text('Creative Role'), findsOneWidget);
      expect(find.text('Industry Experience'), findsOneWidget);
      expect(find.text('Tools & Equipment'), findsOneWidget);
      expect(find.text('Save professional details'), findsOneWidget);
    });

    testWidgets('C06 Podcast Details Screen renders show name and frequency', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C06PodcastDetailsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Podcast Details'), findsOneWidget);
      expect(find.text('Show Name'), findsOneWidget);
      expect(find.text('Show Description'), findsOneWidget);
      expect(find.text('Episode Frequency'), findsOneWidget);
      expect(find.text('Save podcast details'), findsOneWidget);
    });

    testWidgets('C07 Company Details Screen renders brand details and team size', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C07CompanyDetailsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Company Details'), findsOneWidget);
      expect(find.text('Registered Company / Brand Name'), findsOneWidget);
      expect(find.text('Industry / Sector'), findsOneWidget);
      expect(find.text('Team Size'), findsOneWidget);
      expect(find.text('Official Website'), findsOneWidget);
      expect(find.text('Save company details'), findsOneWidget);
    });

    testWidgets('C08 Social Accounts Screen renders channels and badges', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C08SocialAccountsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Social Accounts'), findsOneWidget);
      expect(find.text('Connect your channels'), findsOneWidget);
      expect(find.text('Instagram'), findsOneWidget);
      expect(find.text('YouTube'), findsOneWidget);
      expect(find.text('LinkedIn'), findsOneWidget);
    });

    testWidgets('C12 Verification Centre renders Level 1 and Level 2 badges', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C12VerificationCentreScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Verification Centre'), findsOneWidget);
      expect(find.text('TRUST LEVELS'), findsOneWidget);
      expect(find.text('Level 1'), findsOneWidget);
      expect(find.text('Level 2'), findsOneWidget);
      expect(find.text('WHY GET VERIFIED?'), findsOneWidget);
    });

    testWidgets('C13 Verification Request renders code copy button', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C13VerificationRequestScreen(isBrand: false)));
      await tester.pumpAndSettle();

      expect(find.text('Creator Verification'), findsOneWidget);
      expect(find.textContaining('Verify via'), findsOneWidget);
      expect(find.textContaining('CC-'), findsWidgets);
      expect(find.text('Copy verification code'), findsOneWidget);
      expect(find.text("I've added the code, verify now"), findsOneWidget);
    });

    testWidgets('C14 Verification Result renders review state card', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C14VerificationResultScreen(
        data: VerificationData(
          state: VerificationState.underReview,
          submittedAccount: 'Instagram @anjana.creates',
        ),
      )));
      await tester.pumpAndSettle();

      expect(find.text('Verification Status'), findsOneWidget);
      expect(find.text('Under Review'), findsOneWidget);
      expect(find.text('Return to Profile Setup'), findsOneWidget);
    });

    testWidgets('C15 Add Another Role Screen renders all 4 roles', (tester) async {
      await tester.pumpWidget(buildTestScreen(const C15AddAnotherRoleScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Add Another Role'), findsOneWidget);
      expect(find.text('Multi-Role Account'), findsOneWidget);
      expect(find.text('Creator / Influencer'), findsOneWidget);
      expect(find.text('Production Professional'), findsOneWidget);
      expect(find.text('Podcaster'), findsOneWidget);
      expect(find.text('Brand'), findsOneWidget);
    });
  });
}
