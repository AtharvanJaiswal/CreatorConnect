import 'package:shared_preferences/shared_preferences.dart';

/// Local data source managing device-level auth and onboarding flags
class AuthLocalDataSource {
  static const String _onboardingCompleteKey = 'cc_has_completed_onboarding';
  static const String _savedRoleKey = 'cc_saved_user_role';

  final SharedPreferences? _prefs;

  AuthLocalDataSource({SharedPreferences? prefs}) : _prefs = prefs;

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ?? await SharedPreferences.getInstance();
  }

  /// Checks if the user has already seen and completed the onboarding carousel
  Future<bool> hasCompletedOnboarding() async {
    try {
      final prefs = await _getPrefs();
      return prefs.getBool(_onboardingCompleteKey) ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Sets the onboarding completion flag so returning users bypass onboarding
  Future<void> setOnboardingCompleted({bool completed = true}) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setBool(_onboardingCompleteKey, completed);
    } catch (_) {}
  }

  /// Clears onboarding state (useful for testing or profile reset)
  Future<void> clearOnboarding() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_onboardingCompleteKey);
    } catch (_) {}
  }

  /// Saves the last selected persona role
  Future<void> saveSelectedRole(String roleApiValue) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_savedRoleKey, roleApiValue);
    } catch (_) {}
  }

  /// Retrieves the last selected persona role
  Future<String?> getSelectedRole() async {
    try {
      final prefs = await _getPrefs();
      return prefs.getString(_savedRoleKey);
    } catch (_) {
      return null;
    }
  }
}
