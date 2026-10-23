import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:creatorconnect/core/utils/phone_utils.dart';
import 'package:creatorconnect/features/discovery/domain/entities/discovery_entities.dart';
import 'package:creatorconnect/features/discovery/data/datasources/module_d_remote_datasource.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Module A & B: Phone Number Normalization Tests', () {
    test('extractTenDigitNumber correctly extracts 10 digits from various valid inputs', () {
      expect(PhoneUtils.extractTenDigitNumber('9876543210'), '9876543210');
      expect(PhoneUtils.extractTenDigitNumber('+91 98765 43210'), '9876543210');
      expect(PhoneUtils.extractTenDigitNumber('09876543210'), '9876543210');
      expect(PhoneUtils.extractTenDigitNumber('919876543210'), '9876543210');
      expect(PhoneUtils.extractTenDigitNumber('+91-98765-43210'), '9876543210');
    });

    test('extractTenDigitNumber rejects invalid lengths', () {
      expect(PhoneUtils.extractTenDigitNumber('12345'), isNull);
      expect(PhoneUtils.extractTenDigitNumber('987654321000'), isNull);
    });

    test('toE164 normalizes Indian mobile to +91XXXXXXXXXX format', () {
      expect(PhoneUtils.toE164('9876543210'), '+919876543210');
      expect(PhoneUtils.toE164('+91 98765 43210'), '+919876543210');
      expect(PhoneUtils.toE164('09876543210'), '+919876543210');
      expect(PhoneUtils.toE164('919876543210'), '+919876543210');
    });

    test('isValidIndianMobile validates starting digit (6, 7, 8, 9)', () {
      expect(PhoneUtils.isValidIndianMobile('9876543210'), isTrue);
      expect(PhoneUtils.isValidIndianMobile('8123456789'), isTrue);
      expect(PhoneUtils.isValidIndianMobile('7012345678'), isTrue);
      expect(PhoneUtils.isValidIndianMobile('6398765432'), isTrue);
      expect(PhoneUtils.isValidIndianMobile('5123456789'), isFalse);
      expect(PhoneUtils.isValidIndianMobile('1234567890'), isFalse);
    });

    test('formatForDisplay splits into 5 and 5 digits', () {
      expect(PhoneUtils.formatForDisplay('9876543210'), '98765 43210');
    });
  });

  group('Module D: SOW §17 Connection Quota Persistence Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('initQuota resets quota to 5 on new day and persists', () async {
      await ModuleDRemoteDataSource.initQuota();
      expect(ModuleDRemoteDataSource.dailyConnectionsRemaining, 5);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getInt('cc_connections_quota_remaining'), 5);
      expect(prefs.getString('cc_connections_quota_date'), isNotNull);
    });

    test('sendConnectionRequest decrements quota and persists to storage', () async {
      SharedPreferences.setMockInitialValues({
        'cc_connections_quota_remaining': 5,
        'cc_connections_quota_date': DateTime.now().toUtc().toIso8601String().substring(0, 10),
      });

      final testDio = Dio();
      testDio.interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) {
          return handler.resolve(Response(
            requestOptions: options,
            statusCode: 200,
            data: {'remainingQuota': 4},
          ));
        },
      ));
      final ds = ModuleDRemoteDataSource(dio: testDio);
      final success = await ds.sendConnectionRequest('user-target-123');
      expect(success, isTrue);
      expect(ModuleDRemoteDataSource.dailyConnectionsRemaining, 4);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getInt('cc_connections_quota_remaining'), 4);
    });

    test('sendConnectionRequest rejects when quota reaches 0', () async {
      SharedPreferences.setMockInitialValues({
        'cc_connections_quota_remaining': 0,
        'cc_connections_quota_date': DateTime.now().toUtc().toIso8601String().substring(0, 10),
      });

      final ds = ModuleDRemoteDataSource();
      final success = await ds.sendConnectionRequest('user-target-123');
      expect(success, isFalse);
    });
  });

  group('Module D: Schema Harmonization & Robust JSON Parsing Tests', () {
    test('OpportunityBrief parses string and int budget values safely without crashing', () {
      final jsonFromStringBudget = {
        'id': 'opp-str',
        'title': 'Test Campaign',
        'brandName': 'Test Brand',
        'brandAvatar': 'https://example.com/logo.png',
        'budget': '₹8,000–₹15,000',
        'location': 'Mumbai',
        'daysLeft': 3,
        'deliverable': '1 Dedicated Reel',
        'appliedCount': 10,
      };

      final brief = OpportunityBrief.fromJson(jsonFromStringBudget);
      expect(brief.id, 'opp-str');
      expect(brief.budget, 800015000);
      expect(brief.brandLogo, 'https://example.com/logo.png');
      expect(brief.deliverableType, '1 Dedicated Reel');
      expect(brief.deadline, '3 days left');
      expect(brief.applicantsCount, 10);
    });

    test('BrandBriefProgress parses appliedCount and maxApplicants safely', () {
      final json = {
        'id': 'brief-1',
        'title': 'Launch Campaign',
        'appliedCount': 22,
        'maxApplicants': 50,
        'daysLeft': 5,
        'status': 'ACTIVE',
      };

      final progress = BrandBriefProgress.fromJson(json);
      expect(progress.applicantsCount, 22);
      expect(progress.targetApplicants, 50);
      expect(progress.deadline, '5 days left');
      expect(progress.progressRatio, 0.44);
    });

    test('PublicProfileModel parses integer followersCount without TypeError', () {
      final json = {
        'id': '01923456-789a-bcde-f012-3456789abcde',
        'userId': '01923456-789a-bcde-f012-3456789abcde',
        'name': 'Priya Patel',
        'handle': '@priya',
        'role': 'CREATOR',
        'followersCount': 185000,
        'verified': true,
        'skills': ['Fashion', 'Video Editing'],
      };

      final profile = PublicProfileModel.fromJson(json);
      expect(profile.followersCount, '185.0K');
      expect(profile.isVerified, isTrue);
      expect(profile.deliverableTags, contains('Fashion'));
      expect(profile.deliverableTags, contains('Video Editing'));
    });

    test('ProfileCardModel maps backend category, bioSnippet, and matchReason', () {
      final json = {
        'id': '01999999-0000-7000-8000-000000000001',
        'name': 'Aanya Sharma',
        'handle': '@aanya',
        'role': 'CREATOR',
        'category': 'Fashion & Styling',
        'bioSnippet': 'Sustainable stylist based in Mumbai',
        'matchReason': 'Matches your niche: Fashion',
        'rateMin': 22000,
        'verified': true,
      };

      final card = ProfileCardModel.fromJson(json);
      expect(card.niche, 'Fashion & Styling');
      expect(card.bio, 'Sustainable stylist based in Mumbai');
      expect(card.isVerified, isTrue);
      expect(card.startingRate, 22000);
      expect(card.matchReasons.length, 1);
      expect(card.matchReasons.first.label, 'Matches your niche: Fashion');
    });

    test('NotificationItemModel computes relative time from createdAt and handles readAt null', () {
      final json = {
        'id': 'notif-100',
        'title': 'New Connection',
        'message': 'Sameer sent a connection request',
        'type': 'CONNECTION_REQUEST',
        'readAt': null,
        'createdAt': DateTime.now().subtract(const Duration(minutes: 15)).toIso8601String(),
      };

      final notif = NotificationItemModel.fromJson(json);
      expect(notif.isUnread, isTrue);
      expect(notif.timeAgo, '15m ago');
      expect(notif.type, 'CONNECTION');
    });
  });
}
