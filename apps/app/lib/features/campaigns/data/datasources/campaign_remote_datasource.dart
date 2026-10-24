import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/config/env_config.dart';
import '../../domain/entities/campaign_entities.dart';

class CampaignRemoteDataSource {
  final Dio _dio;

  CampaignRemoteDataSource({Dio? dio}) : _dio = dio ?? _createDefaultDio();

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

  // ---------------------------------------------------------------------------
  // 1. Briefs / Assignments (E01, E07)
  // ---------------------------------------------------------------------------

  Future<List<CampaignBrief>> getAssignments({
    String? status,
    String? category,
    String? query,
    bool forBrand = false,
  }) async {
    final response = await _dio.get(
      '/api/v1/assignments',
      queryParameters: {
        if (status != null) 'status': status,
        if (category != null) 'category': category,
        if (query != null && query.isNotEmpty) 'q': query,
        if (forBrand) 'brandOnly': 'true',
      },
    );

    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      return list.map((e) => CampaignBrief.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to fetch assignments from backend',
    );
  }

  Future<CampaignBrief?> getAssignmentDetail(String id) async {
    final response = await _dio.get('/api/v1/assignments/$id');
    if (response.statusCode == 200 && response.data != null) {
      return CampaignBrief.fromJson(response.data as Map<String, dynamic>);
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to fetch assignment detail: $id',
    );
  }

  Future<CampaignBrief> createAssignment(CampaignBrief brief, {bool publishImmediately = false}) async {
    final response = await _dio.post(
      '/api/v1/assignments',
      data: {
        'title': brief.title,
        'description': brief.description,
        'category': brief.category,
        'budgetType': brief.budgetType.key,
        'budgetMin': brief.budgetMin,
        'budgetMax': brief.budgetMax,
        'deadline': brief.deadline,
        'location': brief.location,
        'deliverableTypes': brief.deliverableTypes,
        'status': publishImmediately ? 'PUBLISHED' : 'DRAFT',
      },
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return CampaignBrief.fromJson(response.data as Map<String, dynamic>);
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      error: 'Failed to create assignment on backend',
    );
  }

  Future<bool> publishAssignment(String id) async {
    final response = await _dio.post('/api/v1/assignments/$id/publish');
    return response.statusCode == 200;
  }

  Future<bool> acceptApplication(
    String briefId,
    String applicationId, {
    required int finalRate,
    List<MilestoneItem> milestones = const [],
  }) async {
    final response = await _dio.post(
      '/api/v1/assignments/$briefId/accept',
      data: {
        'applicationId': applicationId,
        'finalRate': finalRate,
        'milestones': milestones.map((m) => m.toJson()).toList(),
      },
    );
    return response.statusCode == 200;
  }

  // ---------------------------------------------------------------------------
  // 2. Applications / Proposals (E06, E08, E10, E11)
  // ---------------------------------------------------------------------------

  Future<List<ApplicationItem>> getBriefApplicants(String briefId, {String? status}) async {
    final response = await _dio.get(
      '/api/v1/assignments/$briefId/applications',
      queryParameters: {if (status != null) 'status': status},
    );
    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      return list.map((e) => ApplicationItem.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<List<ApplicationItem>> getMyApplications({String? status}) async {
    final response = await _dio.get(
      '/api/v1/applications/me',
      queryParameters: {if (status != null) 'status': status},
    );
    if (response.statusCode == 200 && response.data != null) {
      final data = response.data;
      final list = (data is List ? data : (data is Map && data['items'] is List ? data['items'] : [])) as List<dynamic>;
      return list.map((e) => ApplicationItem.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<ApplicationItem?> getApplicationDetail(String id) async {
    final response = await _dio.get('/api/v1/applications/$id');
    if (response.statusCode == 200 && response.data != null) {
      return ApplicationItem.fromJson(response.data as Map<String, dynamic>);
    }
    return null;
  }

  Future<bool> submitApplication({
    required String briefId,
    required int proposedRate,
    required String coverLetter,
    required int estimatedDays,
    List<String> portfolioLinks = const [],
  }) async {
    final response = await _dio.post(
      '/api/v1/assignments/$briefId/applications',
      data: {
        'proposedRate': proposedRate,
        'coverLetter': coverLetter,
        'deliverablesEstimatedDays': estimatedDays,
        'portfolioLinks': portfolioLinks,
      },
    );
    return response.statusCode == 200 || response.statusCode == 201;
  }

  Future<bool> updateApplicantStatus(
    String applicationId,
    ApplicationStatus status, {
    String? rejectionReason,
  }) async {
    final response = await _dio.patch(
      '/api/v1/applications/$applicationId/status',
      data: {
        'status': status.key,
        if (rejectionReason != null) 'rejectionReason': rejectionReason,
      },
    );
    return response.statusCode == 200;
  }

  Future<bool> withdrawApplication(String applicationId) async {
    final response = await _dio.post('/api/v1/applications/$applicationId/withdraw');
    return response.statusCode == 200;
  }
}

