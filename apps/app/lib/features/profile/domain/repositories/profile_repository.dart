import '../../../auth/domain/entities/user_role.dart';
import '../entities/profile_entities.dart';
import '../entities/taxonomy_data.dart';

abstract class ProfileRepository {
  /// Currently selected category IDs
  List<String> get selectedCategoryIds;

  /// Retrieves calculated profile overview with checklist sections & completion percentage
  Future<ProfileOverviewData> getProfileOverview({required UserRole role});

  /// Basic Information (C02)
  Future<BasicInfoData> getBasicInfo();
  Future<void> updateBasicInfo(BasicInfoData data);
  Future<void> saveBasicInfoDraft(BasicInfoData data);

  /// Taxonomy & User Skills (C03)
  Future<List<CategoryItem>> getCategories();
  Future<List<SkillItem>> getSkills();
  Future<List<UserSkillSelection>> getUserSkills();
  Future<void> updateUserSkills(List<UserSkillSelection> skills, List<String> categoryIds);
  Future<void> saveCategorySelection(List<String> categoryIds);
  Future<void> saveSkillSelection(List<UserSkillSelection> skills);

  /// Role specific updates (C04 - C07)
  Future<CreatorDetailsData> getCreatorDetails();
  Future<void> updateCreatorDetails(CreatorDetailsData data);
  Future<void> saveCreatorDetailsDraft(CreatorDetailsData data);

  Future<ProfessionalDetailsData> getProfessionalDetails();
  Future<void> updateProfessionalDetails(ProfessionalDetailsData data);
  Future<void> saveProfessionalDetailsDraft(ProfessionalDetailsData data);

  Future<PodcastDetailsData> getPodcastDetails();
  Future<void> updatePodcastDetails(PodcastDetailsData data);
  Future<void> savePodcastDetailsDraft(PodcastDetailsData data);

  Future<CompanyDetailsData> getCompanyDetails();
  Future<void> updateCompanyDetails(CompanyDetailsData data);
  Future<void> saveCompanyDetailsDraft(CompanyDetailsData data);

  /// Social Accounts (C08 - C11)
  Future<List<SocialPlatformAccount>> getSocialAccounts();
  Future<SocialPlatformAccount> connectSocialAccount(String platform, String handle);
  Future<void> disconnectSocialAccount(String platform);
  Future<void> saveSocialAccountsDraft(List<SocialPlatformAccount> accounts);

  /// Verification (C12 - C14)
  Future<VerificationData> getVerificationData();
  Future<void> saveVerificationDraft(VerificationData data);
  Future<void> submitCreatorVerification(String platform, String handle, String code);
  Future<void> submitBrandVerification({
    required String businessName,
    required String regNumber,
    required String person,
    required List<String> documents,
  });

  /// Add Role (C15)
  Future<void> addSecondaryRole(UserRole role);
}
