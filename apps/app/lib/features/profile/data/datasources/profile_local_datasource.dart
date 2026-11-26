import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/entities/taxonomy_data.dart';

/// Local data source to persist Module C user inputs, selections, and drafts on-device,
/// strictly scoped per authenticated user ID to eliminate cross-account pollution.
class ProfileLocalDataSource {
  final SharedPreferences? _prefs;
  final String? _explicitUserId;

  ProfileLocalDataSource({SharedPreferences? prefs, String? userId})
      : _prefs = prefs,
        _explicitUserId = userId;

  String _key(String base) {
    if (_explicitUserId != null && _explicitUserId.isNotEmpty) {
      return 'cc_${_explicitUserId}_$base';
    }
    try {
      final uid = Supabase.instance.client.auth.currentUser?.id;
      if (uid != null && uid.isNotEmpty) {
        return 'cc_${uid}_$base';
      }
    } catch (_) {}
    return 'cc_anon_$base';
  }

  String get _keyBasicInfo => _key('basic_info');
  String get _keySelectedCategories => _key('selected_categories');
  String get _keyUserSkills => _key('user_skills');
  String get _keyCreatorDetails => _key('creator_details');
  String get _keyProfessionalDetails => _key('professional_details');
  String get _keyPodcastDetails => _key('podcast_details');
  String get _keyCompanyDetails => _key('company_details');
  String get _keySocialAccounts => _key('social_accounts');
  String get _keyVerificationData => _key('verification_data');

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
      final currentUid = _explicitUserId ??
          (() {
            try {
              return Supabase.instance.client.auth.currentUser?.id ?? '';
            } catch (_) {
              return '';
            }
          })();
      final allKeys = prefs.getKeys().toList();
      for (final k in allKeys) {
        if (currentUid.isNotEmpty && k.startsWith('cc_${currentUid}_')) {
          await prefs.remove(k);
        } else if (k.startsWith('cc_profile_') || k.startsWith('cc_anon_')) {
          await prefs.remove(k);
        }
      }
    } catch (_) {}
  }
}
