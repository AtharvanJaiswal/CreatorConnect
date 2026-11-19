import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../auth/data/datasources/auth_local_datasource.dart';
import '../../../auth/domain/entities/user_role.dart';
import '../../data/datasources/module_d_remote_datasource.dart';
import '../../../profile/data/repositories/profile_repository_impl.dart';
import '../../../profile/domain/entities/profile_entities.dart';
import '../../domain/entities/dashboard_category_config.dart';
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
  final String role; // 'CREATOR', 'PROFESSIONAL', 'PODCASTER', 'BRAND', 'EMPTY'
  final String greeting;
  final String city;
  final String roleSpecialty;
  final List<String> selectedCategories;
  final String? activeCategoryFilter;
  final bool isOfflineFallback;
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
    this.greeting = 'Good morning 👋',
    this.city = 'Mumbai MMR',
    this.roleSpecialty = '',
    this.selectedCategories = const [],
    this.activeCategoryFilter,
    this.isOfflineFallback = false,
    this.completionPercentage = 85,
    this.stats = const {},
    this.recommendedProfiles = const [],
    this.nearbyOpportunities = const [],
    this.activeCampaigns = const [],
    this.featuredCreators = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  DashboardPersonaConfig get persona =>
      DashboardCategoryCatalog.personaForRole(role);

  List<ProfileCardModel> get filteredRecommendations {
    if (activeCategoryFilter == null || activeCategoryFilter!.isEmpty) {
      return recommendedProfiles;
    }
    return recommendedProfiles
        .where(
          (p) => DashboardCategoryCatalog.matchesCategory(
            activeCategory: activeCategoryFilter,
            primaryNiche: p.niche,
            extraTags: p.deliverableTags,
            titleOrBio: '${p.name} ${p.bio}',
          ),
        )
        .toList();
  }

  List<OpportunityBrief> get filteredOpportunities {
    if (activeCategoryFilter == null || activeCategoryFilter!.isEmpty) {
      return nearbyOpportunities;
    }
    return nearbyOpportunities
        .where(
          (o) => DashboardCategoryCatalog.matchesCategory(
            activeCategory: activeCategoryFilter,
            primaryNiche: o.category,
            extraTags: [o.deliverableType, o.brandName],
            titleOrBio: o.title,
          ),
        )
        .toList();
  }

  List<BrandBriefProgress> get filteredCampaigns {
    if (activeCategoryFilter == null || activeCategoryFilter!.isEmpty) {
      return activeCampaigns;
    }
    return activeCampaigns
        .where(
          (c) => DashboardCategoryCatalog.matchesCategory(
            activeCategory: activeCategoryFilter,
            primaryNiche: c.category,
            titleOrBio: c.title,
          ),
        )
        .toList();
  }

  List<ProfileCardModel> get filteredFeaturedCreators {
    if (activeCategoryFilter == null || activeCategoryFilter!.isEmpty) {
      return featuredCreators;
    }
    return featuredCreators
        .where(
          (p) => DashboardCategoryCatalog.matchesCategory(
            activeCategory: activeCategoryFilter,
            primaryNiche: p.niche,
            extraTags: p.deliverableTags,
            titleOrBio: '${p.name} ${p.bio}',
          ),
        )
        .toList();
  }

  HomeDashboardState copyWith({
    String? role,
    String? greeting,
    String? city,
    String? roleSpecialty,
    List<String>? selectedCategories,
    String? activeCategoryFilter,
    bool clearActiveCategoryFilter = false,
    bool? isOfflineFallback,
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
      city: city ?? this.city,
      roleSpecialty: roleSpecialty ?? this.roleSpecialty,
      selectedCategories: selectedCategories ?? this.selectedCategories,
      activeCategoryFilter: clearActiveCategoryFilter
          ? null
          : (activeCategoryFilter ?? this.activeCategoryFilter),
      isOfflineFallback: isOfflineFallback ?? this.isOfflineFallback,
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

class _UserDashboardProfileContext {
  final String displayName;
  final String city;
  final String roleSpecialty;
  final List<String> selectedCategories;
  final int completionPercentage;

  const _UserDashboardProfileContext({
    required this.displayName,
    required this.city,
    required this.roleSpecialty,
    required this.selectedCategories,
    required this.completionPercentage,
  });
}

class HomeDashboardNotifier extends StateNotifier<HomeDashboardState> {
  final ModuleDRemoteDataSource _dataSource;
  final AuthLocalDataSource _localDataSource;
  final ProfileRepositoryImpl? _profileRepository;

  HomeDashboardNotifier(
    this._dataSource, [
    AuthLocalDataSource? localDataSource,
    ProfileRepositoryImpl? profileRepository,
  ])  : _localDataSource = localDataSource ?? AuthLocalDataSource(),
        _profileRepository = profileRepository ?? ProfileRepositoryImpl.instance,
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

  Future<String> _resolveEffectiveRole(String? targetRole) async {
    String? roleToUse = targetRole;
    if (roleToUse == null || roleToUse.isEmpty) {
      try {
        roleToUse = await _localDataSource.getSelectedRole();
      } catch (_) {}
    }
    if (roleToUse == null || roleToUse.isEmpty) {
      try {
        final meta = Supabase.instance.client.auth.currentUser?.userMetadata;
        roleToUse = meta?['role'] as String?;
      } catch (_) {}
    }
    return (roleToUse != null && roleToUse.trim().isNotEmpty)
        ? roleToUse.trim().toUpperCase()
        : 'CREATOR';
  }

  Future<_UserDashboardProfileContext> _loadProfileContext(
    String roleKey,
  ) async {
    var displayName = '';
    var city = 'Mumbai MMR';
    var specialty = '';
    var completion = 85;
    CreatorDetailsData? creatorDetails;
    ProfessionalDetailsData? proDetails;
    PodcastDetailsData? podcastDetails;
    CompanyDetailsData? companyDetails;
    var selectedCatIds = <String>[];

    try {
      final repo = _profileRepository;
      if (repo != null) {
        final overview = await repo.getProfileOverview(
          role: UserRole.fromString(roleKey),
        );
        completion = overview.completionPercentage;
        final basic = await repo.getBasicInfo();
        displayName = basic.displayName.trim();
        if (basic.city.trim().isNotEmpty) {
          city = basic.city.trim();
        }
        selectedCatIds = List<String>.from(repo.selectedCategoryIds);

        switch (roleKey) {
          case 'PROFESSIONAL':
            proDetails = await repo.getProfessionalDetails();
            specialty = proDetails.professionalType.trim();
            break;
          case 'PODCASTER':
            podcastDetails = await repo.getPodcastDetails();
            specialty = podcastDetails.showName.trim().isNotEmpty
                ? podcastDetails.showName.trim()
                : podcastDetails.category.trim();
            break;
          case 'BRAND':
            companyDetails = await repo.getCompanyDetails();
            if (companyDetails.companyName.trim().isNotEmpty) {
              displayName = companyDetails.companyName.trim();
            }
            if (companyDetails.city.trim().isNotEmpty) {
              city = companyDetails.city.trim();
            }
            specialty = companyDetails.businessCategory.trim();
            break;
          default:
            creatorDetails = await repo.getCreatorDetails();
            if (creatorDetails.contentTypes.isNotEmpty) {
              specialty = creatorDetails.contentTypes.take(2).join(' · ');
            }
            break;
        }
      }
    } catch (_) {
      // Safe fallback in isolated unit/widget tests without shared preferences.
    }

    if (displayName.isEmpty) {
      try {
        final user = Supabase.instance.client.auth.currentUser;
        final meta = user?.userMetadata;
        final metaName =
            (meta?['full_name'] as String?) ?? (meta?['name'] as String?);
        if (metaName != null && metaName.trim().isNotEmpty) {
          displayName = metaName.trim();
        } else if (user?.email != null && user!.email!.contains('@')) {
          displayName = user.email!.split('@').first;
        }
      } catch (_) {}
    }

    final resolvedCats = DashboardCategoryCatalog.resolveUserCategories(
      roleKey: roleKey,
      selectedCategoryIds: selectedCatIds,
      creatorDetails: creatorDetails,
      professionalDetails: proDetails,
      podcastDetails: podcastDetails,
      companyDetails: companyDetails,
    );

    if (specialty.isEmpty && resolvedCats.isNotEmpty) {
      specialty = resolvedCats.first;
    }

    return _UserDashboardProfileContext(
      displayName: displayName,
      city: city,
      roleSpecialty: specialty,
      selectedCategories: resolvedCats,
      completionPercentage: completion,
    );
  }

  Future<void> loadDashboard([String? targetRole, String? userId]) async {
    final requestedRole = await _resolveEffectiveRole(targetRole);
    state = state.copyWith(
      role: requestedRole,
      isLoading: true,
      errorMessage: null,
    );

    final profileCtx = await _loadProfileContext(requestedRole);

    try {
      final data = await _dataSource.getHomeDashboard(
        role: requestedRole,
        userId: userId,
      );
      final rawRecs = (data['recommendedProfiles'] ?? data['recommendations']) as List<dynamic>? ?? [];
      final rawOpps = (data['nearbyOpportunities'] ?? data['opportunities']) as List<dynamic>? ?? [];
      final rawCampaigns = (data['activeCampaigns'] ?? data['campaignPipeline']) as List<dynamic>? ?? [];
      final rawFeatured = data['featuredCreators'] as List<dynamic>? ?? [];

      final apiRole = (data['role'] as String?)?.toUpperCase();
      // Preserve PROFESSIONAL / PODCASTER / EMPTY persona even when backend falls back to 'CREATOR'.
      final resolvedRole = (requestedRole == 'PROFESSIONAL' ||
              requestedRole == 'PODCASTER' ||
              requestedRole == 'EMPTY')
          ? requestedRole
          : (apiRole ?? requestedRole);

      if (resolvedRole != 'EMPTY') {
        try {
          await _localDataSource.saveSelectedRole(resolvedRole);
        } catch (_) {}
      }

      final persona = DashboardCategoryCatalog.personaForRole(resolvedRole);
      final fallbackGreeting = profileCtx.displayName.isNotEmpty
          ? '${persona.defaultGreetingPrefix}, ${profileCtx.displayName} 👋'
          : '${persona.defaultGreetingPrefix} 👋';

      final parsedRecs = rawRecs.map((e) {
        if (e is ProfileCardModel) return e;
        return ProfileCardModel.fromJson(e as Map<String, dynamic>);
      }).toList();

      final parsedOpps = rawOpps
          .map((e) => OpportunityBrief.fromJson(e as Map<String, dynamic>))
          .toList();

      final parsedCampaigns = rawCampaigns
          .map((e) => BrandBriefProgress.fromJson(e as Map<String, dynamic>))
          .toList();

      final parsedFeatured = rawFeatured.map((e) {
        if (e is ProfileCardModel) return e;
        return ProfileCardModel.fromJson(e as Map<String, dynamic>);
      }).toList();

      final apiGreeting = data['greeting'] as String?;
      final effectiveGreeting = (resolvedRole == 'CREATOR' || resolvedRole == 'BRAND') &&
              apiGreeting != null &&
              apiGreeting.trim().isNotEmpty
          ? apiGreeting
          : (apiGreeting != null && profileCtx.displayName.isEmpty
              ? apiGreeting
              : fallbackGreeting);

      state = state.copyWith(
        role: resolvedRole,
        greeting: effectiveGreeting,
        city: profileCtx.city,
        roleSpecialty: profileCtx.roleSpecialty,
        selectedCategories: profileCtx.selectedCategories,
        isOfflineFallback: false,
        completionPercentage:
            data['completionPercentage'] as int? ?? profileCtx.completionPercentage,
        stats: (data['stats'] as Map<String, dynamic>?) ??
            (data['metrics'] as Map<String, dynamic>?) ??
            {},
        recommendedProfiles: parsedRecs,
        nearbyOpportunities: parsedOpps,
        activeCampaigns: parsedCampaigns,
        featuredCreators: parsedFeatured,
        isLoading: false,
      );
    } catch (e, st) {
      debugPrint('ModuleD Dashboard Error: $e\n$st');
      final persona = DashboardCategoryCatalog.personaForRole(requestedRole);
      final greeting = profileCtx.displayName.isNotEmpty
          ? '${persona.defaultGreetingPrefix}, ${profileCtx.displayName} 👋'
          : '${persona.defaultGreetingPrefix} 👋';

      final fallbackProfiles = DashboardCategoryCatalog.buildFallbackProfiles(
        roleKey: requestedRole,
        userCategories: profileCtx.selectedCategories,
        city: profileCtx.city,
      );
      final fallbackOpps = DashboardCategoryCatalog.buildFallbackOpportunities(
        roleKey: requestedRole,
        userCategories: profileCtx.selectedCategories,
        city: profileCtx.city,
      );
      final fallbackCampaigns =
          requestedRole == 'BRAND'
              ? DashboardCategoryCatalog.buildFallbackCampaigns(
                  userCategories: profileCtx.selectedCategories,
                )
              : const <BrandBriefProgress>[];

      state = state.copyWith(
        role: requestedRole,
        greeting: greeting,
        city: profileCtx.city,
        roleSpecialty: profileCtx.roleSpecialty,
        selectedCategories: profileCtx.selectedCategories,
        isOfflineFallback: true,
        completionPercentage: profileCtx.completionPercentage,
        stats: requestedRole == 'BRAND'
            ? {
                'totalApplicants': 0,
                'activeBriefs': fallbackCampaigns.length,
                'hiredCount': 0,
              }
            : {
                'profileViews': 0,
                'profileViewsTrend': persona.stat1FallbackTrend,
                'rating': 0,
                'openBriefsCount': fallbackOpps.length,
              },
        recommendedProfiles: fallbackProfiles,
        nearbyOpportunities: fallbackOpps,
        activeCampaigns: fallbackCampaigns,
        featuredCreators: requestedRole == 'BRAND' ? fallbackProfiles : const [],
        isLoading: false,
      );
    }
  }

  void selectCategoryFilter(String? category) {
    if (category == null ||
        category.trim().isEmpty ||
        category.trim().toLowerCase() == 'all') {
      state = state.copyWith(clearActiveCategoryFilter: true);
    } else {
      state = state.copyWith(activeCategoryFilter: category.trim());
    }
  }

  void switchRole(String newRole) {
    state = state.copyWith(clearActiveCategoryFilter: true);
    loadDashboard(newRole);
  }
}

final homeDashboardProvider =
    StateNotifierProvider<HomeDashboardNotifier, HomeDashboardState>((ref) {
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
    _dataSource.markAllNotificationsRead();
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

  void markSingleAsRead(String id) {
    _dataSource.markNotificationRead(id);
    final updated = state.items.map((it) {
      if (it.id == id) {
        return NotificationItemModel(
          id: it.id,
          title: it.title,
          body: it.body,
          timeAgo: it.timeAgo,
          type: it.type,
          isUnread: false,
          actionUrl: it.actionUrl,
        );
      }
      return it;
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
  final dashState = ref.watch(homeDashboardProvider);
  return ds.getRecommendations(role: dashState.role.isNotEmpty ? dashState.role : 'CREATOR');
});
