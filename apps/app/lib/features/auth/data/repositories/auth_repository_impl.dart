import 'package:supabase_flutter/supabase_flutter.dart';
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
    final syncData = await _dataSource.syncBackendUser(
      preferredRole: selectedRole.apiValue,
      customToken: response.session?.accessToken,
    );

    final userObj = syncData['user'] as Map<String, dynamic>?;
    final rolesList = userObj?['roles'] as List<dynamic>?;
    if (rolesList != null && rolesList.isNotEmpty) {
      final dbRole = rolesList.first.toString().toUpperCase();
      await _localDataSource.saveSelectedRole(dbRole);
    }

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
      final syncData = await _dataSource.syncBackendUser(
        preferredRole: selectedRole.apiValue,
        customToken: response.session?.accessToken,
      );

      final userObj = syncData['user'] as Map<String, dynamic>?;
      final rolesList = userObj?['roles'] as List<dynamic>?;
      if (rolesList != null && rolesList.isNotEmpty) {
        final dbRole = rolesList.first.toString().toUpperCase();
        await _localDataSource.saveSelectedRole(dbRole);
      }
    }

    return response;
  }

  @override
  Future<bool> signInWithGoogle() async {
    final success = await _dataSource.signInWithGoogle();
    if (success) {
      await _localDataSource.setOnboardingCompleted(completed: true);
      final savedRole = await _localDataSource.getSelectedRole();
      final syncData = await _dataSource.syncBackendUser(
        preferredRole: savedRole ?? UserRole.creator.apiValue,
      );
      final userObj = syncData['user'] as Map<String, dynamic>?;
      final rolesList = userObj?['roles'] as List<dynamic>?;
      if (rolesList != null && rolesList.isNotEmpty) {
        final dbRole = rolesList.first.toString().toUpperCase();
        await _localDataSource.saveSelectedRole(dbRole);
      }
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

    // Synchronize persona role to backend PostgreSQL user model
    final savedRole = await _localDataSource.getSelectedRole();
    if (response.session?.accessToken != null) {
      final syncData = await _dataSource.syncBackendUser(
        preferredRole: savedRole ?? UserRole.creator.apiValue,
        customToken: response.session?.accessToken,
      );

      final userObj = syncData['user'] as Map<String, dynamic>?;
      final rolesList = userObj?['roles'] as List<dynamic>?;
      if (rolesList != null && rolesList.isNotEmpty) {
        final dbRole = rolesList.first.toString().toUpperCase();
        await _localDataSource.saveSelectedRole(dbRole);
      }
    }

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
  Future<void> signOut() {
    return _dataSource.signOut();
  }
}

