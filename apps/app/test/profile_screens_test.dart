import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:creatorconnect/features/profile/data/repositories/profile_repository_impl.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c01_profile_completion_screen.dart';
import 'package:creatorconnect/features/profile/presentation/screens/c02_basic_information_screen.dart';
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

  Widget buildTestScreen(Widget child) {
    return MaterialApp(home: child);
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

  testWidgets('UserProfileScreen renders user profile with locked security credentials and edit options', (tester) async {
    await tester.pumpWidget(buildTestScreen(const UserProfileScreen()));
    await tester.pumpAndSettle();

    expect(find.text('My Profile'), findsOneWidget);
    expect(find.text('Account & Security'), findsOneWidget);
    expect(find.text('LOCKED'), findsOneWidget);
    expect(find.text('Registered Email'), findsOneWidget);
    expect(find.text('Registered Mobile Number'), findsOneWidget);
    expect(find.text('Cannot Change'), findsNWidgets(2));
    expect(find.text('Edit Profile'), findsOneWidget);
    expect(find.text('About'), findsOneWidget);
  });
}
