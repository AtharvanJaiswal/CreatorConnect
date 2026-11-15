import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/config/env_config.dart';
import '../../domain/entities/taxonomy_data.dart';

class ProfileRemoteDataSource {
  static const Duration _requestTimeout = Duration(seconds: 5);

  final http.Client _httpClient;

  ProfileRemoteDataSource({http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client();

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
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Uri _buildUri(String path) {
    return EnvironmentConfig.normalizeApiUri(path);
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
    final response = await _httpClient
        .get(_buildUri('/profiles/me'), headers: _headers())
        .timeout(_requestTimeout);
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    return {};
  }

  /// PATCH /api/v1/users/me - Updates basic user info (name, avatar)
  Future<void> updateUserInfo({
    String? firstName,
    String? lastName,
    String? avatarUrl,
  }) async {
    final cleanFirst = firstName?.trim();
    final cleanLast = lastName?.trim();
    final cleanAvatar = avatarUrl?.trim();
    final isRemoteAvatar =
        cleanAvatar != null &&
        (cleanAvatar.startsWith('http://') ||
            cleanAvatar.startsWith('https://'));

    final payload = <String, dynamic>{
      if (cleanFirst != null && cleanFirst.isNotEmpty) 'firstName': cleanFirst,
      if (cleanLast != null && cleanLast.isNotEmpty) 'lastName': cleanLast,
      if (isRemoteAvatar) 'avatarUrl': cleanAvatar,
    };
    if (payload.isEmpty) return;

    final response = await _httpClient
        .patch(
          _buildUri('/users/me'),
          headers: _headers(),
          body: jsonEncode(payload),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to update user info: ${response.statusCode} - ${response.body}',
      );
    }
  }

  /// PUT /api/v1/profiles/creator - Updates creator details and social links
  Future<void> updateCreatorProfile(Map<String, dynamic> body) async {
    final response = await _httpClient
        .put(
          _buildUri('/profiles/creator'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to update creator profile: ${response.statusCode} - ${response.body}',
      );
    }
  }

  /// PUT /api/v1/profiles/professional - Updates pro details
  Future<void> updateProfessionalProfile(Map<String, dynamic> body) async {
    final response = await _httpClient
        .put(
          _buildUri('/profiles/professional'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to update professional profile: ${response.statusCode} - ${response.body}',
      );
    }
  }

  /// PUT /api/v1/profiles/brand - Updates brand company details
  Future<void> updateBrandProfile(Map<String, dynamic> body) async {
    final response = await _httpClient
        .put(
          _buildUri('/profiles/brand'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to update brand profile: ${response.statusCode} - ${response.body}',
      );
    }
  }

  /// PUT /api/v1/profiles/podcaster - Updates podcast details
  Future<void> updatePodcasterProfile(Map<String, dynamic> body) async {
    final response = await _httpClient
        .put(
          _buildUri('/profiles/podcaster'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to update podcaster profile: ${response.statusCode} - ${response.body}',
      );
    }
  }

  static final List<Map<String, dynamic>> _fallbackCategoriesJson = [
    {
      'id': '018f0001-0000-7000-8000-000000000001',
      'name': 'Fashion & Lifestyle',
      'slug': 'fashion-lifestyle',
      'subcategories': ['Reels', 'Styling', 'Lookbooks', 'Product shoots'],
    },
    {
      'id': '018f0001-0000-7000-8000-000000000002',
      'name': 'Food',
      'slug': 'food',
      'subcategories': [
        'Recipe reels',
        'Restaurant reviews',
        'Food styling',
        'Vlogs',
      ],
    },
    {
      'id': '018f0001-0000-7000-8000-000000000003',
      'name': 'Fitness',
      'slug': 'fitness',
      'subcategories': ['Workouts', 'Nutrition', 'Transformations', 'Wellness'],
    },
    {
      'id': '018f0001-0000-7000-8000-000000000004',
      'name': 'Tech',
      'slug': 'tech',
      'subcategories': ['Reviews', 'Unboxings', 'Tutorials', 'Comparisons'],
    },
    {
      'id': '018f0001-0000-7000-8000-000000000005',
      'name': 'Travel',
      'slug': 'travel',
      'subcategories': ['Vlogs', 'Itineraries', 'Hotel stays', 'Guides'],
    },
    {
      'id': '018f0001-0000-7000-8000-000000000006',
      'name': 'Education & Career',
      'slug': 'education-career',
      'subcategories': ['Explainers', 'Study tips', 'Career prep', 'Workshops'],
    },
    {
      'id': '018f0001-0000-7000-8000-000000000007',
      'name': 'Gaming & Esports',
      'slug': 'gaming-esports',
      'subcategories': ['Streams', 'Highlights', 'Game reviews', 'Tournaments'],
    },
    {
      'id': '018f0001-0000-7000-8000-000000000008',
      'name': 'Entertainment & Comedy',
      'slug': 'entertainment-comedy',
      'subcategories': ['Skits', 'Commentary', 'Reactions', 'Short films'],
    },
  ];

  static final List<Map<String, dynamic>> _fallbackSkillsJson = [
    {
      'id': '018f0002-0000-7000-8000-000000000001',
      'name': 'Video Editing',
      'slug': 'video-editing',
    },
    {
      'id': '018f0002-0000-7000-8000-000000000002',
      'name': 'Color Grading',
      'slug': 'color-grading',
    },
    {
      'id': '018f0002-0000-7000-8000-000000000003',
      'name': 'Motion Graphics',
      'slug': 'motion-graphics',
    },
    {
      'id': '018f0002-0000-7000-8000-000000000004',
      'name': 'Drone Operation',
      'slug': 'drone-operation',
    },
    {
      'id': '018f0002-0000-7000-8000-000000000005',
      'name': 'Sound Design & Mixing',
      'slug': 'sound-design-mixing',
    },
    {
      'id': '018f0002-0000-7000-8000-000000000006',
      'name': 'Lighting & Grip',
      'slug': 'lighting-grip',
    },
    {
      'id': '018f0002-0000-7000-8000-000000000007',
      'name': 'Scriptwriting',
      'slug': 'scriptwriting',
    },
    {
      'id': '018f0002-0000-7000-8000-000000000008',
      'name': 'Commercial Photography',
      'slug': 'commercial-photography',
    },
  ];

  /// GET /api/v1/discovery/categories - Returns live taxonomy categories from DB, falling back to canonical taxonomy offline
  Future<List<CategoryItem>> getCategories() async {
    try {
      final response = await _httpClient
          .get(_buildUri('/discovery/categories'), headers: _headers())
          .timeout(_requestTimeout);
      if (response.statusCode == 200) {
        final list = jsonDecode(response.body) as List<dynamic>;
        final items = list
            .map((e) => CategoryItem.fromJson(e as Map<String, dynamic>))
            .toList();
        if (items.isNotEmpty) return items;
      }
    } catch (_) {
      // Fall back to canonical taxonomy when offline or API returns error.
    }
    return _fallbackCategoriesJson.map(CategoryItem.fromJson).toList();
  }

  /// GET /api/v1/discovery/skills - Returns live taxonomy skills from DB, falling back to canonical taxonomy offline
  Future<List<SkillItem>> getSkills() async {
    try {
      final response = await _httpClient
          .get(_buildUri('/discovery/skills'), headers: _headers())
          .timeout(_requestTimeout);
      if (response.statusCode == 200) {
        final list = jsonDecode(response.body) as List<dynamic>;
        final items = list
            .map((e) => SkillItem.fromJson(e as Map<String, dynamic>))
            .toList();
        if (items.isNotEmpty) return items;
      }
    } catch (_) {
      // Fall back to canonical taxonomy when offline or API returns error.
    }
    return _fallbackSkillsJson.map(SkillItem.fromJson).toList();
  }

  static final RegExp _uuidRegex = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  );

  static String ensureValidSkillUuid(String skillId, String skillName) {
    if (_uuidRegex.hasMatch(skillId.trim())) return skillId.trim();
    final lowerName = skillName.trim().toLowerCase();
    for (final sk in _fallbackSkillsJson) {
      if (sk['name'].toString().toLowerCase() == lowerName ||
          sk['slug'].toString().toLowerCase() == lowerName) {
        return sk['id'] as String;
      }
    }
    return _fallbackSkillsJson.first['id'] as String;
  }

  /// PUT /api/v1/profiles/skills - Updates user skills with proficiency levels
  Future<void> updateUserSkills(List<UserSkillSelection> skills) async {
    final response = await _httpClient
        .put(
          _buildUri('/profiles/skills'),
          headers: _headers(),
          body: jsonEncode({
            'skills': skills
                .map(
                  (s) => {
                    'skillId': ensureValidSkillUuid(s.skillId, s.name),
                    'proficiency': s.proficiency.apiValue,
                  },
                )
                .toList(),
          }),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to update user skills: ${response.statusCode} - ${response.body}',
      );
    }
  }

  /// POST /api/v1/profiles/verification/creator - Persists creator verification to PostgreSQL
  Future<void> submitCreatorVerification(
    String platform,
    String handle,
    String code,
  ) async {
    final response = await _httpClient
        .post(
          _buildUri('/profiles/verification/creator'),
          headers: _headers(),
          body: jsonEncode({
            'platform': platform,
            'handle': handle,
            'code': code,
          }),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to submit creator verification: ${response.statusCode} - ${response.body}',
      );
    }
  }

  /// POST /api/v1/profiles/verification/brand - Persists brand verification to PostgreSQL
  Future<void> submitBrandVerification({
    required String businessName,
    required String regNumber,
    required String person,
    required List<String> documents,
  }) async {
    final response = await _httpClient
        .post(
          _buildUri('/profiles/verification/brand'),
          headers: _headers(),
          body: jsonEncode({
            'businessName': businessName,
            'regNumber': regNumber,
            'person': person,
            'documents': documents,
          }),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to submit brand verification: ${response.statusCode} - ${response.body}',
      );
    }
  }

  /// GET /api/v1/profiles/verification/status - Retrieves real verification state from PostgreSQL
  Future<Map<String, dynamic>?> getVerificationStatus() async {
    final response = await _httpClient
        .get(_buildUri('/profiles/verification/status'), headers: _headers())
        .timeout(_requestTimeout);
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    return null;
  }

  /// POST /api/v1/auth/sync - Synchronize secondary role
  Future<void> syncSecondaryRole(String roleApiValue) async {
    final response = await _httpClient
        .post(
          _buildUri('/auth/sync'),
          headers: _headers(),
          body: jsonEncode({'preferredRole': roleApiValue}),
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to sync secondary role: ${response.statusCode} - ${response.body}',
      );
    }
  }
}
