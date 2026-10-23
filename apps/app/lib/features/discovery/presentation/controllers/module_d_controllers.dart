import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../auth/data/datasources/auth_local_datasource.dart';
import '../../data/datasources/module_d_remote_datasource.dart';
import '../../domain/entities/discovery_entities.dart';

// -----------------------------------------------------------------------------
// Core Remote DataSource & Local Storage Providers
// -----------------------------------------------------------------------------
final moduleDDataSourceProvider = Provider<ModuleDRemoteDataSource>((ref) {
  return ModuleDRemoteDataSource();
});

final authLocalDataSourceProvider = Provider<AuthLocalDataSource>((ref) {
  return AuthLocalDataSource();
});

// -----------------------------------------------------------------------------
// 1. Home Dashboard Controller
// -----------------------------------------------------------------------------
@immutable
class HomeDashboardState {
  final String role; // 'CREATOR', 'BRAND', 'EMPTY'
  final String greeting;
  final int completionPercentage;
  final Map<String, dynamic> stats;
  final List<ProfileCardModel> recommendedProfiles;
  final List<OpportunityBrief> nearbyOpportunities;
  final List<BrandBriefProgress> activeCampaigns;
  final List<ProfileCardModel> featuredCreators;
  final bool isLoading;
  final String? errorMessage;

  const HomeDashboardState({
    this.role = 'CREATOR',
    this.greeting = 'Good morning, Priya 👋',
    this.completionPercentage = 85,
    this.stats = const {},
    this.recommendedProfiles = const [],
    this.nearbyOpportunities = const [],
    this.activeCampaigns = const [],
    this.featuredCreators = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  HomeDashboardState copyWith({
    String? role,
    String? greeting,
    int? completionPercentage,
    Map<String, dynamic>? stats,
    List<ProfileCardModel>? recommendedProfiles,
    List<OpportunityBrief>? nearbyOpportunities,
    List<BrandBriefProgress>? activeCampaigns,
    List<ProfileCardModel>? featuredCreators,
    bool? isLoading,
    String? errorMessage,
  }) {
    return HomeDashboardState(
      role: role ?? this.role,
      greeting: greeting ?? this.greeting,
      completionPercentage: completionPercentage ?? this.completionPercentage,
      stats: stats ?? this.stats,
      recommendedProfiles: recommendedProfiles ?? this.recommendedProfiles,
      nearbyOpportunities: nearbyOpportunities ?? this.nearbyOpportunities,
      activeCampaigns: activeCampaigns ?? this.activeCampaigns,
      featuredCreators: featuredCreators ?? this.featuredCreators,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class HomeDashboardNotifier extends StateNotifier<HomeDashboardState> {
  final ModuleDRemoteDataSource _dataSource;
  final AuthLocalDataSource _localDataSource;

  HomeDashboardNotifier(this._dataSource, [AuthLocalDataSource? localDataSource])
      : _localDataSource = localDataSource ?? AuthLocalDataSource(),
        super(const HomeDashboardState()) {
    initDashboard();
  }

  Future<void> initDashboard() async {
    String? resolvedRole;
    try {
      resolvedRole = await _localDataSource.getSelectedRole();
    } catch (_) {}

    if (resolvedRole == null || resolvedRole.isEmpty) {
      try {
        final meta = Supabase.instance.client.auth.currentUser?.userMetadata;
        resolvedRole = meta?['role'] as String?;
      } catch (_) {}
    }

    await loadDashboard(resolvedRole);
  }

  Future<void> loadDashboard([String? targetRole, String? userId]) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      String? roleToUse = targetRole;
      if (roleToUse == null || roleToUse.isEmpty) {
        roleToUse = await _localDataSource.getSelectedRole();
      }
      if (roleToUse == null || roleToUse.isEmpty) {
        try {
          final meta = Supabase.instance.client.auth.currentUser?.userMetadata;
          roleToUse = meta?['role'] as String?;
        } catch (_) {}
      }

      final data = await _dataSource.getHomeDashboard(role: roleToUse, userId: userId);
      final rawRecs = data['recommendedProfiles'] as List<dynamic>? ?? [];
      final rawOpps = data['nearbyOpportunities'] as List<dynamic>? ?? [];
      final rawCampaigns = data['activeCampaigns'] as List<dynamic>? ?? [];
      final rawFeatured = data['featuredCreators'] as List<dynamic>? ?? [];

      final resolvedRole =
          (data['role'] as String?)?.toUpperCase() ?? (roleToUse?.toUpperCase() ?? 'CREATOR');

      // Persist the authoritative resolved role
      await _localDataSource.saveSelectedRole(resolvedRole);

      state = state.copyWith(
        role: resolvedRole,
        greeting: data['greeting'] as String? ?? 'Welcome 👋',
        completionPercentage: data['completionPercentage'] as int? ?? 100,
        stats: (data['stats'] as Map<String, dynamic>?) ?? (data['metrics'] as Map<String, dynamic>?) ?? {},
        recommendedProfiles: rawRecs.map((e) {
          if (e is ProfileCardModel) return e;
          return ProfileCardModel.fromJson(e as Map<String, dynamic>);
        }).toList(),
        nearbyOpportunities: rawOpps.map((e) => OpportunityBrief.fromJson(e as Map<String, dynamic>)).toList(),
        activeCampaigns: rawCampaigns.map((e) => BrandBriefProgress.fromJson(e as Map<String, dynamic>)).toList(),
        featuredCreators: rawFeatured.map((e) {
          if (e is ProfileCardModel) return e;
          return ProfileCardModel.fromJson(e as Map<String, dynamic>);
        }).toList(),
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  void switchRole(String newRole) {
    loadDashboard(newRole);
  }
}

final homeDashboardProvider = StateNotifierProvider<HomeDashboardNotifier, HomeDashboardState>((ref) {
  final ds = ref.watch(moduleDDataSourceProvider);
  final localDs = ref.watch(authLocalDataSourceProvider);
  return HomeDashboardNotifier(ds, localDs);
});

// -----------------------------------------------------------------------------
// 2. Filter State Controller (D07)
// -----------------------------------------------------------------------------
class FilterStateNotifier extends StateNotifier<FilterState> {
  FilterStateNotifier() : super(const FilterState());

  void setFilter(FilterState filter) {
    state = filter;
  }

  void setRole(DiscoveryRole role) {
    state = state.copyWith(role: role);
  }

  void toggleCategory(String category) {
    final list = List<String>.from(state.categories);
    if (list.contains(category)) {
      list.remove(category);
    } else {
      list.add(category);
    }
    state = state.copyWith(categories: list);
  }

  void setCity(String? city) {
    state = state.copyWith(city: city);
  }

  void setBudgetRange(double min, double max) {
    state = state.copyWith(minBudget: min, maxBudget: max);
  }

  void setFollowerRange(double min, double max) {
    state = state.copyWith(minFollowers: min, maxFollowers: max);
  }

  void toggleVerifiedOnly() {
    state = state.copyWith(verifiedOnly: !state.verifiedOnly);
  }

  void toggleAvailableImmediately() {
    state = state.copyWith(availableImmediately: !state.availableImmediately);
  }

  void toggleHasPortfolio() {
    state = state.copyWith(hasPortfolio: !state.hasPortfolio);
  }

  void setMinRating(double rating) {
    state = state.copyWith(minRating: rating);
  }

  void setSortOption(String sort) {
    state = state.copyWith(sortOption: sort);
  }

  void reset() {
    state = FilterState(role: state.role);
  }
}

final filterStateProvider = StateNotifierProvider<FilterStateNotifier, FilterState>((ref) {
  return FilterStateNotifier();
});

// -----------------------------------------------------------------------------
// 3. Discovery Feed Controller with 350ms Debounce & CancelToken (D05, D06)
// -----------------------------------------------------------------------------
class DiscoveryFeedNotifier extends StateNotifier<AsyncValue<List<ProfileCardModel>>> {
  final ModuleDRemoteDataSource _dataSource;
  final FilterState _filterState;
  Timer? _debounceTimer;
  CancelToken? _cancelToken;
  String _currentQuery = '';

  DiscoveryFeedNotifier(this._dataSource, this._filterState)
      : super(const AsyncValue.loading()) {
    fetchFeed();
  }

  void searchWithDebounce(String query) {
    _currentQuery = query;
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      fetchFeed();
    });
  }

  Future<void> fetchFeed() async {
    _cancelToken?.cancel('Cancelled by new request');
    _cancelToken = CancelToken();

    state = const AsyncValue.loading();
    try {
      final results = await _dataSource.getDiscover(
        filter: _filterState,
        query: _currentQuery.isEmpty ? null : _currentQuery,
        cancelToken: _cancelToken,
      );
      state = AsyncValue.data(results);
    } catch (e, st) {
      if (e is DioException && CancelToken.isCancel(e)) return;
      state = AsyncValue.error(e, st);
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _cancelToken?.cancel();
    super.dispose();
  }
}

final discoveryFeedProvider = StateNotifierProvider<DiscoveryFeedNotifier, AsyncValue<List<ProfileCardModel>>>((ref) {
  final ds = ref.watch(moduleDDataSourceProvider);
  final filter = ref.watch(filterStateProvider);
  return DiscoveryFeedNotifier(ds, filter);
});

// -----------------------------------------------------------------------------
// 4. Autocomplete Suggestions Controller (D06, D14)
// -----------------------------------------------------------------------------
class AutocompleteNotifier extends StateNotifier<List<AutocompleteSuggestion>> {
  final ModuleDRemoteDataSource _dataSource;
  Timer? _timer;
  CancelToken? _cancelToken;

  AutocompleteNotifier(this._dataSource) : super([]);

  void onQueryChanged(String query) {
    _timer?.cancel();
    if (query.trim().isEmpty) {
      state = [];
      return;
    }
    _timer = Timer(const Duration(milliseconds: 200), () async {
      _cancelToken?.cancel();
      _cancelToken = CancelToken();
      try {
        final res = await _dataSource.getAutocomplete(query, cancelToken: _cancelToken);
        state = res;
      } catch (_) {}
    });
  }

  void clear() {
    state = [];
  }

  @override
  void dispose() {
    _timer?.cancel();
    _cancelToken?.cancel();
    super.dispose();
  }
}

final autocompleteProvider = StateNotifierProvider<AutocompleteNotifier, List<AutocompleteSuggestion>>((ref) {
  final ds = ref.watch(moduleDDataSourceProvider);
  return AutocompleteNotifier(ds);
});

// -----------------------------------------------------------------------------
// 5. Notification Center Controller (D04)
// -----------------------------------------------------------------------------
enum NotificationTab { all, applications, system }

@immutable
class NotificationCenterState {
  final NotificationTab selectedTab;
  final List<NotificationItemModel> items;
  final bool isLoading;

  const NotificationCenterState({
    this.selectedTab = NotificationTab.all,
    this.items = const [],
    this.isLoading = false,
  });

  int get unreadCount => items.where((it) => it.isUnread).length;

  List<NotificationItemModel> get filteredItems {
    switch (selectedTab) {
      case NotificationTab.all:
        return items;
      case NotificationTab.applications:
        return items.where((it) => it.type == 'APPLICATION' || it.type == 'CONNECTION').toList();
      case NotificationTab.system:
        return items.where((it) => it.type == 'SYSTEM' || it.type == 'REVIEW').toList();
    }
  }

  NotificationCenterState copyWith({
    NotificationTab? selectedTab,
    List<NotificationItemModel>? items,
    bool? isLoading,
  }) {
    return NotificationCenterState(
      selectedTab: selectedTab ?? this.selectedTab,
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class NotificationCenterNotifier extends StateNotifier<NotificationCenterState> {
  final ModuleDRemoteDataSource _dataSource;

  NotificationCenterNotifier(this._dataSource) : super(const NotificationCenterState()) {
    loadNotifications();
  }

  Future<void> loadNotifications() async {
    state = state.copyWith(isLoading: true);
    final list = await _dataSource.getNotifications();
    state = state.copyWith(items: list, isLoading: false);
  }

  void setTab(NotificationTab tab) {
    state = state.copyWith(selectedTab: tab);
  }

  void markAllAsRead() {
    final updated = state.items.map((it) {
      return NotificationItemModel(
        id: it.id,
        title: it.title,
        body: it.body,
        timeAgo: it.timeAgo,
        type: it.type,
        isUnread: false,
        actionUrl: it.actionUrl,
      );
    }).toList();
    state = state.copyWith(items: updated);
  }
}

final notificationCenterProvider = StateNotifierProvider<NotificationCenterNotifier, NotificationCenterState>((ref) {
  final ds = ref.watch(moduleDDataSourceProvider);
  return NotificationCenterNotifier(ds);
});

// -----------------------------------------------------------------------------
// 6. Quota Tracker Controller (Free Tier 5/day - POP-D02)
// -----------------------------------------------------------------------------
class ConnectionQuotaNotifier extends StateNotifier<int> {
  final ModuleDRemoteDataSource _dataSource;

  ConnectionQuotaNotifier(this._dataSource) : super(ModuleDRemoteDataSource.dailyConnectionsRemaining) {
    _init();
  }

  Future<void> _init() async {
    await ModuleDRemoteDataSource.initQuota();
    state = ModuleDRemoteDataSource.dailyConnectionsRemaining;
  }

  Future<bool> requestConnection(String targetUserId, {String? note}) async {
    if (state <= 0) {
      return false; // Quota ceiling exceeded
    }
    final success = await _dataSource.sendConnectionRequest(targetUserId, note: note);
    if (success) {
      state = ModuleDRemoteDataSource.dailyConnectionsRemaining;
    }
    return success;
  }

  void resetQuotaForTesting() {
    state = 5;
  }
}

final connectionQuotaProvider = StateNotifierProvider<ConnectionQuotaNotifier, int>((ref) {
  final ds = ref.watch(moduleDDataSourceProvider);
  return ConnectionQuotaNotifier(ds);
});

// -----------------------------------------------------------------------------
// 7. Public Profile Controller (Family Provider - D09, D10)
// -----------------------------------------------------------------------------
final publicProfileProvider = FutureProvider.family<PublicProfileModel, String>((ref, profileId) async {
  final ds = ref.watch(moduleDDataSourceProvider);
  return ds.getPublicProfile(profileId);
});

// -----------------------------------------------------------------------------
// 8. Rule-based Recommendations Controller (D12 - SOW §13)
// -----------------------------------------------------------------------------
final recommendationsProvider = FutureProvider<List<ProfileCardModel>>((ref) async {
  final ds = ref.watch(moduleDDataSourceProvider);
  return ds.getRecommendations();
});
