import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/datasources/settings_remote_datasource.dart';
import '../../data/repositories/settings_repository_impl.dart';
import '../../domain/entities/settings_entities.dart';
import '../../domain/repositories/settings_repository.dart';

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  return SettingsRepositoryImpl();
});

// -----------------------------------------------------------------------------
// 1. Blocked Users Controller
// -----------------------------------------------------------------------------
class BlockedUsersState {
  final List<BlockedUserModel> users;
  final bool isLoading;
  final String? error;

  const BlockedUsersState({
    this.users = const [],
    this.isLoading = true,
    this.error,
  });

  BlockedUsersState copyWith({
    List<BlockedUserModel>? users,
    bool? isLoading,
    String? error,
  }) {
    return BlockedUsersState(
      users: users ?? this.users,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class BlockedUsersNotifier extends StateNotifier<BlockedUsersState> {
  final SettingsRepository _repository;

  BlockedUsersNotifier(this._repository) : super(const BlockedUsersState()) {
    loadBlockedUsers();
  }

  Future<void> loadBlockedUsers() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final list = await _repository.getBlockedUsers();
      state = state.copyWith(users: list, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  Future<bool> unblockUser(String blockIdOrUserId) async {
    try {
      await _repository.unblockUser(blockIdOrUserId);
      final updated = state.users.where((u) => u.id != blockIdOrUserId && u.blockedUserId != blockIdOrUserId).toList();
      state = state.copyWith(users: updated);
      return true;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return false;
    }
  }
}

final blockedUsersProvider = StateNotifierProvider<BlockedUsersNotifier, BlockedUsersState>((ref) {
  final repo = ref.watch(settingsRepositoryProvider);
  return BlockedUsersNotifier(repo);
});

// -----------------------------------------------------------------------------
// 2. Notification Preferences Controller
// -----------------------------------------------------------------------------
class NotificationPreferencesState {
  final NotificationPreferenceSetting preferences;
  final bool isLoading;
  final bool isSaving;
  final String? message;
  final String? error;

  const NotificationPreferencesState({
    this.preferences = const NotificationPreferenceSetting(),
    this.isLoading = true,
    this.isSaving = false,
    this.message,
    this.error,
  });

  NotificationPreferencesState copyWith({
    NotificationPreferenceSetting? preferences,
    bool? isLoading,
    bool? isSaving,
    String? message,
    String? error,
  }) {
    return NotificationPreferencesState(
      preferences: preferences ?? this.preferences,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      message: message,
      error: error,
    );
  }
}

class NotificationPreferencesNotifier extends StateNotifier<NotificationPreferencesState> {
  final SettingsRepository _repository;

  NotificationPreferencesNotifier(this._repository) : super(const NotificationPreferencesState()) {
    loadPreferences();
  }

  Future<void> loadPreferences() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final prefs = await _repository.getNotificationPreferences();
      state = state.copyWith(preferences: prefs, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  void updatePreference(NotificationPreferenceSetting newSetting) {
    state = state.copyWith(preferences: newSetting);
  }

  Future<bool> savePreferences() async {
    state = state.copyWith(isSaving: true, message: null, error: null);
    try {
      await _repository.updateNotificationPreferences(state.preferences);
      state = state.copyWith(isSaving: false, message: 'Notification preferences saved successfully');
      return true;
    } catch (e) {
      state = state.copyWith(isSaving: false, error: e.toString());
      return false;
    }
  }
}

final notificationPreferencesControllerProvider =
    StateNotifierProvider<NotificationPreferencesNotifier, NotificationPreferencesState>((ref) {
  final repo = ref.watch(settingsRepositoryProvider);
  return NotificationPreferencesNotifier(repo);
});

// -----------------------------------------------------------------------------
// 3. Privacy & Visibility Controller
// -----------------------------------------------------------------------------
class PrivacySettingsState {
  final PrivacySettingsModel settings;
  final bool isLoading;
  final bool isSaving;
  final String? message;
  final String? error;

  const PrivacySettingsState({
    this.settings = const PrivacySettingsModel(),
    this.isLoading = true,
    this.isSaving = false,
    this.message,
    this.error,
  });

  PrivacySettingsState copyWith({
    PrivacySettingsModel? settings,
    bool? isLoading,
    bool? isSaving,
    String? message,
    String? error,
  }) {
    return PrivacySettingsState(
      settings: settings ?? this.settings,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      message: message,
      error: error,
    );
  }
}

class PrivacySettingsNotifier extends StateNotifier<PrivacySettingsState> {
  final SettingsRepository _repository;

  PrivacySettingsNotifier(this._repository) : super(const PrivacySettingsState()) {
    loadSettings();
  }

  Future<void> loadSettings() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final s = await _repository.getPrivacySettings();
      state = state.copyWith(settings: s, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  void updateSettings(PrivacySettingsModel updated) {
    state = state.copyWith(settings: updated);
    _repository.updatePrivacySettings(updated);
  }
}

final privacySettingsControllerProvider =
    StateNotifierProvider<PrivacySettingsNotifier, PrivacySettingsState>((ref) {
  final repo = ref.watch(settingsRepositoryProvider);
  return PrivacySettingsNotifier(repo);
});

// -----------------------------------------------------------------------------
// 4. Device Sessions Controller
// -----------------------------------------------------------------------------
class DeviceSessionsState {
  final List<DeviceSessionModel> sessions;
  final bool isLoading;
  final String? error;

  const DeviceSessionsState({
    this.sessions = const [],
    this.isLoading = true,
    this.error,
  });

  DeviceSessionsState copyWith({
    List<DeviceSessionModel>? sessions,
    bool? isLoading,
    String? error,
  }) {
    return DeviceSessionsState(
      sessions: sessions ?? this.sessions,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class DeviceSessionsNotifier extends StateNotifier<DeviceSessionsState> {
  final SettingsRepository _repository;

  DeviceSessionsNotifier(this._repository) : super(const DeviceSessionsState()) {
    loadSessions();
  }

  Future<void> loadSessions() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final list = await _repository.getActiveSessions();
      state = state.copyWith(sessions: list, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  Future<void> revokeOtherSessions() async {
    await _repository.revokeOtherSessions();
    state = state.copyWith(
      sessions: state.sessions.where((s) => s.isCurrent).toList(),
    );
  }

  Future<void> revokeSession(String id) async {
    await _repository.revokeSession(id);
    state = state.copyWith(
      sessions: state.sessions.where((s) => s.id != id).toList(),
    );
  }
}

final deviceSessionsControllerProvider =
    StateNotifierProvider<DeviceSessionsNotifier, DeviceSessionsState>((ref) {
  final repo = ref.watch(settingsRepositoryProvider);
  return DeviceSessionsNotifier(repo);
});

// -----------------------------------------------------------------------------
// 5. Support Tickets Controller
// -----------------------------------------------------------------------------
class SupportTicketState {
  final List<SupportTicketModel> tickets;
  final bool isLoading;
  final bool isSubmitting;
  final SupportTicketModel? lastCreatedTicket;
  final String? error;

  const SupportTicketState({
    this.tickets = const [],
    this.isLoading = false,
    this.isSubmitting = false,
    this.lastCreatedTicket,
    this.error,
  });

  SupportTicketState copyWith({
    List<SupportTicketModel>? tickets,
    bool? isLoading,
    bool? isSubmitting,
    SupportTicketModel? lastCreatedTicket,
    String? error,
  }) {
    return SupportTicketState(
      tickets: tickets ?? this.tickets,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      lastCreatedTicket: lastCreatedTicket ?? this.lastCreatedTicket,
      error: error,
    );
  }
}

class SupportTicketNotifier extends StateNotifier<SupportTicketState> {
  final SettingsRepository _repository;

  SupportTicketNotifier(this._repository) : super(const SupportTicketState());

  Future<void> loadTickets() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final items = await _repository.getMyTickets();
      state = state.copyWith(tickets: items, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  Future<SupportTicketModel?> submitTicket({
    required SupportCategory category,
    required String subject,
    required String description,
    String? linkedAssignmentId,
    int? escrowAmount,
  }) async {
    state = state.copyWith(isSubmitting: true, error: null);
    try {
      final ticket = await _repository.createSupportTicket(
        category: category,
        subject: subject,
        description: description,
        linkedAssignmentId: linkedAssignmentId,
        escrowAmount: escrowAmount,
      );
      state = state.copyWith(
        isSubmitting: false,
        lastCreatedTicket: ticket,
        tickets: [ticket, ...state.tickets],
      );
      return ticket;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, error: e.toString());
      return null;
    }
  }
}

final supportTicketControllerProvider =
    StateNotifierProvider<SupportTicketNotifier, SupportTicketState>((ref) {
  final repo = ref.watch(settingsRepositoryProvider);
  return SupportTicketNotifier(repo);
});

// -----------------------------------------------------------------------------
// 6. Account Lifecycle & Erasure Controller
// -----------------------------------------------------------------------------
class AccountLifecycleState {
  final bool isLoading;
  final bool isDeactivated;
  final ErasureRequestStatusModel? erasureStatus;
  final bool hasEscrowConflict;
  final String? conflictDetails;
  final String? error;

  const AccountLifecycleState({
    this.isLoading = false,
    this.isDeactivated = false,
    this.erasureStatus,
    this.hasEscrowConflict = false,
    this.conflictDetails,
    this.error,
  });

  AccountLifecycleState copyWith({
    bool? isLoading,
    bool? isDeactivated,
    ErasureRequestStatusModel? erasureStatus,
    bool? hasEscrowConflict,
    String? conflictDetails,
    String? error,
  }) {
    return AccountLifecycleState(
      isLoading: isLoading ?? this.isLoading,
      isDeactivated: isDeactivated ?? this.isDeactivated,
      erasureStatus: erasureStatus ?? this.erasureStatus,
      hasEscrowConflict: hasEscrowConflict ?? this.hasEscrowConflict,
      conflictDetails: conflictDetails,
      error: error,
    );
  }
}

class AccountLifecycleNotifier extends StateNotifier<AccountLifecycleState> {
  final SettingsRepository _repository;

  AccountLifecycleNotifier(this._repository) : super(const AccountLifecycleState()) {
    checkErasureStatus();
  }

  Future<void> checkErasureStatus() async {
    try {
      final status = await _repository.getErasureStatus();
      if (status != null) {
        state = state.copyWith(erasureStatus: status);
      }
    } catch (_) {}
  }

  Future<bool> deactivate({String? reason}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.deactivateAccount(reason: reason);
      state = state.copyWith(isLoading: false, isDeactivated: true);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> reactivate() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.reactivateAccount();
      state = state.copyWith(isLoading: false, isDeactivated: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<ErasureRequestStatusModel?> requestErasure({String? reason, bool testForceConflict = false}) async {
    state = state.copyWith(isLoading: true, error: null, hasEscrowConflict: false);
    try {
      if (testForceConflict) {
        throw const EscrowLiabilityConflictException();
      }
      final result = await _repository.requestAccountErasure(reason: reason);
      state = state.copyWith(isLoading: false, erasureStatus: result);
      return result;
    } on EscrowLiabilityConflictException {
      state = state.copyWith(
        isLoading: false,
        hasEscrowConflict: true,
        conflictDetails:
            'You have 1 active assignment ("Summer Reels Campaign 2026") with ₹12,000 locked in escrow. All assignments must be completed or closed before account termination.',
      );
      return null;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return null;
    }
  }

  Future<bool> confirmErasure(String confirmationCode) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.confirmErasure(confirmationCode);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> cancelErasure(String reason) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.cancelErasure(reason);
      state = state.copyWith(isLoading: false, erasureStatus: null);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }
}

final accountLifecycleControllerProvider =
    StateNotifierProvider<AccountLifecycleNotifier, AccountLifecycleState>((ref) {
  final repo = ref.watch(settingsRepositoryProvider);
  return AccountLifecycleNotifier(repo);
});
