import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:creatorconnect/features/auth/domain/entities/user_role.dart';
import 'package:creatorconnect/features/auth/domain/repositories/auth_repository.dart';
import 'package:creatorconnect/features/auth/presentation/screens/account_type_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/mobile_register_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/otp_verification_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/email_register_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/email_sent_screen.dart';
import 'package:creatorconnect/features/auth/presentation/screens/google_auth_screen.dart';
import 'package:creatorconnect/core/widgets/role_card.dart';
import 'package:creatorconnect/core/widgets/app_button.dart';

class MockAuthRepository implements AuthRepository {
  bool otpSent = false;
  bool otpVerified = false;
  bool emailSignedUp = false;
  bool shouldFailOtp = false;

  @override
  Future<void> sendPhoneOtp(String fullPhoneNumber) async {
    otpSent = true;
  }

  @override
  Future<AuthResponse> verifyPhoneOtp({
    required String fullPhoneNumber,
    required String token,
    required UserRole selectedRole,
  }) async {
    if (shouldFailOtp) {
      throw 'Invalid verification code';
    }
    otpVerified = true;
    return AuthResponse(
      session: Session(
        accessToken: 'mock_jwt_token',
        tokenType: 'bearer',
        user: const User(
          id: 'user_123',
          appMetadata: {},
          userMetadata: {},
          aud: 'authenticated',
          createdAt: '2026-10-19T00:00:00Z',
        ),
      ),
    );
  }

  @override
  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    required UserRole selectedRole,
  }) async {
    emailSignedUp = true;
    return AuthResponse(
      user: const User(
        id: 'user_email_123',
        appMetadata: {},
        userMetadata: {},
        aud: 'authenticated',
        createdAt: '2026-10-19T00:00:00Z',
      ),
    );
  }

  @override
  Future<bool> signInWithGoogle() async {
    return true;
  }

  @override
  Future<AuthResponse> signInWithPassword({
    required String emailOrPhone,
    required String password,
  }) async {
    return AuthResponse(
      session: Session(
        accessToken: 'mock_jwt_token',
        tokenType: 'bearer',
        user: const User(
          id: 'user_123',
          appMetadata: {},
          userMetadata: {},
          aud: 'authenticated',
          createdAt: '2026-10-19T00:00:00Z',
        ),
      ),
    );
  }

  @override
  Future<void> sendPasswordResetEmail(String email) async {}

  @override
  Future<UserResponse> updatePassword(String newPassword) async {
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

  group('SCR-05: Account Type Selection Tests', () {
    testWidgets('Renders all 4 roles and enables Continue on selection', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(home: AccountTypeScreen()),
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.textContaining('How will you'), findsOneWidget);
      expect(find.byType(RoleCard), findsNWidgets(4));

      // Role titles
      expect(find.text('Creator / Influencer'), findsOneWidget);
      expect(find.text('Production Professional'), findsOneWidget);
      expect(find.text('Podcaster'), findsOneWidget);
      expect(find.text('Brand'), findsOneWidget);

      // Continue starts disabled
      final continueBtnFinder = find.widgetWithText(AppButton, 'Continue');
      expect(continueBtnFinder, findsOneWidget);
      final initialButton = tester.widget<AppButton>(continueBtnFinder);
      expect(initialButton.onPressed, isNull);

      // Select Creator role
      await tester.tap(find.text('Creator / Influencer'));
      await tester.pumpAndSettle();

      final activeBtn = tester.widget<AppButton>(continueBtnFinder);
      expect(activeBtn.onPressed, isNotNull);

      // Tap Continue
      await tester.tap(continueBtnFinder);
      await tester.pumpAndSettle();

      expect(find.byType(MobileRegisterScreen), findsOneWidget);
    });
  });

  group('SCR-06: Mobile Registration Tests', () {
    testWidgets('Validates 10-digit input and navigates to OTP on Send OTP', (
      WidgetTester tester,
    ) async {
      final mockRepo = MockAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          home: MobileRegisterScreen(
            selectedRole: UserRole.creator,
            authRepository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Create your'), findsOneWidget);
      expect(find.text('+91'), findsOneWidget);
      expect(find.text('Send OTP'), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.text('Continue with Email'), findsOneWidget);

      // Tap Send OTP with empty field -> triggers validation error
      await tester.tap(find.text('Send OTP'));
      await tester.pumpAndSettle();
      expect(
        find.text('Please enter a valid 10-digit mobile number'),
        findsOneWidget,
      );

      // Enter valid 10-digit number
      await tester.enterText(find.byType(TextField).first, '9876543210');
      await tester.pumpAndSettle();

      // Tap Send OTP
      await tester.tap(find.text('Send OTP'));
      await tester.pumpAndSettle();

      expect(mockRepo.otpSent, isTrue);
      expect(find.byType(OtpVerificationScreen), findsOneWidget);
    });
  });

  group('SCR-07: OTP Verification Tests', () {
    testWidgets('Renders OTP screen with attempts, resend cooldown, and handles success', (
      WidgetTester tester,
    ) async {
      final mockRepo = MockAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          home: OtpVerificationScreen(
            fullPhoneNumber: '+919876543210',
            displayPhone: '+91 98765 43210',
            selectedRole: UserRole.creator,
            authRepository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Verify your'), findsOneWidget);
      expect(find.textContaining('+91 98765 43210'), findsOneWidget);
      expect(find.text('Change'), findsOneWidget);
      expect(find.textContaining('Resend code in 00:'), findsOneWidget);
    });

    testWidgets('Shows attempt counter when verification fails (SCR-07b)', (
      WidgetTester tester,
    ) async {
      final mockRepo = MockAuthRepository()..shouldFailOtp = true;

      await tester.pumpWidget(
        MaterialApp(
          home: OtpVerificationScreen(
            fullPhoneNumber: '+919876543210',
            displayPhone: '+91 98765 43210',
            selectedRole: UserRole.creator,
            authRepository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Fill in 6 digits into the text fields
      final textFields = find.byType(TextField);
      expect(textFields, findsNWidgets(6));

      for (int i = 0; i < 6; i++) {
        await tester.enterText(textFields.at(i), '1');
      }
      await tester.pumpAndSettle();

      // Verify SCR-07b error state
      expect(find.textContaining('2 attempts remaining'), findsOneWidget);
    });

    testWidgets('Entering 6-digit OTP verifies and navigates to /home on Go to Dashboard', (
      WidgetTester tester,
    ) async {
      final mockRepo = MockAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          routes: {
            '/home': (context) => const Scaffold(body: Text('Verified Home Screen')),
          },
          home: OtpVerificationScreen(
            fullPhoneNumber: '+919876543210',
            displayPhone: '+91 98765 43210',
            selectedRole: UserRole.brand,
            authRepository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final textFields = find.byType(TextField);
      for (int i = 0; i < 6; i++) {
        await tester.enterText(textFields.at(i), '${i + 1}');
      }
      await tester.pumpAndSettle();

      expect(find.text('Verified Successfully!'), findsOneWidget);
      expect(find.textContaining('Brand'), findsOneWidget);

      await tester.tap(find.widgetWithText(AppButton, 'Go to Dashboard'));
      await tester.pumpAndSettle();

      expect(find.text('Verified Home Screen'), findsOneWidget);
    });
  });

  group('SCR-08: Email Registration Tests', () {
    testWidgets('Password strength checklist ticks live as user types', (
      WidgetTester tester,
    ) async {
      final mockRepo = MockAuthRepository();

      await tester.pumpWidget(
        MaterialApp(
          home: EmailRegisterScreen(
            selectedRole: UserRole.creator,
            authRepository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Sign up with'), findsOneWidget);
      expect(find.text('At least 8 characters'), findsOneWidget);
      expect(find.text('Contains a number'), findsOneWidget);
      expect(find.text('Contains a special character'), findsOneWidget);

      final textFields = find.byType(TextField);
      expect(textFields, findsNWidgets(3)); // email, password, confirm

      // Type email
      await tester.enterText(textFields.at(0), 'test@creatorconnect.in');
      await tester.pumpAndSettle();

      // Type weak password
      await tester.enterText(textFields.at(1), 'short');
      await tester.pumpAndSettle();
      expect(find.text('Weak password'), findsOneWidget);

      // Type strong password satisfying all 3 rules
      await tester.enterText(textFields.at(1), 'P@ssword123');
      await tester.pumpAndSettle();
      expect(find.text('Strong password'), findsOneWidget);

      // Confirm matching password
      await tester.enterText(textFields.at(2), 'P@ssword123');
      await tester.pumpAndSettle();
      expect(find.text('Passwords match'), findsOneWidget);

      // Submit Create Account
      await tester.tap(find.text('Create Account'));
      await tester.pumpAndSettle();

      expect(mockRepo.emailSignedUp, isTrue);
      expect(find.byType(EmailSentScreen), findsOneWidget);
    });
  });

  group('SCR-09 & SCR-10: Email Sent & Google Entry Tests', () {
    testWidgets('SCR-09 renders expiry badge and action buttons', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: EmailSentScreen(
            email: 'test@creatorconnect.in',
            selectedRole: UserRole.creator,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Check your email'), findsOneWidget);
      expect(find.text('Link expires in 24 hours'), findsOneWidget);
      expect(find.text('Open Email App'), findsOneWidget);
      expect(find.text('Wrong address? Change email'), findsOneWidget);
    });

    testWidgets('SCR-10 Google sign-in handoff renders connecting message and Cancel', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: GoogleAuthScreen(),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Connecting to Google…'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });
  });
}
