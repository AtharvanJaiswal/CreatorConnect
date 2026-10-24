import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:creatorconnect/features/auth/domain/entities/user_role.dart';
import 'package:creatorconnect/features/profile/domain/entities/profile_entities.dart';
import 'package:creatorconnect/features/profile/domain/entities/taxonomy_data.dart';
import 'package:creatorconnect/features/profile/data/datasources/profile_local_datasource.dart';
import 'package:creatorconnect/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:creatorconnect/features/profile/data/repositories/profile_repository_impl.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    ProfileRepositoryImpl.resetForTesting();
    final mockHttpClient = MockClient((request) async {
      return http.Response(jsonEncode({'status': 'ok'}), 200);
    });
    final mockRemoteDs = ProfileRemoteDataSource(httpClient: mockHttpClient);
    ProfileRepositoryImpl.setMockInstanceForTesting(ProfileRepositoryImpl(remoteDataSource: mockRemoteDs));
  });

  group('ProfileLocalDataSource Unit Tests', () {
    test('Saves and loads BasicInfoData locally', () async {
      final localDs = ProfileLocalDataSource();
      const info = BasicInfoData(
        displayName: 'John Doe',
        bio: 'Tech Content Creator',
        city: 'Mumbai',
        languages: ['English', 'Hindi'],
      );

      await localDs.saveBasicInfo(info);
      final loaded = await localDs.getBasicInfo();

      expect(loaded, isNotNull);
      expect(loaded!.displayName, 'John Doe');
      expect(loaded.bio, 'Tech Content Creator');
      expect(loaded.city, 'Mumbai');
      expect(loaded.languages, ['English', 'Hindi']);
    });

    test('Saves and loads Category and Skill selections locally', () async {
      final localDs = ProfileLocalDataSource();
      final skills = [
        const UserSkillSelection(
          skillId: 's1',
          name: 'Video Editing',
          proficiency: SkillProficiencyLevel.intermediate,
        ),
        const UserSkillSelection(
          skillId: 's2',
          name: 'Color Grading',
          proficiency: SkillProficiencyLevel.expert,
        ),
      ];
      final catIds = ['cat-video', 'cat-tech'];

      await localDs.saveUserSkills(skills);
      await localDs.saveSelectedCategories(catIds);

      final loadedSkills = await localDs.getUserSkills();
      final loadedCats = await localDs.getSelectedCategories();

      expect(loadedSkills, isNotNull);
      expect(loadedSkills!.length, 2);
      expect(loadedSkills.first.name, 'Video Editing');
      expect(loadedSkills.first.proficiency, SkillProficiencyLevel.intermediate);
      expect(loadedCats, isNotNull);
      expect(loadedCats, ['cat-video', 'cat-tech']);
    });

    test('Saves and loads CreatorDetailsData locally', () async {
      final localDs = ProfileLocalDataSource();
      const details = CreatorDetailsData(
        contentTypes: ['Reels', 'Shorts'],
        minRate: 5000,
        maxRate: 15000,
        rateUnit: RateUnit.perPost,
        showRateOnProfile: true,
        availability: AvailabilityStatus.availableNow,
      );

      await localDs.saveCreatorDetails(details);
      final loaded = await localDs.getCreatorDetails();

      expect(loaded, isNotNull);
      expect(loaded!.contentTypes, ['Reels', 'Shorts']);
      expect(loaded.minRate, 5000);
      expect(loaded.maxRate, 15000);
      expect(loaded.rateUnit, RateUnit.perPost);
      expect(loaded.availability, AvailabilityStatus.availableNow);
    });

    test('Saves and loads ProfessionalDetailsData locally', () async {
      final localDs = ProfileLocalDataSource();
      const details = ProfessionalDetailsData(
        professionalType: 'Cinematographer',
        experience: '5+ years',
        tools: ['Sony FX3', 'DaVinci Resolve'],
        minRate: 20000,
        rateUnit: RateUnit.perProject,
        hasPortfolioSample: true,
      );

      await localDs.saveProfessionalDetails(details);
      final loaded = await localDs.getProfessionalDetails();

      expect(loaded, isNotNull);
      expect(loaded!.professionalType, 'Cinematographer');
      expect(loaded.tools, ['Sony FX3', 'DaVinci Resolve']);
      expect(loaded.minRate, 20000);
    });

    test('Saves and loads PodcastDetailsData locally', () async {
      final localDs = ProfileLocalDataSource();
      const details = PodcastDetailsData(
        showName: 'Creator Hustle',
        category: 'Business & Technology',
        description: 'Conversations with Indian creators',
        platformLinks: ['https://open.spotify.com/show/123'],
        frequency: ReleaseFrequency.weekly,
      );

      await localDs.savePodcastDetails(details);
      final loaded = await localDs.getPodcastDetails();

      expect(loaded, isNotNull);
      expect(loaded!.showName, 'Creator Hustle');
      expect(loaded.category, 'Business & Technology');
      expect(loaded.frequency, ReleaseFrequency.weekly);
    });

    test('Saves and loads CompanyDetailsData locally', () async {
      final localDs = ProfileLocalDataSource();
      const details = CompanyDetailsData(
        companyName: 'NexGen Media Labs',
        description: 'Influencer Marketing Agency',
        businessCategory: 'Marketing & PR',
        city: 'Bengaluru',
        teamSize: '11–50 members',
        websiteUrl: 'https://nexgenmedialabs.in',
        gstNumber: '29ABCDE1234F1Z5',
      );

      await localDs.saveCompanyDetails(details);
      final loaded = await localDs.getCompanyDetails();

      expect(loaded, isNotNull);
      expect(loaded!.companyName, 'NexGen Media Labs');
      expect(loaded.gstNumber, '29ABCDE1234F1Z5');
      expect(loaded.city, 'Bengaluru');
    });

    test('Saves and loads SocialPlatformAccounts locally', () async {
      final localDs = ProfileLocalDataSource();
      final accounts = [
        const SocialPlatformAccount(
          platform: 'Instagram',
          handle: 'nexgen_creator',
          status: SocialPlatformStatus.connected,
          profileUrl: 'instagram.com/nexgen_creator',
        ),
        const SocialPlatformAccount(
          platform: 'YouTube',
          handle: 'nexgentv',
          status: SocialPlatformStatus.verified,
          profileUrl: 'youtube.com/@nexgentv',
        ),
      ];

      await localDs.saveSocialAccounts(accounts);
      final loaded = await localDs.getSocialAccounts();

      expect(loaded, isNotNull);
      expect(loaded!.length, 2);
      expect(loaded.first.platform, 'Instagram');
      expect(loaded.first.status, SocialPlatformStatus.connected);
      expect(loaded.last.platform, 'YouTube');
      expect(loaded.last.status, SocialPlatformStatus.verified);
    });

    test('Saves and loads VerificationData locally', () async {
      final localDs = ProfileLocalDataSource();
      const verData = VerificationData(
        state: VerificationState.underReview,
        submittedAccount: 'Instagram @nexgen_creator',
        oneTimeCode: 'CC-88231',
        submittedDate: 'Today, 14:30',
        brandDocumentNames: ['certificate.pdf'],
      );

      await localDs.saveVerificationData(verData);
      final loaded = await localDs.getVerificationData();

      expect(loaded, isNotNull);
      expect(loaded!.state, VerificationState.underReview);
      expect(loaded.oneTimeCode, 'CC-88231');
      expect(loaded.brandDocumentNames, ['certificate.pdf']);
    });
  });

  group('ProfileRepository Immediate Draft Auto-Save & Singleton Persistence', () {
    test('Drafts are saved immediately and retained across repository accesses', () async {
      final repo1 = ProfileRepositoryImpl();

      // User types in basic info and it auto-saves as draft
      await repo1.saveBasicInfoDraft(const BasicInfoData(
        displayName: 'Aarav Sharma',
        bio: 'Tech reviewer & drone pilot',
        city: 'Delhi NCR',
        languages: ['English', 'Hindi', 'Punjabi'],
      ));

      // User selects categories and skills
      await repo1.saveCategorySelection(['cat-tech', 'cat-gadgets']);
      await repo1.saveSkillSelection([
        const UserSkillSelection(
          skillId: 'drone-filming',
          name: 'Drone Cinematography',
          proficiency: SkillProficiencyLevel.expert,
        ),
      ]);

      // User configures creator rates
      await repo1.saveCreatorDetailsDraft(const CreatorDetailsData(
        contentTypes: ['YouTube Long-form', 'Instagram Reels'],
        minRate: 15000,
        maxRate: 35000,
        rateUnit: RateUnit.perPost,
        showRateOnProfile: true,
        availability: AvailabilityStatus.availableNow,
      ));

      // Verify that another screen instantiating ProfileRepositoryImpl gets identical data
      final repo2 = ProfileRepositoryImpl();

      final basic = await repo2.getBasicInfo();
      expect(basic.displayName, 'Aarav Sharma');
      expect(basic.bio, 'Tech reviewer & drone pilot');
      expect(basic.city, 'Delhi NCR');

      expect(repo2.selectedCategoryIds, ['cat-tech', 'cat-gadgets']);
      final skills = await repo2.getUserSkills();
      expect(skills.length, 1);
      expect(skills.first.name, 'Drone Cinematography');
      expect(skills.first.proficiency, SkillProficiencyLevel.expert);

      final creator = await repo2.getCreatorDetails();
      expect(creator.minRate, 15000);
      expect(creator.maxRate, 35000);
      expect(creator.contentTypes, ['YouTube Long-form', 'Instagram Reels']);
    });

    test('Preserves professional, podcast and company drafts across screen transitions', () async {
      final repo = ProfileRepositoryImpl();

      // Professional draft
      await repo.saveProfessionalDetailsDraft(const ProfessionalDetailsData(
        professionalType: 'Sound Designer',
        experience: '3–5 years',
        tools: ['Pro Tools', 'Ableton'],
      ));
      final prof = await repo.getProfessionalDetails();
      expect(prof.professionalType, 'Sound Designer');
      expect(prof.tools, ['Pro Tools', 'Ableton']);

      // Podcast draft
      await repo.savePodcastDetailsDraft(const PodcastDetailsData(
        showName: 'Audio Lab',
        description: 'Sound engineering talks',
      ));
      final pod = await repo.getPodcastDetails();
      expect(pod.showName, 'Audio Lab');

      // Company draft
      await repo.saveCompanyDetailsDraft(const CompanyDetailsData(
        companyName: 'SoundWave Studio',
        teamSize: '1–10 members',
      ));
      final comp = await repo.getCompanyDetails();
      expect(comp.companyName, 'SoundWave Studio');
      expect(comp.teamSize, '1–10 members');
    });

    test('Calculates profile overview completion with persisted data', () async {
      final repo = ProfileRepositoryImpl();

      // 0% initially
      final initial = await repo.getProfileOverview(role: UserRole.creator);
      expect(initial.completionPercentage, 0);

      // Save basic info
      await repo.updateBasicInfo(const BasicInfoData(
        displayName: 'Pooja Verma',
        bio: 'Fashion creator',
        city: 'Mumbai',
        languages: ['English'],
      ));

      final afterBasic = await repo.getProfileOverview(role: UserRole.creator);
      expect(afterBasic.completionPercentage, greaterThan(0));
      expect(afterBasic.requiredSections.firstWhere((s) => s.key == 'basicInfo').isDone, isTrue);
    });
  });
}
