import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/config/env_config.dart';
import '../../../../core/utils/phone_utils.dart';

class IdentityConflictException implements Exception {
  final String message;
  const IdentityConflictException(this.message);

  @override
  String toString() => message;
}

class AuthRemoteDataSource {
  static const Duration _supabaseTimeout = Duration(seconds: 12);
  static const Duration _syncTimeout = Duration(milliseconds: 2500);

  final SupabaseClient? _client;
  final http.Client _httpClient;

  AuthRemoteDataSource({SupabaseClient? client, http.Client? httpClient})
    : _client = client,
      _httpClient = httpClient ?? http.Client();

  SupabaseClient get _supabase {
    if (_client != null) return _client;
    try {
      return Supabase.instance.client;
    } catch (_) {
      throw Exception(
        'Supabase client not initialized. Check EnvironmentConfig.',
      );
    }
  }

  /// Checks if an active authenticated Supabase session exists
  bool get hasActiveSession {
    try {
      if (_client != null) return _client.auth.currentSession != null;
      return Supabase.instance.client.auth.currentSession != null;
    } catch (_) {
      return false;
    }
  }

  /// Sends a 6-digit SMS OTP via Supabase GoTrue Auth
  Future<void> sendPhoneOtp(String fullPhoneNumber, {String? role}) async {
    final normalized = PhoneUtils.toE164(fullPhoneNumber) ?? fullPhoneNumber;
    try {
      await _supabase.auth
          .signInWithOtp(
            phone: normalized,
            data: role != null ? {'role': role} : null,
          )
          .timeout(_supabaseTimeout);
    } on TimeoutException {
      throw 'Request timed out. Please check your internet connection and try again.';
    } on AuthException catch (e) {
      debugPrint('Supabase Auth error sending OTP: ${e.message}');
      throw e.message;
    } catch (e) {
      debugPrint('Unexpected error sending OTP: $e');
      throw 'Unable to send OTP. Please verify your phone number and try again.';
    }
  }

  /// Verifies the 6-digit SMS OTP code
  Future<AuthResponse> verifyPhoneOtp({
    required String fullPhoneNumber,
    required String token,
    String? role,
  }) async {
    final normalized = PhoneUtils.toE164(fullPhoneNumber) ?? fullPhoneNumber;
    try {
      final response = await _supabase.auth
          .verifyOTP(phone: normalized, token: token, type: OtpType.sms)
          .timeout(_supabaseTimeout);
      if (role != null) {
        try {
          await _supabase.auth
              .updateUser(UserAttributes(data: {'role': role}))
              .timeout(_syncTimeout);
        } catch (_) {}
      }
      return response;
    } on TimeoutException {
      throw 'Verification timed out. Please check your internet connection and try again.';
    } on AuthException catch (e) {
      debugPrint('Supabase Auth error verifying OTP: ${e.message}');
      throw e.message;
    } catch (e) {
      debugPrint('Unexpected error verifying OTP: $e');
      throw 'That code is incorrect or expired. Please check and try again.';
    }
  }

  /// Registers user with Email & Password
  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    String? role,
  }) async {
    try {
      final response = await _supabase.auth
          .signUp(
            email: email,
            password: password,
            data: role != null ? {'role': role} : null,
          )
          .timeout(_supabaseTimeout);
      return response;
    } on TimeoutException {
      throw 'Registration timed out. Please check your internet connection and try again.';
    } on AuthException catch (e) {
      debugPrint('Supabase Auth error sign up: ${e.message}');
      throw e.message;
    } catch (e) {
      debugPrint('Unexpected error during sign up: $e');
      throw 'Could not create account. Please check your credentials.';
    }
  }

  /// Synchronizes the Supabase user identity to internal PostgreSQL backend
  /// via POST /api/v1/auth/sync
  Future<Map<String, dynamic>> syncBackendUser({
    required String preferredRole,
    String? customToken,
  }) async {
    final token = customToken ?? _supabase.auth.currentSession?.accessToken;
    if (token == null || token.isEmpty) {
      debugPrint(
        'Warning: No Supabase session token available for backend sync',
      );
      return {'isNewUser': true, 'synced': false};
    }

    final url = EnvironmentConfig.normalizeApiUri('/auth/sync');

    final response = await _httpClient
        .post(
          url,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({'preferredRole': preferredRole}),
        )
        .timeout(_syncTimeout);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return {'synced': true};
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else if (response.statusCode == 409) {
      debugPrint('Backend sync identity conflict (HTTP 409): ${response.body}');
      throw const IdentityConflictException(
        'An account with this email already exists under another login method.',
      );
    } else {
      throw Exception(
        'Backend database synchronization failed (HTTP ${response.statusCode}).',
      );
    }
  }

  /// Initiates Google OAuth Sign-in
  Future<bool> signInWithGoogle() async {
    try {
      final res = await _supabase.auth
          .signInWithOAuth(
            OAuthProvider.google,
            redirectTo: kIsWeb ? null : 'creatorconnect://auth-callback',
          )
          .timeout(_supabaseTimeout);
      return res;
    } on TimeoutException {
      throw 'Google Sign-in timed out. Please try again.';
    } catch (e) {
      debugPrint('Google OAuth error: $e');
      throw 'Google Sign-in could not be completed.';
    }
  }

  /// Unified Login accepting email or mobile
  Future<AuthResponse> signInWithPassword({
    required String emailOrPhone,
    required String password,
  }) async {
    final trimmed = emailOrPhone.trim();
    final isEmail = trimmed.contains('@');

    try {
      if (isEmail) {
        return await _supabase.auth
            .signInWithPassword(email: trimmed, password: password)
            .timeout(_supabaseTimeout);
      } else {
        final fullPhone =
            PhoneUtils.toE164(trimmed) ??
            (trimmed.startsWith('+') ? trimmed : '+$trimmed');
        return await _supabase.auth
            .signInWithPassword(phone: fullPhone, password: password)
            .timeout(_supabaseTimeout);
      }
    } on TimeoutException {
      throw 'Login timed out. Please check your internet connection and try again.';
    } on AuthException catch (e) {
      debugPrint('Supabase Auth login error: ${e.message}');
      throw e.message;
    } catch (e) {
      debugPrint('Unexpected error during login: $e');
      throw 'Invalid login credentials. Please check and try again.';
    }
  }

  /// Sends password recovery link to email
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _supabase.auth
          .resetPasswordForEmail(
            email.trim(),
            redirectTo: kIsWeb ? null : 'creatorconnect://reset-callback',
          )
          .timeout(_supabaseTimeout);
    } on TimeoutException {
      throw 'Password reset request timed out. Please try again.';
    } on AuthException catch (e) {
      debugPrint('Supabase Auth reset password error: ${e.message}');
      throw e.message;
    } catch (e) {
      debugPrint('Unexpected error sending reset password: $e');
      throw 'Unable to send reset email. Please try again later.';
    }
  }

  /// Updates current user's password
  Future<UserResponse> updatePassword(String newPassword) async {
    try {
      final res = await _supabase.auth
          .updateUser(UserAttributes(password: newPassword))
          .timeout(_supabaseTimeout);
      return res;
    } on TimeoutException {
      throw 'Password update timed out. Please try again.';
    } on AuthException catch (e) {
      debugPrint('Supabase Auth update password error: ${e.message}');
      throw e.message;
    } catch (e) {
      debugPrint('Unexpected error updating password: $e');
      throw 'Could not update password. Please try again.';
    }
  }

  /// Signs out user and clears session
  Future<void> signOut() async {
    try {
      await _supabase.auth.signOut();
    } catch (e) {
      debugPrint('Error signing out: $e');
    }
  }
}
