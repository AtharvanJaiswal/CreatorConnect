import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:creatorconnect/core/errors/app_exception.dart';
import 'package:creatorconnect/core/errors/app_error_handler.dart';
import 'package:creatorconnect/core/widgets/dialogs/app_error_dialog.dart';
import 'package:creatorconnect/core/widgets/app_button.dart';
import 'package:creatorconnect/core/widgets/offline_screen.dart';
import 'package:creatorconnect/core/network/api_client.dart';
import 'package:creatorconnect/core/network/connectivity_service.dart';
import 'package:creatorconnect/features/chat/domain/entities/chat_entities.dart';
import 'package:creatorconnect/features/chat/presentation/widgets/pinned_brief_banner_widget.dart';

void main() {
  group('1. RFC 7807 & Centralized AppErrorHandler Tests', () {
    test('Correctly maps HTTP 400 with RFC 7807 problem details to ValidationException', () {
      final dioEx = DioException(
        requestOptions: RequestOptions(path: '/api/v1/auth/sync'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/auth/sync'),
          statusCode: 400,
          data: {
            'type': 'https://api.creatorconnect.com/errors/validation',
            'title': 'Invalid Request Payload',
            'status': 400,
            'detail': 'Field "preferredRole" must be CREATOR or PODCASTER',
            'code': 'VALIDATION_FAILED',
            'requestId': 'req-val-123',
          },
        ),
      );

      final appEx = AppErrorHandler.parse(dioEx);
      expect(appEx, isA<ValidationException>());
      expect(appEx.statusCode, 400);
      expect(appEx.code, 'VALIDATION_FAILED');
      expect(appEx.requestId, 'req-val-123');
      expect(appEx.message, 'Field "preferredRole" must be CREATOR or PODCASTER');
    });

    test('Correctly maps HTTP 401 to UnauthorizedException with AUTH_TOKEN_EXPIRED', () {
      final dioEx = DioException(
        requestOptions: RequestOptions(path: '/api/v1/users/me'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/users/me'),
          statusCode: 401,
          data: {
            'title': 'Session Expired',
            'detail': 'JWT token has expired',
            'code': 'AUTH_TOKEN_EXPIRED',
            'requestId': 'req-auth-401',
          },
        ),
      );

      final appEx = AppErrorHandler.parse(dioEx);
      expect(appEx, isA<UnauthorizedException>());
      expect(appEx.statusCode, 401);
      expect(appEx.code, 'AUTH_TOKEN_EXPIRED');
      expect(appEx.message, 'JWT token has expired');
    });

    test('Correctly maps HTTP 403 to ForbiddenException', () {
      final dioEx = DioException(
        requestOptions: RequestOptions(path: '/api/v1/connections/request'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/connections/request'),
          statusCode: 403,
          data: {
            'title': 'Limit Exceeded',
            'detail': 'Daily connection quota of 5 reached',
            'code': 'QUOTA_EXCEEDED',
          },
        ),
      );

      final appEx = AppErrorHandler.parse(dioEx);
      expect(appEx, isA<ForbiddenException>());
      expect(appEx.statusCode, 403);
      expect(appEx.code, 'QUOTA_EXCEEDED');
      expect(appEx.message, contains('Daily connection quota'));
    });

    test('Correctly maps HTTP 404 to ResourceNotFoundException', () {
      final dioEx = DioException(
        requestOptions: RequestOptions(path: '/api/v1/invitations/inv-999'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/invitations/inv-999'),
          statusCode: 404,
          data: {
            'title': 'Not Found',
            'detail': 'Invitation inv-999 does not exist',
            'code': 'INVITATION_NOT_FOUND',
          },
        ),
      );

      final appEx = AppErrorHandler.parse(dioEx);
      expect(appEx, isA<ResourceNotFoundException>());
      expect(appEx.statusCode, 404);
      expect(appEx.code, 'INVITATION_NOT_FOUND');
    });

    test('Correctly maps HTTP 409 to ConflictException', () {
      final dioEx = DioException(
        requestOptions: RequestOptions(path: '/api/v1/auth/sync'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/auth/sync'),
          statusCode: 409,
          data: {
            'title': 'Identity Conflict',
            'detail': 'User already registered with different credential',
            'code': 'IDENTITY_CONFLICT',
          },
        ),
      );

      final appEx = AppErrorHandler.parse(dioEx);
      expect(appEx, isA<ConflictException>());
      expect(appEx.statusCode, 409);
      expect(appEx.code, 'IDENTITY_CONFLICT');
    });

    test('Correctly maps HTTP 500 to ServerException', () {
      final dioEx = DioException(
        requestOptions: RequestOptions(path: '/api/v1/profiles/creator'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/profiles/creator'),
          statusCode: 500,
          data: {
            'title': 'Database Error',
            'detail': 'Database connection pool exhausted',
            'code': 'DB_POOL_ERROR',
          },
        ),
      );

      final appEx = AppErrorHandler.parse(dioEx);
      expect(appEx, isA<ServerException>());
      expect(appEx.statusCode, 500);
      expect(appEx.code, 'DB_POOL_ERROR');
    });

    test('Correctly maps connection timeout to NetworkTimeoutException', () {
      final dioEx = DioException(
        requestOptions: RequestOptions(path: '/api/v1/home/dashboard'),
        type: DioExceptionType.connectionTimeout,
        message: 'Connection timed out',
      );

      final appEx = AppErrorHandler.parse(dioEx);
      expect(appEx, isA<NetworkTimeoutException>());
      expect(appEx.code, 'TIMEOUT');
    });

    test('Correctly maps SocketException to OfflineException', () {
      final socketEx = const SocketException('OS Error: Network unreachable');
      final appEx = AppErrorHandler.parse(socketEx);
      expect(appEx, isA<OfflineException>());
      expect(appEx.code, 'OFFLINE');
    });
  });

  group('2. AppErrorDialog Modal Presentation & Actions Tests', () {
    testWidgets('Renders AppErrorDialog with RFC 7807 metadata and triggers onRetry', (tester) async {
      bool retryTriggered = false;
      final exception = const ServerException(
        title: 'Server Unavailable',
        message: 'Could not connect to database pool.',
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        requestId: 'req-srv-789',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => AppErrorDialog.show(
                  ctx,
                  exception: exception,
                  onRetry: () => retryTriggered = true,
                ),
                child: const Text('Trigger Error'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Trigger Error'));
      await tester.pumpAndSettle();

      // Verify Title and Guidance
      expect(find.text('Server Unavailable'), findsOneWidget);
      expect(find.text('Could not connect to database pool.'), findsOneWidget);

      // Verify Technical Badge
      expect(find.text('HTTP Status: 503'), findsOneWidget);
      expect(find.text('Error Code: SERVICE_UNAVAILABLE'), findsOneWidget);
      expect(find.text('Request ID: req-srv-789'), findsOneWidget);

      // Verify Actions
      expect(find.text('Dismiss'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      // Tap Retry
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      expect(retryTriggered, isTrue);
      expect(find.byType(AppErrorDialog), findsNothing);
    });
  });

  group('3. Single-Flight Mutation Deduplication Tests', () {
    test('MutationDeduplicationInterceptor deduplicates concurrent identical mutations', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://mock-api.local'));
      dio.interceptors.add(MutationDeduplicationInterceptor());

      int networkCallCount = 0;
      dio.httpClientAdapter = _MockHttpClientAdapter((options) async {
        networkCallCount++;
        await Future.delayed(const Duration(milliseconds: 50));
        return ResponseBody.fromString(
          '{"success": true}',
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      });

      // Fire 3 simultaneous identical POST mutation requests
      final future1 = dio.post('/api/v1/connections/request', data: {'targetUserId': 'usr-123'});
      final future2 = dio.post('/api/v1/connections/request', data: {'targetUserId': 'usr-123'});
      final future3 = dio.post('/api/v1/connections/request', data: {'targetUserId': 'usr-123'});

      final results = await Future.wait([future1, future2, future3]);

      // All 3 callers must succeed
      for (final res in results) {
        expect(res.statusCode, 200);
        expect(res.data['success'], true);
      }

      // Exactly 1 underlying network call made
      expect(networkCallCount, 1);
    });

    test('MutationDeduplicationInterceptor does not block sequential requests after completion', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://mock-api.local'));
      dio.interceptors.add(MutationDeduplicationInterceptor());

      int networkCallCount = 0;
      dio.httpClientAdapter = _MockHttpClientAdapter((options) async {
        networkCallCount++;
        return ResponseBody.fromString('{"count": $networkCallCount}', 200);
      });

      final res1 = await dio.post('/api/v1/auth/sync', data: {'role': 'CREATOR'});
      final res2 = await dio.post('/api/v1/auth/sync', data: {'role': 'CREATOR'});

      expect(res1.statusCode, 200);
      expect(res2.statusCode, 200);
      expect(networkCallCount, 2);
    });
  });

  group('4. Button Multi-Tap Debounce & Layout Tests', () {
    testWidgets('AppButton multi-tap debounce blocks rapid double-clicks within 500ms', (tester) async {
      int tapCount = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppButton(
              text: 'Save Changes',
              onPressed: () => tapCount++,
            ),
          ),
        ),
      );

      // Perform 3 rapid taps without advancing simulated clock
      await tester.tap(find.text('Save Changes'));
      await tester.tap(find.text('Save Changes'));
      await tester.tap(find.text('Save Changes'));
      await tester.pump();

      // Only the first tap should register
      expect(tapCount, 1);

      // Advance clock past 500ms cooldown
      await tester.pump(const Duration(milliseconds: 600));

      // Next tap should now execute
      await tester.tap(find.text('Save Changes'));
      await tester.pump(const Duration(milliseconds: 600));
      expect(tapCount, 2);
    });

    testWidgets('PinnedBriefBannerWidget wraps and elides text without overflow on 320dp width', (tester) async {
      tester.view.physicalSize = const Size(320 * 3.0, 640 * 3.0);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const brief = PinnedBriefContext(
        id: 'brief-long-title',
        title: 'Super Long Collaboration Brief Title for YouTube and Instagram Video Shoot',
        budgetRange: '₹45,000–₹80,000 INR',
        location: 'Bandra West, Mumbai MMR, Maharashtra',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 320,
              child: PinnedBriefBannerWidget(
                brief: brief,
                onViewBrief: () {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(PinnedBriefBannerWidget), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('5. OfflineScreen & Network Recovery Widget Tests', () {
    testWidgets('OfflineScreen renders informative guidance and triggers manual retry', (tester) async {
      bool retryClicked = false;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            networkConnectivityProvider.overrideWith(
              (ref) => NetworkConnectivityNotifier(ref, enablePeriodicMonitoring: false),
            ),
          ],
          child: MaterialApp(
            home: OfflineScreen(
              onRetry: () => retryClicked = true,
            ),
          ),
        ),
      );

      expect(find.text('No Connection Found'), findsOneWidget);
      expect(find.textContaining('drafts, profile data, and cached feeds remain safely preserved'), findsOneWidget);
      expect(find.byType(AppButton), findsOneWidget);

      await tester.tap(find.byType(AppButton));
      await tester.pump(const Duration(milliseconds: 600));

      expect(tester.takeException(), isNull);
      expect(retryClicked, isTrue);
    });
  });
}

class _MockHttpClientAdapter implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions options) handler;

  _MockHttpClientAdapter(this.handler);

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) {
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}
