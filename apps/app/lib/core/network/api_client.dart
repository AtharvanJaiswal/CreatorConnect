import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../features/auth/data/datasources/auth_local_datasource.dart';
import '../config/env_config.dart';

class ApiClient {
  ApiClient._();

  /// Retrieves an active valid Supabase token, refreshing it if expired.
  static Future<String?> getValidAccessToken() async {
    try {
      final auth = Supabase.instance.client.auth;
      final session = auth.currentSession;
      if (session == null) return null;
      if (session.isExpired) {
        final res = await auth.refreshSession();
        return res.session?.accessToken ?? session.accessToken;
      }
      return session.accessToken;
    } catch (_) {
      return null;
    }
  }

  /// Builds standardized headers for HTTP / Dio requests.
  static Future<Map<String, String>> buildHeaders([String? customToken]) async {
    final token = customToken ?? await getValidAccessToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  /// Fast probe across local candidate hosts (192.168.1.42 Wi-Fi LAN, 127.0.0.1 adb reverse, 10.0.2.2 emulator).
  static Future<void> probeBestLocalHost() async {
    if (kIsWeb || EnvironmentConfig.currentEnv != AppEnvironment.local) return;
    const candidates = ['192.168.1.42', '127.0.0.1', '10.0.2.2', '192.168.1.108'];
    final tempDio = Dio(
      BaseOptions(
        connectTimeout: const Duration(milliseconds: 1500),
        receiveTimeout: const Duration(milliseconds: 1500),
      ),
    );

    bool resolved = false;
    await Future.wait(candidates.map((host) async {
      try {
        final res = await tempDio.get('http://$host:3000/health');
        if (res.statusCode == 200 && !resolved) {
          resolved = true;
          EnvironmentConfig.setActiveHost(host);
          debugPrint('ApiClient: Verified reachable backend host -> $host:3000');
        }
      } catch (_) {
        // Probe candidate unavailable
      }
    }));
  }

  /// Creates a standard Dio client with path normalization, token injection, and timeout handling.
  static Dio createDio({Duration timeout = const Duration(seconds: 10)}) {
    final dio = Dio(
      BaseOptions(
        connectTimeout: timeout,
        receiveTimeout: timeout,
        sendTimeout: timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(MutationDeduplicationInterceptor());
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Normalize URI to ensure it maps to http://<host>:3000/api/v1/<endpoint>
          final normalizedUrl = EnvironmentConfig.normalizeApiUrl(options.path);
          options.path = normalizedUrl;
          options.baseUrl = ''; // URL is now fully qualified

          try {
            final token = await getValidAccessToken();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (e) {
            debugPrint('ApiClient: Error resolving auth token: $e');
          }

          options.headers['Content-Type'] ??= 'application/json';
          options.headers['Accept'] ??= 'application/json';

          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          final res = error.response;
          final req = error.requestOptions;

          // 1. Handle 401 Unauthorized (Identity not synced or stale session)
          if (res?.statusCode == 401 && req.extra['retried_401'] != true) {
            final data = res?.data;
            final isNotSynced = (data is Map && (data['code'] == 'IDENTITY_NOT_SYNCED' || data['error'] == 'IDENTITY_NOT_SYNCED')) ||
                (data.toString().contains('IDENTITY_NOT_SYNCED') || data.toString().contains('not synchronized'));

            final isInvalidToken = (data is Map && (data['code'] == 'AUTH_INVALID_TOKEN' || data['code'] == 'AUTH_TOKEN_EXPIRED')) ||
                (data.toString().contains('AUTH_INVALID_TOKEN') || data.toString().contains('Invalid Authentication Token'));

            // Auto-provision Supabase identity to backend PostgreSQL on 401 IDENTITY_NOT_SYNCED
            if (isNotSynced) {
              try {
                debugPrint('ApiClient: 401 IDENTITY_NOT_SYNCED detected -> Auto-syncing identity to PostgreSQL...');
                final token = await getValidAccessToken();
                if (token != null && token.isNotEmpty) {
                  final syncUrl = EnvironmentConfig.normalizeApiUrl('/api/v1/auth/sync');
                  final syncDio = Dio(
                    BaseOptions(
                      connectTimeout: const Duration(seconds: 4),
                      receiveTimeout: const Duration(seconds: 4),
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer $token',
                      },
                    ),
                  );
                  final savedRole = await AuthLocalDataSource().getSelectedRole();
                  final effectiveRole = (savedRole != null && savedRole.isNotEmpty) ? savedRole.toUpperCase() : 'CREATOR';
                  await syncDio.post(syncUrl, data: {'preferredRole': effectiveRole});
                  debugPrint('ApiClient: Auto-sync completed -> Retrying request');

                  req.extra['retried_401'] = true;
                  req.headers['Authorization'] = 'Bearer $token';
                  final retriedResponse = await dio.fetch(req);
                  return handler.resolve(retriedResponse);
                }
              } catch (e) {
                debugPrint('ApiClient: Auto-sync attempt failed: $e');
              }
            }

            // Stale or unrecognized token on optional-auth endpoints (e.g. /home/dashboard)
            if (isInvalidToken && req.path.contains('/home/dashboard')) {
              try {
                debugPrint('ApiClient: Stale token on dashboard -> Retrying anonymously...');
                req.extra['retried_401'] = true;
                req.headers.remove('Authorization');
                final anonResponse = await dio.fetch(req);
                return handler.resolve(anonResponse);
              } catch (_) {}
            }
          }

          // 2. If connection failed on local development, try candidate fallback hosts
          final isConnError = error.type == DioExceptionType.connectionError ||
              error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.sendTimeout;

          final isAlreadyRetried = req.extra['retried_fallback'] == true;

          if (isConnError && !isAlreadyRetried && EnvironmentConfig.currentEnv == AppEnvironment.local) {
            final uri = Uri.tryParse(req.path);
            if (uri != null) {
              const candidates = ['192.168.1.42', '127.0.0.1', '10.0.2.2', '192.168.1.108'];
              for (final candidate in candidates) {
                if (candidate == uri.host) continue;
                try {
                  final newPath = req.path.replaceFirst('${uri.host}:${uri.port}', '$candidate:${uri.port}');
                  final fallbackOptions = Options(
                    method: req.method,
                    headers: req.headers,
                    responseType: req.responseType,
                    contentType: req.contentType,
                    extra: {...req.extra, 'retried_fallback': true},
                  );
                  final response = await dio.request(
                    newPath,
                    data: req.data,
                    queryParameters: req.queryParameters,
                    options: fallbackOptions,
                  );
                  EnvironmentConfig.setActiveHost(candidate);
                  debugPrint('ApiClient: Successfully fell back to $candidate');
                  return handler.resolve(response);
                } catch (_) {
                  // Continue to next candidate
                }
              }
            }
          }

          debugPrint(
            'ApiClient Error [${error.requestOptions.method} ${error.requestOptions.path}]: '
            '${error.response?.statusCode} - ${error.message}',
          );
          return handler.next(error);
        },
      ),
    );

    return dio;
  }
}

/// Central single-flight mutation deduplication interceptor.
/// Prevents concurrent identical requests (POST, PUT, PATCH, DELETE) from double-submitting
/// to PostgreSQL, instead sharing the in-flight Future or safely resolving the identical response.
class MutationDeduplicationInterceptor extends Interceptor {
  static final Map<String, Completer<Response>> _inFlightMutations = {};

  static String _requestFingerprint(RequestOptions options) {
    try {
      if (options.data is FormData) {
        return '${options.method.toUpperCase()}:${options.path}:FORMDATA';
      }
      return '${options.method.toUpperCase()}:${options.path}:${jsonEncode(options.data ?? {})}';
    } catch (_) {
      return '${options.method.toUpperCase()}:${options.path}:${options.data.hashCode}';
    }
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final method = options.method.toUpperCase();
    final isMutation = method == 'POST' || method == 'PUT' || method == 'PATCH' || method == 'DELETE';

    if (!isMutation) {
      return handler.next(options);
    }

    final key = _requestFingerprint(options);
    if (_inFlightMutations.containsKey(key)) {
      debugPrint('ApiClient: Single-Flight -> Deduplicating concurrent mutation: $key');
      try {
        final existing = await _inFlightMutations[key]!.future;
        return handler.resolve(existing);
      } catch (e) {
        if (e is DioException) return handler.reject(e);
        return handler.reject(DioException(
          requestOptions: options,
          error: e.toString(),
          type: DioExceptionType.cancel,
        ));
      }
    }

    final completer = Completer<Response>();
    _inFlightMutations[key] = completer;
    options.extra['mutation_fingerprint'] = key;

    return handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final key = response.requestOptions.extra['mutation_fingerprint'] as String?;
    if (key != null && _inFlightMutations.containsKey(key)) {
      final completer = _inFlightMutations.remove(key);
      if (completer != null && !completer.isCompleted) {
        completer.complete(response);
      }
    }
    return handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final key = err.requestOptions.extra['mutation_fingerprint'] as String?;
    if (key != null && _inFlightMutations.containsKey(key)) {
      final completer = _inFlightMutations.remove(key);
      if (completer != null && !completer.isCompleted) {
        completer.completeError(err);
      }
    }
    return handler.next(err);
  }
}


