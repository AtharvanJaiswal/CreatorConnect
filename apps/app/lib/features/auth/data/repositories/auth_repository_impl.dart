import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../profile/data/datasources/profile_local_datasource.dart';
import '../../../profile/data/repositories/profile_repository_impl.dart';
import '../../domain/entities/user_role.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_datasource.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _dataSource;
  final AuthLocalDataSource _localDataSource;

  AuthRepositoryImpl({
    AuthRemoteDataSource? dataSource,
    AuthLocalDataSource? localDataSource,
  })  : _dataSource = dataSource ?? AuthRemoteDataSource(),
        _localDataSource = localDataSource ?? AuthLocalDataSource();

  Future<void> _syncBackendBestEffort({
    required String preferredRole,
    String? customToken,
  }) async {
    try {
      final syncData = await _dataSource.syncBackendUser(
        preferredRole: preferredRole,
        customToken: customToken,
      );

      final userObj = syncData['user'] as Map<String, dynamic>?;
      if (userObj != null && userObj['id'] != null) {
        await _localDataSource.saveCurrentUserId(userObj['id'].toString());
      }
      final rolesList = userObj?['roles'] as List<dynamic>?;
      if (rolesList != null && rolesList.isNotEmpty) {
        final dbRole = rolesList.first.toString().toUpperCase();
        await _localDataSource.saveSelectedRole(dbRole);
      }
    } on IdentityConflictException {
      rethrow;
    } catch (e) {
      // Allow authenticated Supabase session to proceed when local backend
      // host (e.g. 10.0.2.2 on physical device) or DB pooler is unreachable.
      debugPrint('Notice: Backend auth sync skipped/failed (proceeding locally): $e');
    }
  }

  /// Synchronizes current active Supabase session with PostgreSQL database.
  Future<void> syncSession([String? role]) async {
    final effectiveRole = role ?? await _localDataSource.getSelectedRole() ?? 'CREATOR';
    await _syncBackendBestEffort(preferredRole: effectiveRole);
  }

  @override
  bool get isAuthenticated => _dataSource.hasActiveSession;


  @override
  Future<bool> hasCompletedOnboarding() {
    return _localDataSource.hasCompletedOnboarding();
  }

  @override
  Future<void> setOnboardingCompleted({bool completed = true}) {
    return _localDataSource.setOnboardingCompleted(completed: completed);
  }

  @override
  Future<void> clearOnboarding() {
    return _localDataSource.clearOnboarding();
  }

  @override
  Future<void> sendPhoneOtp(String fullPhoneNumber) {
    return _dataSource.sendPhoneOtp(fullPhoneNumber);
  }

  @override
  Future<AuthResponse> verifyPhoneOtp({
    required String fullPhoneNumber,
    required String token,
    required UserRole selectedRole,
  }) async {
    final response = await _dataSource.verifyPhoneOtp(
      fullPhoneNumber: fullPhoneNumber,
      token: token,
      role: selectedRole.apiValue,
    );

    // Save persona role locally and mark onboarding completed
    await _localDataSource.saveSelectedRole(selectedRole.apiValue);
    await _localDataSource.setOnboardingCompleted(completed: true);

    // Synchronize persona role to backend PostgreSQL user model
    await _syncBackendBestEffort(
      preferredRole: selectedRole.apiValue,
      customToken: response.session?.accessToken,
    );

    // Invalidate in-memory singleton state and reload freshly for new user
    ProfileRepositoryImpl.resetForTesting();
    try {
      await ProfileRepositoryImpl.instance.reloadFromBackend();
    } catch (_) {}

    return response;
  }

  @override
  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    required UserRole selectedRole,
  }) async {
    final response = await _dataSource.signUpWithEmail(
      email: email,
      password: password,
      role: selectedRole.apiValue,
    );

    // Mark onboarding completed for successfully registered user
    await _localDataSource.saveSelectedRole(selectedRole.apiValue);
    await _localDataSource.setOnboardingCompleted(completed: true);

    // If session returned immediately (auto-confirm or instant session), sync role
    if (response.session?.accessToken != null) {
      await _syncBackendBestEffort(
        preferredRole: selectedRole.apiValue,
        customToken: response.session?.accessToken,
      );
    }

    // Invalidate in-memory singleton state and reload freshly for new user
    ProfileRepositoryImpl.resetForTesting();
    try {
      await ProfileRepositoryImpl.instance.reloadFromBackend();
    } catch (_) {}

    return response;
  }

  @override
  Future<bool> signInWithGoogle() async {
    final success = await _dataSource.signInWithGoogle();
    if (success) {
      await _localDataSource.setOnboardingCompleted(completed: true);
      final savedRole = await _localDataSource.getSelectedRole();
      await _syncBackendBestEffort(
        preferredRole: savedRole ?? UserRole.creator.apiValue,
      );

      ProfileRepositoryImpl.resetForTesting();
      try {
        await ProfileRepositoryImpl.instance.reloadFromBackend();
      } catch (_) {}
    }
    return success;
  }

  @override
  Future<AuthResponse> signInWithPassword({
    required String emailOrPhone,
    required String password,
  }) async {
    final response = await _dataSource.signInWithPassword(
      emailOrPhone: emailOrPhone,
      password: password,
    );

    // Mark onboarding completed on successful login
    await _localDataSource.setOnboardingCompleted(completed: true);

    final savedRole = await _localDataSource.getSelectedRole();
    final metaRole = response.user?.userMetadata?['role'] as String?;
    final effectiveRole = (savedRole != null && savedRole.trim().isNotEmpty)
        ? savedRole.trim().toUpperCase()
        : ((metaRole != null && metaRole.trim().isNotEmpty)
            ? metaRole.trim().toUpperCase()
            : UserRole.creator.apiValue);
    await _localDataSource.saveSelectedRole(effectiveRole);

    // Best-effort sync with backend without blocking redirect on local timeout
    if (response.session?.accessToken != null) {
      await _syncBackendBestEffort(
        preferredRole: effectiveRole,
        customToken: response.session?.accessToken,
      );
    }

    // Invalidate in-memory singleton state and reload freshly for new user
    ProfileRepositoryImpl.resetForTesting();
    try {
      await ProfileRepositoryImpl.instance.reloadFromBackend();
    } catch (_) {}

    return response;
  }

  @override
  Future<void> sendPasswordResetEmail(String email) {
    return _dataSource.sendPasswordResetEmail(email);
  }

  @override
  Future<UserResponse> updatePassword(String newPassword) {
    return _dataSource.updatePassword(newPassword);
  }

  @override
  Future<void> signOut() async {
    await _dataSource.signOut();
    await _localDataSource.clearOnboarding();
    await ProfileLocalDataSource().clearAll();
    ProfileRepositoryImpl.resetForTesting();
  }
}

