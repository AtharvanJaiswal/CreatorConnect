import 'package:supabase_flutter/supabase_flutter.dart';
import '../entities/user_role.dart';

abstract class AuthRepository {
  Future<void> sendPhoneOtp(String fullPhoneNumber);
  Future<AuthResponse> verifyPhoneOtp({
    required String fullPhoneNumber,
    required String token,
    required UserRole selectedRole,
  });
  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    required UserRole selectedRole,
  });
  Future<bool> signInWithGoogle();
  Future<AuthResponse> signInWithPassword({
    required String emailOrPhone,
    required String password,
  });
  Future<void> sendPasswordResetEmail(String email);
  Future<UserResponse> updatePassword(String newPassword);
  Future<void> signOut();

  /// Returns true if an active Supabase session is present
  bool get isAuthenticated;

  /// Checks if the user has already seen and passed the onboarding slides
  Future<bool> hasCompletedOnboarding();

  /// Marks onboarding as completed so returning users bypass onboarding
  Future<void> setOnboardingCompleted({bool completed = true});

  /// Resets onboarding status
  Future<void> clearOnboarding();
}

