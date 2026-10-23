import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/config/env_config.dart';
import '../../domain/entities/taxonomy_data.dart';

class ProfileRemoteDataSource {
  final http.Client _httpClient;

  ProfileRemoteDataSource({http.Client? httpClient})
      : _httpClient = httpClient ?? http.Client();

  String get _baseUrl => EnvironmentConfig.current.apiBaseUrl;

  String? get _bearerToken {
    try {
      return Supabase.instance.client.auth.currentSession?.accessToken;
    } catch (_) {
      return null;
    }
  }

  Map<String, String> _headers([String? customToken]) {
    final token = customToken ?? _bearerToken;
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Uri _buildUri(String path) {
    var base = _baseUrl.trim();
    while (base.endsWith('/')) {
      base = base.substring(0, base.length - 1);
    }
    var cleanPath = path.trim();
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/$cleanPath';
    }
    // Avoid double /api/v1/api/v1 prefix
    if (base.endsWith('/api/v1') && cleanPath.startsWith('/api/v1/')) {
      cleanPath = cleanPath.substring(7);
    }
    return Uri.parse('$base$cleanPath');
  }

  /// Direct Supabase Auth user metadata synchronization
  Future<void> syncWithSupabaseUserMetadata({
    String? displayName,
    String? avatarUrl,
    String? bio,
    String? city,
    Map<String, dynamic>? additionalData,
  }) async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user != null) {
        final currentMeta = Map<String, dynamic>.from(user.userMetadata ?? {});
        if (displayName != null) {
          currentMeta['full_name'] = displayName;
          currentMeta['name'] = displayName;
        }
        if (avatarUrl != null) currentMeta['avatar_url'] = avatarUrl;
        if (bio != null) currentMeta['bio'] = bio;
        if (city != null) currentMeta['city'] = city;
        if (additionalData != null) currentMeta.addAll(additionalData);

        await Supabase.instance.client.auth.updateUser(
          UserAttributes(data: currentMeta),
        );
      }
    } catch (_) {
      // Supabase uninitialized or offline
    }
  }

  /// GET /api/v1/profiles/me - Aggregated user profile across all roles
  Future<Map<String, dynamic>> getMeProfiles() async {
    final response = await _httpClient.get(
      _buildUri('/profiles/me'),
      headers: _headers(),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    return {};
  }

  /// PATCH /api/v1/users/me - Updates basic user info (name, avatar)
  Future<void> updateUserInfo({String? firstName, String? lastName, String? avatarUrl}) async {
    final response = await _httpClient.patch(
      _buildUri('/users/me'),
      headers: _headers(),
      body: jsonEncode({
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      }),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to update user info: ${response.statusCode} - ${response.body}');
    }
  }

  /// PUT /api/v1/profiles/creator - Updates creator details and social links
  Future<void> updateCreatorProfile(Map<String, dynamic> body) async {
    final response = await _httpClient.put(
      _buildUri('/profiles/creator'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to update creator profile: ${response.statusCode} - ${response.body}');
    }
  }

  /// PUT /api/v1/profiles/professional - Updates pro details
  Future<void> updateProfessionalProfile(Map<String, dynamic> body) async {
    final response = await _httpClient.put(
      _buildUri('/profiles/professional'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to update professional profile: ${response.statusCode} - ${response.body}');
    }
  }

  /// PUT /api/v1/profiles/brand - Updates brand company details
  Future<void> updateBrandProfile(Map<String, dynamic> body) async {
    final response = await _httpClient.put(
      _buildUri('/profiles/brand'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to update brand profile: ${response.statusCode} - ${response.body}');
    }
  }

  /// PUT /api/v1/profiles/podcaster - Updates podcast details
  Future<void> updatePodcasterProfile(Map<String, dynamic> body) async {
    final response = await _httpClient.put(
      _buildUri('/profiles/podcaster'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to update podcaster profile: ${response.statusCode} - ${response.body}');
    }
  }

  /// GET /api/v1/discovery/categories - Returns live taxonomy categories from DB
  Future<List<CategoryItem>> getCategories() async {
    final response = await _httpClient.get(
      _buildUri('/discovery/categories'),
      headers: _headers(),
    );
    if (response.statusCode == 200) {
      final list = jsonDecode(response.body) as List<dynamic>;
      return list.map((e) => CategoryItem.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load categories: ${response.statusCode}');
  }

  /// GET /api/v1/discovery/skills - Returns live taxonomy skills from DB
  Future<List<SkillItem>> getSkills() async {
    final response = await _httpClient.get(
      _buildUri('/discovery/skills'),
      headers: _headers(),
    );
    if (response.statusCode == 200) {
      final list = jsonDecode(response.body) as List<dynamic>;
      return list.map((e) => SkillItem.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load skills: ${response.statusCode}');
  }

  /// PUT /api/v1/profiles/skills - Updates user skills with proficiency levels
  Future<void> updateUserSkills(List<UserSkillSelection> skills) async {
    final response = await _httpClient.put(
      _buildUri('/profiles/skills'),
      headers: _headers(),
      body: jsonEncode({
        'skills': skills.map((s) => {'skillId': s.skillId, 'proficiency': s.proficiency.apiValue}).toList(),
      }),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to update user skills: ${response.statusCode} - ${response.body}');
    }
  }

  /// POST /api/v1/profiles/verification/creator - Persists creator verification to PostgreSQL
  Future<void> submitCreatorVerification(String platform, String handle, String code) async {
    final response = await _httpClient.post(
      _buildUri('/profiles/verification/creator'),
      headers: _headers(),
      body: jsonEncode({
        'platform': platform,
        'handle': handle,
        'code': code,
      }),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to submit creator verification: ${response.statusCode} - ${response.body}');
    }
  }

  /// POST /api/v1/profiles/verification/brand - Persists brand verification to PostgreSQL
  Future<void> submitBrandVerification({
    required String businessName,
    required String regNumber,
    required String person,
    required List<String> documents,
  }) async {
    final response = await _httpClient.post(
      _buildUri('/profiles/verification/brand'),
      headers: _headers(),
      body: jsonEncode({
        'businessName': businessName,
        'regNumber': regNumber,
        'person': person,
        'documents': documents,
      }),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to submit brand verification: ${response.statusCode} - ${response.body}');
    }
  }

  /// GET /api/v1/profiles/verification/status - Retrieves real verification state from PostgreSQL
  Future<Map<String, dynamic>?> getVerificationStatus() async {
    final response = await _httpClient.get(
      _buildUri('/profiles/verification/status'),
      headers: _headers(),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    return null;
  }

  /// POST /api/v1/auth/sync - Synchronize secondary role
  Future<void> syncSecondaryRole(String roleApiValue) async {
    final response = await _httpClient.post(
      _buildUri('/auth/sync'),
      headers: _headers(),
      body: jsonEncode({'preferredRole': roleApiValue}),
    );
    if (response.statusCode >= 400) {
      throw Exception('Failed to sync secondary role: ${response.statusCode} - ${response.body}');
    }
  }
}
