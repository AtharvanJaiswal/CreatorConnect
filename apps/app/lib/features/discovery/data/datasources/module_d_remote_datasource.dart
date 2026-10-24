import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/config/env_config.dart';
import '../../domain/entities/discovery_entities.dart';

class ModuleDRemoteDataSource {
  final Dio _dio;

  ModuleDRemoteDataSource({Dio? dio})
      : _dio = dio ?? _createDefaultDio();

  static Dio _createDefaultDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: EnvironmentConfig.current.apiBaseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          try {
            final token = Supabase.instance.client.auth.currentSession?.accessToken;
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (_) {}
          return handler.next(options);
        },
      ),
    );

    return dio;
  }

  // Connection quota tracking (5 per day on Free tier per SOW §17)
  static const String _quotaRemainingKey = 'cc_connections_quota_remaining';
  static const String _quotaDateKey = 'cc_connections_quota_date';
  static int _dailyConnectionsRemaining = 5;
  static int get dailyConnectionsRemaining => _dailyConnectionsRemaining;

  static Future<void> initQuota() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final todayStr = DateTime.now().toUtc().toIso8601String().substring(0, 10);
      final savedDate = prefs.getString(_quotaDateKey);
      if (savedDate != todayStr) {
        _dailyConnectionsRemaining = 5;
        await prefs.setString(_quotaDateKey, todayStr);
        await prefs.setInt(_quotaRemainingKey, 5);
      } else {
        _dailyConnectionsRemaining = prefs.getInt(_quotaRemainingKey) ?? 5;
      }
    } catch (_) {}
  }

  // 1. Dashboard
  Future<Map<String, dynamic>> getHomeDashboard({String? role, String? userId}) async {
    final response = await _dio.get(
      '/api/v1/home/dashboard',
      queryParameters: {
        if (role != null) 'role': role,
        if (userId != null) 'userId': userId,
      },
    );
    if (response.statusCode == 200 && response.data != null) {
      final data = Map<String, dynamic>.from(response.data as Map);
      if (data.containsKey('recommendations') && !data.containsKey('recommendedProfiles')) {
        data['recommendedProfiles'] = data['recommendations'];
      }
      if (data.containsKey('opportunities') && !data.containsKey('nearbyOpportunities')) {
        data['nearbyOpportunities'] = data['opportunities'];
      }
      if (data.containsKey('campaignPipeline') && !data.containsKey('activeCampaigns')) {
        data['activeCampaigns'] = data['campaignPipeline'];
      }
      return data;
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to load home dashboard from backend',
    );
  }

  // 2. Discover / Search with CancelToken & Filter params
  Future<List<ProfileCardModel>> getDiscover({
    required FilterState filter,
    String? query,
    CancelToken? cancelToken,
  }) async {
    final queryParams = <String, dynamic>{
      'role': filter.role.keyName,
      'verifiedOnly': filter.verifiedOnly,
      'availableNow': filter.availableImmediately,
      'hasPortfolio': filter.hasPortfolio,
      'minRating': filter.minRating,
      'minRate': filter.minBudget.toInt(),
      'maxRate': filter.maxBudget.toInt(),
      'sort': filter.sortOption,
    };
    if (query != null && query.trim().isNotEmpty) {
      queryParams['q'] = query.trim();
    }
    if (filter.city != null && filter.city!.isNotEmpty) {
      queryParams['city'] = filter.city;
    }
    if (filter.categories.isNotEmpty) {
      queryParams['category'] = filter.categories.first;
    }

    final response = await _dio.get(
      '/api/v1/discover',
      queryParameters: queryParams,
      cancelToken: cancelToken,
    );

    if (response.statusCode == 200 && response.data != null) {
      final data = response.data as Map<String, dynamic>;
      final items = data['items'] as List<dynamic>? ?? [];
      return items.map((e) => ProfileCardModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to fetch discovery results from backend',
    );
  }

  // 3. Autocomplete
  Future<List<AutocompleteSuggestion>> getAutocomplete(String prefix, {CancelToken? cancelToken}) async {
    if (prefix.trim().isEmpty) return [];
    try {
      final response = await _dio.get(
        '/api/v1/search/autocomplete',
        queryParameters: {'q': prefix.trim()},
        cancelToken: cancelToken,
      );
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        if (data['suggestions'] is List) {
          final suggestions = data['suggestions'] as List<dynamic>;
          return suggestions
              .map((e) => AutocompleteSuggestion.fromJson(e as Map<String, dynamic>))
              .toList();
        }
        final list = <AutocompleteSuggestion>[];
        if (data['niches'] is List) {
          for (final n in (data['niches'] as List)) {
            list.add(AutocompleteSuggestion(text: n.toString(), category: 'Niche', icon: '🎨'));
          }
        }
        if (data['skills'] is List) {
          for (final s in (data['skills'] as List)) {
            list.add(AutocompleteSuggestion(text: s.toString(), category: 'Skill', icon: '⚡'));
          }
        }
        if (data['locations'] is List) {
          for (final l in (data['locations'] as List)) {
            list.add(AutocompleteSuggestion(text: l.toString(), category: 'Location', icon: '📍'));
          }
        }
        if (data['profiles'] is List) {
          for (final p in (data['profiles'] as List)) {
            final m = p as Map<String, dynamic>;
            list.add(AutocompleteSuggestion(
              text: '${m['name']} (${m['handle']})',
              category: 'Profile',
              icon: '👤',
            ));
          }
        }
        if (list.isNotEmpty) return list;
      }
    } catch (e) {
      if (e is DioException && CancelToken.isCancel(e)) {
        return [];
      }
      debugPrint('ModuleDRemoteDataSource.getAutocomplete error: $e');
    }
    return [];
  }

  // 4. Recommendations ("For You" - SOW §13 Rule-based)
  Future<List<ProfileCardModel>> getRecommendations({CancelToken? cancelToken}) async {
    final response = await _dio.get(
      '/api/v1/discover/recommendations',
      cancelToken: cancelToken,
    );
    if (response.statusCode == 200 && response.data != null) {
      final data = response.data as Map<String, dynamic>;
      final rawItems = data['recommendations'] ?? data['items'] ?? [];
      final items = rawItems as List<dynamic>;
      return items.map((e) => ProfileCardModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to fetch recommendations from backend',
    );
  }

  // 5. Public Profile
  Future<PublicProfileModel> getPublicProfile(String id) async {
    final response = await _dio.get('/api/v1/profile/$id');
    if (response.statusCode == 200 && response.data != null) {
      return PublicProfileModel.fromJson(response.data as Map<String, dynamic>);
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to fetch public profile from backend for ID: $id',
    );
  }

  // 6. Connect Request (Quota checked)
  Future<bool> sendConnectionRequest(String targetUserId, {String? note}) async {
    await initQuota();
    if (_dailyConnectionsRemaining <= 0) {
      return false; // Quota ceiling reached (POP-D02)
    }

    final response = await _dio.post(
      '/api/v1/connections/request',
      data: {
        'targetUserId': targetUserId,
        'note': note ?? 'Hi, I would love to collaborate on upcoming campaigns!',
      },
    );
    if (response.statusCode == 200) {
      final data = response.data as Map<String, dynamic>?;
      if (data?['remainingQuota'] is int) {
        _dailyConnectionsRemaining = data!['remainingQuota'] as int;
      } else {
        _dailyConnectionsRemaining = (_dailyConnectionsRemaining - 1).clamp(0, 5);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_quotaRemainingKey, _dailyConnectionsRemaining);
      return true;
    }
    return false;
  }

  // 7. Block User (POP-D04)
  Future<bool> blockUser(String targetUserId, {String? reason}) async {
    final response = await _dio.post(
      '/api/v1/users/block',
      data: {
        'targetUserId': targetUserId,
        'reason': reason ?? 'Blocked via profile options',
      },
    );
    return response.statusCode == 200;
  }

  // 8. Report User (POP-D05)
  Future<bool> reportUser(String targetUserId, String reason, String details) async {
    final validCategory = reason.toUpperCase().replaceAll(' ', '_');
    final validDetails = details.trim().length >= 10 ? details.trim() : '$details (submitted via app)';
    final response = await _dio.post(
      '/api/v1/reports',
      data: {
        'targetType': 'USER',
        'targetId': targetUserId,
        'category': validCategory,
        'details': validDetails,
      },
    );
    return response.statusCode == 200;
  }

  // 9. Notifications (D04)
  Future<List<NotificationItemModel>> getNotifications() async {
    try {
      final response = await _dio.get('/api/v1/notifications');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
        return list.map((e) => NotificationItemModel.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (e) {
      debugPrint('ModuleDRemoteDataSource.getNotifications error: $e');
    }
    return [];
  }
}
