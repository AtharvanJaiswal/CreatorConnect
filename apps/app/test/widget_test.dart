import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:creatorconnect/main.dart';
import 'package:creatorconnect/core/widgets/step_indicator.dart';
import 'package:creatorconnect/features/auth/domain/entities/user_role.dart';
import 'package:creatorconnect/features/auth/domain/repositories/auth_repository.dart';
import 'package:creatorconnect/features/auth/presentation/screens/splash_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/onboarding_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/account_type_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/login_screen.dart';

class FakeSplashAuthRepository implements AuthRepository {
  final bool _isAuth;
  final bool _hasCompletedOnboarding;

  FakeSplashAuthRepository({
    bool isAuthenticated = false,
    bool hasCompletedOnboarding = false,
  })  : _isAuth = isAuthenticated,
        _hasCompletedOnboarding = hasCompletedOnboarding;

  @override
  bool get isAuthenticated => _isAuth;

  @override
  Future<bool> hasCompletedOnboarding() async => _hasCompletedOnboarding;

  @override
  Future<void> setOnboardingCompleted({bool completed = true}) async {}

  @override
  Future<void> clearOnboarding() async {}

  @override
  Future<void> sendPhoneOtp(String fullPhoneNumber) async {}

  @override
  Future<AuthResponse> verifyPhoneOtp({
    required String fullPhoneNumber,
    required String token,
    required UserRole selectedRole,
  }) async =>
      AuthResponse();

  @override
  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    required UserRole selectedRole,
  }) async =>
      AuthResponse();

  @override
  Future<bool> signInWithGoogle() async => true;

  @override
  Future<AuthResponse> signInWithPassword({
    required String emailOrPhone,
    required String password,
  }) async =>
      AuthResponse();

  @override
  Future<void> sendPasswordResetEmail(String email) async {}

  @override
  Future<UserResponse> updatePassword(String newPassword) async =>
      UserResponse.fromJson({'id': '123', 'aud': 'authenticated'});

  @override
  Future<void> signOut() async {}
}

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  group('Onboarding & Splash Screens Tests', () {
    testWidgets('SCR-01 Splash screen renders brand mark, title, and tagline for new user', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(const CreatorConnectApp());
      await tester.pump(const Duration(milliseconds: 300));

      // Verify Brand elements on Splash screen
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('CreatorConnect'), findsOneWidget);
      expect(find.text('create together'), findsOneWidget);

      // Verify tap on splash screen navigates to OnboardingScreen for first-time user
      await tester.tap(find.byType(SplashScreen));
      await tester.pumpAndSettle();

      expect(find.byType(OnboardingScreen), findsOneWidget);
    });

    testWidgets('Splash bypasses onboarding and navigates to LoginScreen if user already seen onboarding', (
      WidgetTester tester,
    ) async {
      final fakeRepo = FakeSplashAuthRepository(
        isAuthenticated: false,
        hasCompletedOnboarding: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          routes: {
            '/login': (context) => const LoginScreen(),
          },
          home: SplashScreen(authRepository: fakeRepo),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      // Tap splash screen
      await tester.tap(find.byType(SplashScreen));
      await tester.pumpAndSettle();

      // Should direct to LoginScreen, NOT OnboardingScreen
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(OnboardingScreen), findsNothing);
    });

    testWidgets('Splash bypasses onboarding and navigates to /home if user is already logged in', (
      WidgetTester tester,
    ) async {
      final fakeRepo = FakeSplashAuthRepository(
        isAuthenticated: true,
        hasCompletedOnboarding: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          routes: {
            '/home': (context) => const Scaffold(body: Text('Active Session Home')),
          },
          home: SplashScreen(authRepository: fakeRepo),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      // Tap splash screen
      await tester.tap(find.byType(SplashScreen));
      await tester.pumpAndSettle();

      // Should direct straight to Home, bypassing onboarding and login
      expect(find.text('Active Session Home'), findsOneWidget);
      expect(find.byType(OnboardingScreen), findsNothing);
      expect(find.byType(LoginScreen), findsNothing);
    });

    testWidgets('SCR-02 Onboarding 1 (Value) renders exact copy, cards, and indicators', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: OnboardingScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Verify SCR-02 copy
      expect(find.textContaining('Create.'), findsOneWidget);
      expect(find.textContaining('Connect.'), findsOneWidget);
      expect(find.textContaining('Collaborate.'), findsOneWidget);
      expect(
        find.text(
          'One platform where creators, professionals, podcasters and brands build together.',
        ),
        findsOneWidget,
      );

      // Verify top Skip button
      expect(find.text('Skip'), findsOneWidget);

      // Verify Next button
      expect(find.text('Next'), findsOneWidget);

      // Verify step indicator
      expect(find.byType(StepIndicator), findsOneWidget);
    });

    testWidgets('SCR-03 Onboarding 2 (Discovery) advances and renders copy and badges', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: OnboardingScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Next to advance to slide 2
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();

      // Verify SCR-03 copy
      expect(find.textContaining('Discover'), findsOneWidget);
      expect(find.textContaining('collaborators'), findsOneWidget);

      // Verify "Find your people" badge
      expect(find.text('Find your people'), findsOneWidget);

      // Advance to slide 3 (Opportunity)
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();

      // Verify SCR-04 copy and Get Started CTA
      expect(find.textContaining('Find work.'), findsOneWidget);
      expect(find.textContaining('Get hired.'), findsOneWidget);
      expect(find.text('Get Started'), findsOneWidget);
    });

    testWidgets('Skip button navigates directly to Account Type Selection', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: OnboardingScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Skip
      await tester.tap(find.text('Skip'));
      await tester.pumpAndSettle();

      // Per Page 11 spec: "Skip / Get Started -> Account Type Selection"
      expect(find.byType(AccountTypeScreen), findsOneWidget);
    });
  });
}
