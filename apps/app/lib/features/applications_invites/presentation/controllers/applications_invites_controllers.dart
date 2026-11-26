import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/applications_invites_repository.dart';
import '../../domain/entities/application_entities.dart';
import '../../domain/entities/invitation_entities.dart';

/// Tab filter for H02 My Applications
enum ApplicationTabFilter {
  active('Active'),
  shortlisted('Shortlisted'),
  accepted('Accepted'),
  closed('Closed');

  final String label;
  const ApplicationTabFilter(this.label);
}

final applicationTabFilterProvider =
    StateProvider<ApplicationTabFilter>((ref) => ApplicationTabFilter.active);

/// State for My Applications list
class ApplicationsListState {
  final bool isLoading;
  final List<ApplicationModel> applications;
  final String? errorMessage;

  const ApplicationsListState({
    this.isLoading = false,
    this.applications = const [],
    this.errorMessage,
  });

  ApplicationsListState copyWith({
    bool? isLoading,
    List<ApplicationModel>? applications,
    String? errorMessage,
  }) {
    return ApplicationsListState(
      isLoading: isLoading ?? this.isLoading,
      applications: applications ?? this.applications,
      errorMessage: errorMessage,
    );
  }
}

class ApplicationsListNotifier extends StateNotifier<ApplicationsListState> {
  final ApplicationsInvitesRepository _repository;

  ApplicationsListNotifier(this._repository)
      : super(const ApplicationsListState()) {
    loadApplications();
  }

  Future<void> loadApplications() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final list = await _repository.getMyApplications();
      state = state.copyWith(isLoading: false, applications: list);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  Future<bool> withdrawApplication(String id) async {
    final success = await _repository.withdrawApplication(id);
    if (success) {
      await loadApplications();
    }
    return success;
  }
}

final applicationsListProvider =
    StateNotifierProvider<ApplicationsListNotifier, ApplicationsListState>((ref) {
  final repo = ref.watch(applicationsInvitesRepositoryProvider);
  return ApplicationsListNotifier(repo);
});

/// Filtered applications based on selected tab
final filteredApplicationsProvider = Provider<List<ApplicationModel>>((ref) {
  final all = ref.watch(applicationsListProvider).applications;
  final filter = ref.watch(applicationTabFilterProvider);

  switch (filter) {
    case ApplicationTabFilter.active:
      return all.where((a) => a.isActive).toList();
    case ApplicationTabFilter.shortlisted:
      return all.where((a) => a.isShortlisted).toList();
    case ApplicationTabFilter.accepted:
      return all.where((a) => a.isAccepted).toList();
    case ApplicationTabFilter.closed:
      return all.where((a) => a.isClosed).toList();
  }
});

/// Quota Controller for H01 & DLG-49
class ApplicationQuotaNotifier extends StateNotifier<AsyncValue<MonthlyQuotaInfo>> {
  final ApplicationsInvitesRepository _repository;

  ApplicationQuotaNotifier(this._repository)
      : super(const AsyncValue.loading()) {
    refreshQuota();
  }

  Future<void> refreshQuota() async {
    try {
      final q = await _repository.getMonthlyQuota();
      state = AsyncValue.data(q);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final applicationQuotaProvider =
    StateNotifierProvider<ApplicationQuotaNotifier, AsyncValue<MonthlyQuotaInfo>>(
        (ref) {
  final repo = ref.watch(applicationsInvitesRepositoryProvider);
  return ApplicationQuotaNotifier(repo);
});

/// Tab filter for Invites (Received vs Sent)
enum InvitesTabFilter { received, sent }

final invitesTabFilterProvider =
    StateProvider<InvitesTabFilter>((ref) => InvitesTabFilter.received);

/// Invitations State
class InvitationsState {
  final bool isLoading;
  final List<InvitationModel> received;
  final List<InvitationModel> sent;
  final String? errorMessage;

  const InvitationsState({
    this.isLoading = false,
    this.received = const [],
    this.sent = const [],
    this.errorMessage,
  });

  InvitationsState copyWith({
    bool? isLoading,
    List<InvitationModel>? received,
    List<InvitationModel>? sent,
    String? errorMessage,
  }) {
    return InvitationsState(
      isLoading: isLoading ?? this.isLoading,
      received: received ?? this.received,
      sent: sent ?? this.sent,
      errorMessage: errorMessage,
    );
  }
}

class InvitationsNotifier extends StateNotifier<InvitationsState> {
  final ApplicationsInvitesRepository _repository;

  InvitationsNotifier(this._repository) : super(const InvitationsState()) {
    loadAll();
  }

  Future<void> loadAll() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final rec = await _repository.getReceivedInvites();
      final snt = await _repository.getSentInvites();
      state = state.copyWith(isLoading: false, received: rec, sent: snt);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  Future<bool> acceptInvite(String id) async {
    final ok = await _repository.acceptInvite(id);
    if (ok) await loadAll();
    return ok;
  }

  Future<bool> declineInvite(String id, String? reason) async {
    final ok = await _repository.declineInvite(id, reason);
    if (ok) await loadAll();
    return ok;
  }

  Future<bool> cancelInvite(String id) async {
    final ok = await _repository.cancelInvite(id);
    if (ok) await loadAll();
    return ok;
  }
}

final invitationsProvider =
    StateNotifierProvider<InvitationsNotifier, InvitationsState>((ref) {
  final repo = ref.watch(applicationsInvitesRepositoryProvider);
  return InvitationsNotifier(repo);
});
