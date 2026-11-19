import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:creatorconnect/features/profile/data/datasources/profile_local_datasource.dart';
import 'package:creatorconnect/features/profile/data/repositories/profile_repository_impl.dart';
import 'package:creatorconnect/features/profile/domain/entities/profile_entities.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Multi-Account Local Data Isolation Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      ProfileRepositoryImpl.resetForTesting();
    });

    test('ProfileLocalDataSource isolates basic info by userId', () async {
      final prefs = await SharedPreferences.getInstance();
      final userADs = ProfileLocalDataSource(prefs: prefs, userId: 'user-aaa-111');
      final userBDs = ProfileLocalDataSource(prefs: prefs, userId: 'user-bbb-222');

      // User A saves their profile
      await userADs.saveBasicInfo(
        const BasicInfoData(
          displayName: 'Priya A',
          bio: 'Creator A bio',
          city: 'Mumbai',
        ),
      );

      // Verify User A can read it
      final userAData = await userADs.getBasicInfo();
      expect(userAData?.displayName, 'Priya A');
      expect(userAData?.bio, 'Creator A bio');

      // Verify User B sees null (isolated storage, zero cross-pollination)
      final userBData = await userBDs.getBasicInfo();
      expect(userBData, isNull);

      // User B saves their own profile
      await userBDs.saveBasicInfo(
        const BasicInfoData(
          displayName: 'Rohan B',
          bio: 'Podcaster B bio',
          city: 'Bengaluru',
        ),
      );

      // Verify both accounts retain strictly their own isolated data
      expect((await userADs.getBasicInfo())?.displayName, 'Priya A');
      expect((await userBDs.getBasicInfo())?.displayName, 'Rohan B');
    });

    test('ProfileLocalDataSource isolates creator and company details by userId', () async {
      final prefs = await SharedPreferences.getInstance();
      final userADs = ProfileLocalDataSource(prefs: prefs, userId: 'user-aaa-111');
      final userBDs = ProfileLocalDataSource(prefs: prefs, userId: 'user-bbb-222');

      await userADs.saveCreatorDetails(
        const CreatorDetailsData(
          contentTypes: ['Reels', 'Vlogs'],
          minRate: 15000,
        ),
      );

      expect((await userADs.getCreatorDetails())?.minRate, 15000);
      expect((await userBDs.getCreatorDetails()), isNull);
    });

    test('clearAll removes user-scoped keys without affecting other users', () async {
      final prefs = await SharedPreferences.getInstance();
      final userADs = ProfileLocalDataSource(prefs: prefs, userId: 'user-aaa-111');
      final userBDs = ProfileLocalDataSource(prefs: prefs, userId: 'user-bbb-222');

      await userADs.saveBasicInfo(const BasicInfoData(displayName: 'User A'));
      await userBDs.saveBasicInfo(const BasicInfoData(displayName: 'User B'));

      // Purge User A
      await userADs.clearAll();

      expect(await userADs.getBasicInfo(), isNull);
      expect((await userBDs.getBasicInfo())?.displayName, 'User B');
    });

    test('ProfileRepositoryImpl resets singleton and reloads clean state on account switch', () async {
      final repo = ProfileRepositoryImpl.instance;
      await repo.saveBasicInfoDraft(
        const BasicInfoData(displayName: 'User A Cached', bio: 'Old Bio'),
      );

      expect((await repo.getBasicInfo()).displayName, 'User A Cached');

      // Simulate sign out -> clear cache & reset singleton
      await ProfileLocalDataSource().clearAll();
      ProfileRepositoryImpl.resetForTesting();

      // Fresh instance for new user
      final freshRepo = ProfileRepositoryImpl.instance;
      expect((await freshRepo.getBasicInfo()).displayName, isNot('User A Cached'));
    });
  });
}
