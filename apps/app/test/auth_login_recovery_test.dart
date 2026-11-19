import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:creatorconnect/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:creatorconnect/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:creatorconnect/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:creatorconnect/features/auth/domain/entities/user_role.dart';
import 'package:creatorconnect/features/auth/domain/repositories/auth_repository.dart';
import 'package:creatorconnect/features/auth/presentation/screens/login_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/reset_password_screen.dart';
import 'package:creatorconnect/features/auth/presentation/bottom_sheets/account_exists_sheet.dart';
import 'package:creatorconnect/features/auth/presentation/dialogs/session_expired_dialog.dart';
import 'package:creatorconnect/core/widgets/app_button.dart';

class MockLoginAuthRepository implements AuthRepository {
  bool loginCalled = false;
  bool shouldFailLogin = false;
  bool resetEmailCalled = false;
  bool updatePasswordCalled = false;

  @override
  Future<void> sendPhoneOtp(String fullPhoneNumber) async {}

  @override
  Future<AuthResponse> verifyPhoneOtp({
    required String fullPhoneNumber,
    required String token,
    required UserRole selectedRole,
  }) async {
    return AuthResponse();
  }

  @override
  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    required UserRole selectedRole,
  }) async {
    return AuthResponse();
  }

  @override
  Future<bool> signInWithGoogle() async => true;

  @override
  Future<AuthResponse> signInWithPassword({
    required String emailOrPhone,
    required String password,
  }) async {
    loginCalled = true;
    if (shouldFailLogin) {
      throw 'Invalid login credentials';
    }
    return AuthResponse(
      session: Session(
        accessToken: 'mock_login_token',
        tokenType: 'bearer',
        user: const User(
          id: 'user_login_123',
          appMetadata: {},
          userMetadata: {},
          aud: 'authenticated',
          createdAt: '2026-10-19T00:00:00Z',
        ),
      ),
    );
  }

  @override
  Future<void> sendPasswordResetEmail(String email) async {
    resetEmailCalled = true;
  }

  @override
  Future<UserResponse> updatePassword(String newPassword) async {
    updatePasswordCalled = true;
    return UserResponse.fromJson({
      'id': 'user_123',
      'aud': 'authenticated',
      'created_at': '2026-10-19T00:00:00Z',
      'app_metadata': {},
      'user_metadata': {},
    });
  }

  @override
  Future<void> signOut() async {}

  @override
  bool get isAuthenticated => false;

  @override
  Future<bool> hasCompletedOnboarding() async => false;

  @override
  Future<void> setOnboardingCompleted({bool completed = true}) async {}

  @override
  Future<void> clearOnboarding() async {}
}


void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('SCR-11: Login Screen Tests', () {
    testWidgets('Renders Login Screen elements and handles inline credentials error', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final mockRepo = MockLoginAuthRepository()..shouldFailLogin = true;

      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(authRepository: mockRepo),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Welcome back'), findsOneWidget);
      expect(find.text('Log in to continue to CreatorPeep.'), findsOneWidget);
      expect(find.text('EMAIL OR MOBILE'), findsOneWidget);
      expect(find.text('PASSWORD'), findsOneWidget);
      expect(find.text('Forgot password?'), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.textContaining("Don't have an account?"), findsOneWidget);

      final textFields = find.byType(TextField);
      expect(textFields, findsNWidgets(2));

      // Type email and wrong password
      await tester.enterText(textFields.at(0), 'alex@creator.dev');
      await tester.enterText(textFields.at(1), 'WrongPassword123');
      await tester.pump();

      // Tap Log In
      final loginBtn = find.widgetWithText(AppButton, 'Log In');
      expect(loginBtn, findsOneWidget);
      await tester.tap(loginBtn);
      await tester.pump();

      // Verifies inline error appears without popping system alert
      expect(
        find.text("That password isn't right. Try again or reset it."),
        findsOneWidget,
      );
      expect(mockRepo.loginCalled, isTrue);
    });

    testWidgets('Toggles password visibility on Login Screen', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(home: LoginScreen()),
      );
      await tester.pump(const Duration(milliseconds: 300));

      final eyeIconFinder = find.byIcon(Icons.visibility_off_outlined);
      expect(eyeIconFinder, findsOneWidget);

      await tester.tap(eyeIconFinder);
      await tester.pump();

      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
    });

    testWidgets('Successful login navigates to /home', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final mockRepo = MockLoginAuthRepository()..shouldFailLogin = false;

      await tester.pumpWidget(
        MaterialApp(
          routes: {
            '/home': (context) => const Scaffold(body: Text('Home Dashboard Screen')),
          },
          home: LoginScreen(authRepository: mockRepo),
        ),
      );
      await tester.pumpAndSettle();

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'alex@creator.dev');
      await tester.enterText(textFields.at(1), 'ValidPassword123!');
      await tester.pump();

      final loginBtn = find.widgetWithText(AppButton, 'Log In');
      await tester.tap(loginBtn);
      await tester.pumpAndSettle();

      expect(find.text('Home Dashboard Screen'), findsOneWidget);
    });
  });

  group('SCR-12: Forgot Password Screen Tests', () {
    testWidgets('Validates email and triggers reset link submission', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final mockRepo = MockLoginAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          home: ForgotPasswordScreen(
            initialEmail: '',
            authRepository: mockRepo,
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.textContaining('Forgot your'), findsOneWidget);
      expect(find.text('Send Reset Link'), findsOneWidget);
      expect(find.text('Back to Login'), findsOneWidget);

      final emailField = find.byType(TextField);
      await tester.enterText(emailField, 'recovery@creator.dev');
      await tester.pump();

      final sendBtn = find.widgetWithText(AppButton, 'Send Reset Link');
      await tester.tap(sendBtn);
      await tester.pump();

      expect(mockRepo.resetEmailCalled, isTrue);
      expect(find.text('Reset Link Sent'), findsOneWidget);
      expect(find.text('Enter New Password'), findsOneWidget);
    });
  });

  group('SCR-13: Reset Password Screen Tests', () {
    testWidgets('Live password checklist ticks and validates match before submission', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final mockRepo = MockLoginAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          home: ResetPasswordScreen(authRepository: mockRepo),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.textContaining('Create new'), findsOneWidget);
      expect(find.text('At least 8 characters'), findsOneWidget);
      expect(find.text('Contains a number'), findsOneWidget);
      expect(find.text('Contains a special character'), findsOneWidget);

      final textFields = find.byType(TextField);
      expect(textFields, findsNWidgets(2));

      // Enter strong password
      await tester.enterText(textFields.at(0), 'Secret99!');
      await tester.pump();

      expect(find.text('Strong password'), findsOneWidget);

      // Enter mismatching confirm password
      await tester.enterText(textFields.at(1), 'DifferentPassword');
      await tester.pump();
      expect(find.text('Passwords do not match'), findsOneWidget);

      // Enter matching confirm password
      await tester.enterText(textFields.at(1), 'Secret99!');
      await tester.pump();
      expect(find.text('Passwords match'), findsOneWidget);

      final resetBtn = find.widgetWithText(AppButton, 'Reset Password');
      await tester.tap(resetBtn);
      await tester.pump();

      expect(mockRepo.updatePasswordCalled, isTrue);
    });
  });

  group('SCR-14 & SCR-15: System States Tests', () {
    testWidgets('SCR-14: Account Exists Sheet renders actions and modal elements', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      bool loginTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => Center(
                child: ElevatedButton(
                  onPressed: () {
                    AccountExistsSheet.show(
                      context,
                      onLogin: () => loginTapped = true,
                      onUseDifferentDetails: () {},
                    );
                  },
                  child: const Text('Show Sheet'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text('Show Sheet'));
      await tester.pumpAndSettle();

      expect(find.textContaining('This account already'), findsOneWidget);
      expect(
        find.text('An account is already registered with these details. Please log in instead.'),
        findsOneWidget,
      );
      expect(find.widgetWithText(AppButton, 'Go to Login'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Use Different Details'), findsOneWidget);

      await tester.tap(find.widgetWithText(AppButton, 'Go to Login'));
      await tester.pumpAndSettle();
      expect(loginTapped, isTrue);
    });

    testWidgets('SCR-15: Session Expired Dialog renders security badge and Log In action', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      bool loginCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => Center(
                child: ElevatedButton(
                  onPressed: () {
                    SessionExpiredDialog.show(
                      context,
                      onLogin: () => loginCalled = true,
                    );
                  },
                  child: const Text('Show Dialog'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text('Show Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('Session expired'), findsOneWidget);
      expect(find.text('For your security, please log in again.'), findsOneWidget);
      expect(find.byIcon(Icons.lock_clock_rounded), findsOneWidget);

      final loginBtn = find.widgetWithText(AppButton, 'Log In');
      expect(loginBtn, findsOneWidget);
      await tester.tap(loginBtn);
      await tester.pumpAndSettle();
      expect(loginCalled, isTrue);
    });
  });

  group('Login Backend Sync Resilience & Home Redirect Regression Tests', () {
    AuthResponse buildMockAuthResponse({String role = 'BRAND'}) {
      final user = User(
        id: 'user_resilience_1',
        appMetadata: const {},
        userMetadata: {'role': role},
        aud: 'authenticated',
        createdAt: '2026-10-19T00:00:00Z',
      );
      return AuthResponse(
        user: user,
        session: Session(
          accessToken: 'mock_supabase_jwt',
          tokenType: 'bearer',
          user: user,
        ),
      );
    }

    testWidgets('LoginScreen redirects to /home when /auth/sync fails with HTTP 500', (
      WidgetTester tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final failingSyncRemote = _FakeSupabaseAuthRemoteDataSource(
        httpClient: MockClient((_) async => http.Response('{"error":"db down"}', 500)),
        authResponse: buildMockAuthResponse(role: 'BRAND'),
      );
      final repo = AuthRepositoryImpl(
        dataSource: failingSyncRemote,
        localDataSource: AuthLocalDataSource(),
      );

      await tester.pumpWidget(
        MaterialApp(
          routes: {
            '/home': (_) => const Scaffold(body: Text('Home Dashboard Screen')),
          },
          home: LoginScreen(authRepository: repo),
        ),
      );
      await tester.pumpAndSettle();

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'brand@creatorconnect.in');
      await tester.enterText(textFields.at(1), 'Secret123!');
      await tester.pump();

      await tester.tap(find.widgetWithText(AppButton, 'Log In'));
      await tester.pumpAndSettle();

      expect(find.text('Home Dashboard Screen'), findsOneWidget);
      expect(await AuthLocalDataSource().getSelectedRole(), 'BRAND');
    });

    test('AuthRepositoryImpl times out hung /auth/sync quickly and still resolves login', () async {
      SharedPreferences.setMockInitialValues({});
      final stalledRemote = _FakeSupabaseAuthRemoteDataSource(
        httpClient: MockClient((_) async {
          await Future<void>.delayed(const Duration(seconds: 6));
          return http.Response(jsonEncode({'user': {'roles': ['CREATOR']}}), 200);
        }),
        authResponse: buildMockAuthResponse(role: 'PODCASTER'),
      );
      final repo = AuthRepositoryImpl(
        dataSource: stalledRemote,
        localDataSource: AuthLocalDataSource(),
      );

      final sw = Stopwatch()..start();
      final res = await repo.signInWithPassword(
        emailOrPhone: 'podcaster@creatorconnect.in',
        password: 'Secret123!',
      );
      sw.stop();

      expect(res.session?.accessToken, 'mock_supabase_jwt');
      expect(sw.elapsedMilliseconds, lessThan(4500));
      expect(await AuthLocalDataSource().getSelectedRole(), 'PODCASTER');
    });

    test('AuthRepositoryImpl rethrows IdentityConflictException on HTTP 409', () async {
      SharedPreferences.setMockInitialValues({});
      final conflictRemote = _FakeSupabaseAuthRemoteDataSource(
        httpClient: MockClient((_) async => http.Response('{"error":"conflict"}', 409)),
        authResponse: buildMockAuthResponse(role: 'CREATOR'),
      );
      final repo = AuthRepositoryImpl(
        dataSource: conflictRemote,
        localDataSource: AuthLocalDataSource(),
      );

      expect(
        () => repo.signInWithPassword(
          emailOrPhone: 'conflict@creatorconnect.in',
          password: 'Secret123!',
        ),
        throwsA(isA<IdentityConflictException>()),
      );
    });
  });
}

class _FakeSupabaseAuthRemoteDataSource extends AuthRemoteDataSource {
  final AuthResponse _authResponse;

  _FakeSupabaseAuthRemoteDataSource({
    required super.httpClient,
    required AuthResponse authResponse,
  }) : _authResponse = authResponse;

  @override
  Future<AuthResponse> signInWithPassword({
    required String emailOrPhone,
    required String password,
  }) async {
    return _authResponse;
  }
}
