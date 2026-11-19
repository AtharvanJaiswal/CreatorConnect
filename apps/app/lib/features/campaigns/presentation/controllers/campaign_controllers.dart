import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/campaign_entities.dart';
import '../../domain/repositories/campaign_repository.dart';
import '../../data/repositories/campaign_repository_impl.dart';

final campaignRepositoryProvider = Provider<CampaignRepository>((ref) {
  return CampaignRepositoryImpl.instance;
});

// -----------------------------------------------------------------------------
// 1. Brand Briefs Dashboard Controller (E01)
// -----------------------------------------------------------------------------

class BrandBriefsState {
  final List<CampaignBrief> briefs;
  final String selectedTab; // 'ACTIVE', 'DRAFTS', 'PAST', 'ALL'
  final bool isLoading;
  final String? errorMessage;

  const BrandBriefsState({
    this.briefs = const [],
    this.selectedTab = 'ACTIVE',
    this.isLoading = false,
    this.errorMessage,
  });

  List<CampaignBrief> get filteredBriefs {
    if (selectedTab == 'ACTIVE') {
      return briefs.where((b) => b.status == CampaignStatus.published || b.status == CampaignStatus.inProgress).toList();
    }
    if (selectedTab == 'DRAFTS') {
      return briefs.where((b) => b.status == CampaignStatus.draft).toList();
    }
    if (selectedTab == 'PAST') {
      return briefs.where((b) => b.status == CampaignStatus.completed || b.status == CampaignStatus.closed).toList();
    }
    return briefs;
  }

  BrandBriefsState copyWith({
    List<CampaignBrief>? briefs,
    String? selectedTab,
    bool? isLoading,
    String? errorMessage,
  }) {
    return BrandBriefsState(
      briefs: briefs ?? this.briefs,
      selectedTab: selectedTab ?? this.selectedTab,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class BrandBriefsNotifier extends StateNotifier<BrandBriefsState> {
  final CampaignRepository _repo;

  BrandBriefsNotifier(this._repo) : super(const BrandBriefsState()) {
    loadBriefs();
  }

  Future<void> loadBriefs() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final list = await _repo.getBrandBriefs();
      state = state.copyWith(briefs: list, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  void setTab(String tab) {
    state = state.copyWith(selectedTab: tab);
  }

  Future<void> publishBrief(String id) async {
    final success = await _repo.publishBrief(id);
    if (success) {
      await loadBriefs();
    }
  }
}

final brandBriefsProvider = StateNotifierProvider<BrandBriefsNotifier, BrandBriefsState>((ref) {
  final repo = ref.watch(campaignRepositoryProvider);
  return BrandBriefsNotifier(repo);
});

// -----------------------------------------------------------------------------
// 2. Creator Applications Hub Controller (E10)
// -----------------------------------------------------------------------------

class CreatorApplicationsState {
  final List<ApplicationItem> applications;
  final String selectedTab; // 'ALL', 'SHORTLISTED', 'ACCEPTED', 'SUBMITTED'
  final bool isLoading;
  final String? errorMessage;

  const CreatorApplicationsState({
    this.applications = const [],
    this.selectedTab = 'ALL',
    this.isLoading = false,
    this.errorMessage,
  });

  List<ApplicationItem> get filteredApplications {
    if (selectedTab == 'SHORTLISTED') {
      return applications.where((a) => a.status == ApplicationStatus.shortlisted).toList();
    }
    if (selectedTab == 'ACCEPTED') {
      return applications.where((a) => a.status == ApplicationStatus.accepted).toList();
    }
    if (selectedTab == 'SUBMITTED') {
      return applications.where((a) => a.status == ApplicationStatus.submitted || a.status == ApplicationStatus.underReview).toList();
    }
    return applications;
  }

  CreatorApplicationsState copyWith({
    List<ApplicationItem>? applications,
    String? selectedTab,
    bool? isLoading,
    String? errorMessage,
  }) {
    return CreatorApplicationsState(
      applications: applications ?? this.applications,
      selectedTab: selectedTab ?? this.selectedTab,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class CreatorApplicationsNotifier extends StateNotifier<CreatorApplicationsState> {
  final CampaignRepository _repo;

  CreatorApplicationsNotifier(this._repo) : super(const CreatorApplicationsState()) {
    loadApplications();
  }

  Future<void> loadApplications() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final list = await _repo.getMyApplications();
      state = state.copyWith(applications: list, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  void setTab(String tab) {
    state = state.copyWith(selectedTab: tab);
  }

  Future<bool> withdrawPitch(String applicationId) async {
    final success = await _repo.withdrawApplication(applicationId);
    if (success) {
      await loadApplications();
    }
    return success;
  }
}

final creatorApplicationsProvider = StateNotifierProvider<CreatorApplicationsNotifier, CreatorApplicationsState>((ref) {
  final repo = ref.watch(campaignRepositoryProvider);
  return CreatorApplicationsNotifier(repo);
});

// -----------------------------------------------------------------------------
// 3. Brand Brief Applicants Controller (E06)
// -----------------------------------------------------------------------------

class BriefApplicantsState {
  final List<ApplicationItem> applicants;
  final String selectedFilter; // 'ALL', 'SHORTLISTED', 'UNDER_REVIEW', 'REJECTED'
  final bool isLoading;

  const BriefApplicantsState({
    this.applicants = const [],
    this.selectedFilter = 'ALL',
    this.isLoading = false,
  });

  List<ApplicationItem> get filteredApplicants {
    if (selectedFilter == 'SHORTLISTED') {
      return applicants.where((a) => a.status == ApplicationStatus.shortlisted).toList();
    }
    if (selectedFilter == 'UNDER_REVIEW') {
      return applicants.where((a) => a.status == ApplicationStatus.underReview || a.status == ApplicationStatus.submitted).toList();
    }
    if (selectedFilter == 'REJECTED') {
      return applicants.where((a) => a.status == ApplicationStatus.rejected).toList();
    }
    return applicants;
  }

  BriefApplicantsState copyWith({
    List<ApplicationItem>? applicants,
    String? selectedFilter,
    bool? isLoading,
  }) {
    return BriefApplicantsState(
      applicants: applicants ?? this.applicants,
      selectedFilter: selectedFilter ?? this.selectedFilter,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class BriefApplicantsNotifier extends StateNotifier<BriefApplicantsState> {
  final CampaignRepository _repo;
  final String briefId;

  BriefApplicantsNotifier(this._repo, this.briefId) : super(const BriefApplicantsState()) {
    loadApplicants();
  }

  Future<void> loadApplicants() async {
    state = state.copyWith(isLoading: true);
    final list = await _repo.getBriefApplicants(briefId);
    state = state.copyWith(applicants: list, isLoading: false);
  }

  void setFilter(String filter) {
    state = state.copyWith(selectedFilter: filter);
  }

  Future<bool> shortlistApplicant(String applicationId) async {
    final ok = await _repo.updateApplicantStatus(applicationId, ApplicationStatus.shortlisted);
    if (ok) {
      await loadApplicants();
    }
    return ok;
  }

  Future<bool> declineApplicant(String applicationId, {String? reason}) async {
    final ok = await _repo.updateApplicantStatus(applicationId, ApplicationStatus.rejected, rejectionReason: reason);
    if (ok) {
      await loadApplicants();
    }
    return ok;
  }
}

final briefApplicantsProvider = StateNotifierProvider.family<BriefApplicantsNotifier, BriefApplicantsState, String>((ref, briefId) {
  final repo = ref.watch(campaignRepositoryProvider);
  return BriefApplicantsNotifier(repo, briefId);
});

// -----------------------------------------------------------------------------
// 4. Single Brief Detail Provider (E07)
// -----------------------------------------------------------------------------

final briefDetailProvider = FutureProvider.family<CampaignBrief?, String>((ref, id) async {
  final repo = ref.watch(campaignRepositoryProvider);
  return repo.getBriefDetail(id);
});

// -----------------------------------------------------------------------------
// 5. Saved Briefs Controller (E12)
// -----------------------------------------------------------------------------

class SavedBriefsNotifier extends StateNotifier<List<CampaignBrief>> {
  final CampaignRepository _repo;

  SavedBriefsNotifier(this._repo) : super([]) {
    loadSaved();
  }

  Future<void> loadSaved() async {
    final list = await _repo.getSavedBriefs();
    state = list;
  }

  Future<bool> toggleBookmark(CampaignBrief brief) async {
    final isNowSaved = await _repo.toggleBookmarkBrief(brief.id);
    await loadSaved();
    return isNowSaved;
  }
}

final savedBriefsProvider = StateNotifierProvider<SavedBriefsNotifier, List<CampaignBrief>>((ref) {
  final repo = ref.watch(campaignRepositoryProvider);
  return SavedBriefsNotifier(repo);
});
