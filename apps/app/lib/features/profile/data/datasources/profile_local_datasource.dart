import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/entities/taxonomy_data.dart';

/// Local data source to persist Module C user inputs, selections, and drafts on-device
class ProfileLocalDataSource {
  static const String _keyBasicInfo = 'cc_profile_basic_info';
  static const String _keySelectedCategories = 'cc_profile_selected_categories';
  static const String _keyUserSkills = 'cc_profile_user_skills';
  static const String _keyCreatorDetails = 'cc_profile_creator_details';
  static const String _keyProfessionalDetails = 'cc_profile_professional_details';
  static const String _keyPodcastDetails = 'cc_profile_podcast_details';
  static const String _keyCompanyDetails = 'cc_profile_company_details';
  static const String _keySocialAccounts = 'cc_profile_social_accounts';
  static const String _keyVerificationData = 'cc_profile_verification_data';

  final SharedPreferences? _prefs;

  ProfileLocalDataSource({SharedPreferences? prefs}) : _prefs = prefs;

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ?? await SharedPreferences.getInstance();
  }

  // --- Basic Info ---
  Future<void> saveBasicInfo(BasicInfoData data) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_keyBasicInfo, jsonEncode(data.toJson()));
    } catch (_) {}
  }

  Future<BasicInfoData?> getBasicInfo() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keyBasicInfo);
      if (raw != null && raw.isNotEmpty) {
        return BasicInfoData.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  // --- Selected Categories ---
  Future<void> saveSelectedCategories(List<String> categoryIds) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setStringList(_keySelectedCategories, categoryIds);
    } catch (_) {}
  }

  Future<List<String>?> getSelectedCategories() async {
    try {
      final prefs = await _getPrefs();
      return prefs.getStringList(_keySelectedCategories);
    } catch (_) {}
    return null;
  }

  // --- User Skills ---
  Future<void> saveUserSkills(List<UserSkillSelection> skills) async {
    try {
      final prefs = await _getPrefs();
      final list = skills.map((s) => s.toJson()).toList();
      await prefs.setString(_keyUserSkills, jsonEncode(list));
    } catch (_) {}
  }

  Future<List<UserSkillSelection>?> getUserSkills() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keyUserSkills);
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw) as List<dynamic>;
        return list
            .map((e) => UserSkillSelection.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}
    return null;
  }

  // --- Creator Details ---
  Future<void> saveCreatorDetails(CreatorDetailsData data) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_keyCreatorDetails, jsonEncode(data.toJson()));
    } catch (_) {}
  }

  Future<CreatorDetailsData?> getCreatorDetails() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keyCreatorDetails);
      if (raw != null && raw.isNotEmpty) {
        return CreatorDetailsData.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  // --- Professional Details ---
  Future<void> saveProfessionalDetails(ProfessionalDetailsData data) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_keyProfessionalDetails, jsonEncode(data.toJson()));
    } catch (_) {}
  }

  Future<ProfessionalDetailsData?> getProfessionalDetails() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keyProfessionalDetails);
      if (raw != null && raw.isNotEmpty) {
        return ProfessionalDetailsData.fromJson(
            jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  // --- Podcast Details ---
  Future<void> savePodcastDetails(PodcastDetailsData data) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_keyPodcastDetails, jsonEncode(data.toJson()));
    } catch (_) {}
  }

  Future<PodcastDetailsData?> getPodcastDetails() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keyPodcastDetails);
      if (raw != null && raw.isNotEmpty) {
        return PodcastDetailsData.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  // --- Company Details ---
  Future<void> saveCompanyDetails(CompanyDetailsData data) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_keyCompanyDetails, jsonEncode(data.toJson()));
    } catch (_) {}
  }

  Future<CompanyDetailsData?> getCompanyDetails() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keyCompanyDetails);
      if (raw != null && raw.isNotEmpty) {
        return CompanyDetailsData.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  // --- Social Accounts ---
  Future<void> saveSocialAccounts(List<SocialPlatformAccount> accounts) async {
    try {
      final prefs = await _getPrefs();
      final list = accounts.map((a) => a.toJson()).toList();
      await prefs.setString(_keySocialAccounts, jsonEncode(list));
    } catch (_) {}
  }

  Future<List<SocialPlatformAccount>?> getSocialAccounts() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keySocialAccounts);
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw) as List<dynamic>;
        return list
            .map((e) => SocialPlatformAccount.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}
    return null;
  }

  // --- Verification Data ---
  Future<void> saveVerificationData(VerificationData data) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_keyVerificationData, jsonEncode(data.toJson()));
    } catch (_) {}
  }

  Future<VerificationData?> getVerificationData() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_keyVerificationData);
      if (raw != null && raw.isNotEmpty) {
        return VerificationData.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  // --- Clear / Reset ---
  Future<void> clearAll() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_keyBasicInfo);
      await prefs.remove(_keySelectedCategories);
      await prefs.remove(_keyUserSkills);
      await prefs.remove(_keyCreatorDetails);
      await prefs.remove(_keyProfessionalDetails);
      await prefs.remove(_keyPodcastDetails);
      await prefs.remove(_keyCompanyDetails);
      await prefs.remove(_keySocialAccounts);
      await prefs.remove(_keyVerificationData);
    } catch (_) {}
  }
}
