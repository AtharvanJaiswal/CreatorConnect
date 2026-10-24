import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/entities/campaign_entities.dart';

class CampaignLocalDataSource {
  static const String _draftBriefKey = 'cc_campaign_draft_brief';
  static const String _savedBriefIdsKey = 'cc_saved_brief_ids';

  final SharedPreferences? _prefs;

  CampaignLocalDataSource({SharedPreferences? prefs}) : _prefs = prefs;

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ?? await SharedPreferences.getInstance();
  }

  /// Saves in-progress wizard brief draft (E02-E05)
  Future<void> saveDraftBrief(CampaignBrief brief) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_draftBriefKey, jsonEncode(brief.toJson()));
    } catch (_) {}
  }

  /// Loads previously saved brief draft
  Future<CampaignBrief?> getDraftBrief() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_draftBriefKey);
      if (raw != null && raw.isNotEmpty) {
        return CampaignBrief.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  /// Clears stored draft brief upon publication
  Future<void> clearDraftBrief() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_draftBriefKey);
    } catch (_) {}
  }

  /// Toggles saving a brief ID (E12)
  Future<bool> toggleSavedBrief(String briefId) async {
    try {
      final prefs = await _getPrefs();
      final list = prefs.getStringList(_savedBriefIdsKey) ?? [];
      final exists = list.contains(briefId);
      if (exists) {
        list.remove(briefId);
      } else {
        list.add(briefId);
      }
      await prefs.setStringList(_savedBriefIdsKey, list);
      return !exists;
    } catch (_) {
      return false;
    }
  }

  /// Checks if a brief ID is currently bookmarked
  Future<bool> isBriefSaved(String briefId) async {
    try {
      final prefs = await _getPrefs();
      final list = prefs.getStringList(_savedBriefIdsKey) ?? [];
      return list.contains(briefId);
    } catch (_) {
      return false;
    }
  }

  /// Returns all bookmarked brief IDs
  Future<List<String>> getSavedBriefIds() async {
    try {
      final prefs = await _getPrefs();
      return prefs.getStringList(_savedBriefIdsKey) ?? [];
    } catch (_) {
      return [];
    }
  }
}
