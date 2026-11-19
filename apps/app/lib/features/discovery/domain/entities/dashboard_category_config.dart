import 'package:flutter/material.dart';
import '../../../../core/config/feature_flags.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../profile/domain/entities/profile_entities.dart';
import 'discovery_entities.dart';

@immutable
class DashboardCategoryMeta {
  final String id;
  final String name;
  final String slug;
  final Color color;
  final IconData icon;

  const DashboardCategoryMeta({
    required this.id,
    required this.name,
    required this.slug,
    required this.color,
    required this.icon,
  });
}

@immutable
class DashboardQuickAction {
  final String id;
  final String label;
  final IconData icon;
  final Color badgeColor;

  const DashboardQuickAction({
    required this.id,
    required this.label,
    required this.icon,
    required this.badgeColor,
  });
}

@immutable
class DashboardPersonaConfig {
  final String roleKey;
  final String badgeLabel;
  final String dashboardSubtitle;
  final Color accentColor;
  final IconData roleIcon;
  final String defaultGreetingPrefix;
  final String recommendedSectionTitle;
  final String opportunitiesSectionTitle;
  final String alertBadgeLabel;
  final String stat1FallbackTrend;
  final String stat2FallbackSub;
  final String stat3FallbackSub;
  final List<DashboardQuickAction> quickActions;

  const DashboardPersonaConfig({
    required this.roleKey,
    required this.badgeLabel,
    required this.dashboardSubtitle,
    required this.accentColor,
    required this.roleIcon,
    required this.defaultGreetingPrefix,
    required this.recommendedSectionTitle,
    required this.opportunitiesSectionTitle,
    required this.alertBadgeLabel,
    required this.stat1FallbackTrend,
    required this.stat2FallbackSub,
    required this.stat3FallbackSub,
    required this.quickActions,
  });

  String buildAlertTitle(int count, String primaryCategory) {
    final safeCount = count > 0 ? count : 1;
    switch (roleKey) {
      case 'PROFESSIONAL':
        return '$safeCount New Production ${safeCount == 1 ? 'Gig' : 'Gigs'} Match';
      case 'PODCASTER':
        return FeatureFlags.enableCorporateCampaigns
            ? '$safeCount New Guest & Sponsor ${safeCount == 1 ? 'Match' : 'Matches'}'
            : '$safeCount Podcast ${safeCount == 1 ? 'Collab' : 'Collabs'} Match';
      case 'BRAND':
        return '$safeCount New Applicant${safeCount == 1 ? '' : 's'} Ready';
      default:
        return FeatureFlags.enableCorporateCampaigns
            ? '$safeCount New Brief Match Nearby'
            : '$safeCount Collab Call${safeCount == 1 ? '' : 's'} Nearby';
    }
  }

  String buildAlertSubtitle({
    required String primaryCategory,
    required String city,
    String? specialty,
  }) {
    final safeCity = city.isNotEmpty ? city : 'Mumbai MMR';
    switch (roleKey) {
      case 'PROFESSIONAL':
        final roleLabel = (specialty != null && specialty.isNotEmpty)
            ? specialty
            : 'production skills';
        return 'Creators & studios in $safeCity need your $roleLabel ($primaryCategory).';
      case 'PODCASTER':
        final showLabel = (specialty != null && specialty.isNotEmpty)
            ? specialty
            : primaryCategory;
        return FeatureFlags.enableCorporateCampaigns
            ? 'Guests & sponsors match your "$showLabel" show in $safeCity.'
            : 'Co-hosts & guests match your "$showLabel" show in $safeCity.';
      case 'BRAND':
        return 'Verified $primaryCategory creators in $safeCity match your open briefs.';
      default:
        return FeatureFlags.enableCorporateCampaigns
            ? 'Campaigns in $primaryCategory match your $safeCity rates.'
            : 'Peer creators in $primaryCategory are open to collab in $safeCity.';
    }
  }
}

class DashboardCategoryCatalog {
  DashboardCategoryCatalog._();

  static const List<DashboardCategoryMeta> coreCategories = [
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000001',
      name: 'Fashion & Lifestyle',
      slug: 'fashion-lifestyle',
      color: AppColors.primary,
      icon: Icons.checkroom_rounded,
    ),
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000002',
      name: 'Food',
      slug: 'food',
      color: AppColors.accentMint,
      icon: Icons.restaurant_rounded,
    ),
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000003',
      name: 'Fitness',
      slug: 'fitness',
      color: AppColors.accentPeach,
      icon: Icons.fitness_center_rounded,
    ),
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000004',
      name: 'Tech',
      slug: 'tech',
      color: AppColors.accentSky,
      icon: Icons.devices_rounded,
    ),
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000005',
      name: 'Travel',
      slug: 'travel',
      color: Color(0xFFFFE5B8),
      icon: Icons.flight_takeoff_rounded,
    ),
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000006',
      name: 'Education & Career',
      slug: 'education-career',
      color: AppColors.secondary,
      icon: Icons.school_rounded,
    ),
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000007',
      name: 'Gaming & Esports',
      slug: 'gaming-esports',
      color: Color(0xFFD6E4FF),
      icon: Icons.sports_esports_rounded,
    ),
    DashboardCategoryMeta(
      id: '018f0001-0000-7000-8000-000000000008',
      name: 'Entertainment & Comedy',
      slug: 'entertainment-comedy',
      color: Color(0xFFFFD8E8),
      icon: Icons.theater_comedy_rounded,
    ),
  ];

  static DashboardPersonaConfig personaForRole(String roleKey) {
    switch (roleKey.toUpperCase()) {
      case 'PROFESSIONAL':
        return const DashboardPersonaConfig(
          roleKey: 'PROFESSIONAL',
          badgeLabel: 'PRODUCTION PRO',
          dashboardSubtitle: 'Production Pro Workspace',
          accentColor: AppColors.secondary,
          roleIcon: Icons.videocam_rounded,
          defaultGreetingPrefix: 'Studio ready',
          recommendedSectionTitle: 'Creators & Studios Hiring',
          opportunitiesSectionTitle: 'Production Gigs Near You',
          alertBadgeLabel: 'Gear & Crew',
          stat1FallbackTrend: 'Studio views',
          stat2FallbackSub: 'Client rating',
          stat3FallbackSub: 'Active shoots',
          quickActions: [
            DashboardQuickAction(
              id: 'role_details',
              label: 'Pro Rates & Gear',
              icon: Icons.tune_rounded,
              badgeColor: AppColors.secondary,
            ),
            DashboardQuickAction(
              id: 'edit_categories',
              label: 'Edit Skills',
              icon: Icons.category_rounded,
              badgeColor: AppColors.accentSky,
            ),
            DashboardQuickAction(
              id: 'my_applications',
              label: 'My Bids',
              icon: Icons.assignment_turned_in_rounded,
              badgeColor: AppColors.accentMint,
            ),
            DashboardQuickAction(
              id: 'discover',
              label: 'Find Crew Jobs',
              icon: Icons.explore_rounded,
              badgeColor: AppColors.primary,
            ),
          ],
        );
      case 'PODCASTER':
        return DashboardPersonaConfig(
          roleKey: 'PODCASTER',
          badgeLabel: 'PODCASTER',
          dashboardSubtitle: 'Podcast Show Cockpit',
          accentColor: AppColors.accentMint,
          roleIcon: Icons.mic_rounded,
          defaultGreetingPrefix: 'Mic check',
          recommendedSectionTitle: 'Guest & Audio Matches',
          opportunitiesSectionTitle: FeatureFlags.enableCorporateCampaigns
              ? 'Sponsor & Guest Briefs'
              : 'Podcast Collabs & Guests Nearby',
          alertBadgeLabel: 'Show Match',
          stat1FallbackTrend: 'Show views',
          stat2FallbackSub: 'Guest score',
          stat3FallbackSub: FeatureFlags.enableCorporateCampaigns
              ? 'Open sponsors'
              : 'Active peer requests',
          quickActions: [
            const DashboardQuickAction(
              id: 'role_details',
              label: 'Show & RSS',
              icon: Icons.podcasts_rounded,
              badgeColor: AppColors.accentMint,
            ),
            const DashboardQuickAction(
              id: 'edit_categories',
              label: 'Show Topics',
              icon: Icons.topic_rounded,
              badgeColor: AppColors.accentSky,
            ),
            DashboardQuickAction(
              id: FeatureFlags.enableCorporateCampaigns
                  ? 'my_applications'
                  : 'open_chat',
              label: FeatureFlags.enableCorporateCampaigns
                  ? 'Sponsor Pitches'
                  : 'Guest Chat',
              icon: FeatureFlags.enableCorporateCampaigns
                  ? Icons.campaign_rounded
                  : Icons.chat_bubble_outline_rounded,
              badgeColor: AppColors.primary,
            ),
            const DashboardQuickAction(
              id: 'discover',
              label: 'Find Guests',
              icon: Icons.person_search_rounded,
              badgeColor: AppColors.secondary,
            ),
          ],
        );
      case 'BRAND':
        return const DashboardPersonaConfig(
          roleKey: 'BRAND',
          badgeLabel: 'BRAND',
          dashboardSubtitle: 'Brand Campaign Cockpit',
          accentColor: AppColors.accentSky,
          roleIcon: Icons.business_center_rounded,
          defaultGreetingPrefix: 'Campaign hub',
          recommendedSectionTitle: 'Top Verified Talent Available',
          opportunitiesSectionTitle: 'Active Briefs Pipeline',
          alertBadgeLabel: 'Hiring',
          stat1FallbackTrend: 'Pipeline',
          stat2FallbackSub: 'Open briefs',
          stat3FallbackSub: 'Contracts',
          quickActions: [
            DashboardQuickAction(
              id: 'create_brief',
              label: 'Post Brief',
              icon: Icons.add_circle_outline_rounded,
              badgeColor: AppColors.primary,
            ),
            DashboardQuickAction(
              id: 'brand_dashboard',
              label: 'All Briefs',
              icon: Icons.work_outline_rounded,
              badgeColor: AppColors.accentSky,
            ),
            DashboardQuickAction(
              id: 'role_details',
              label: 'Company Profile',
              icon: Icons.storefront_rounded,
              badgeColor: AppColors.accentMint,
            ),
            DashboardQuickAction(
              id: 'discover',
              label: 'Scout Talent',
              icon: Icons.search_rounded,
              badgeColor: AppColors.secondary,
            ),
          ],
        );
      case 'EMPTY':
        return const DashboardPersonaConfig(
          roleKey: 'EMPTY',
          badgeLabel: 'ONBOARDING',
          dashboardSubtitle: 'Complete Setup',
          accentColor: AppColors.accentPeach,
          roleIcon: Icons.rocket_launch_rounded,
          defaultGreetingPrefix: 'Welcome',
          recommendedSectionTitle: 'Recommended for You',
          opportunitiesSectionTitle: 'Opportunities Near You',
          alertBadgeLabel: 'Setup',
          stat1FallbackTrend: '0',
          stat2FallbackSub: 'New',
          stat3FallbackSub: 'Pending',
          quickActions: [
            DashboardQuickAction(
              id: 'profile_hub',
              label: 'Profile Setup',
              icon: Icons.person_outline_rounded,
              badgeColor: AppColors.primary,
            ),
            DashboardQuickAction(
              id: 'edit_categories',
              label: 'Pick Categories',
              icon: Icons.category_rounded,
              badgeColor: AppColors.accentSky,
            ),
          ],
        );
      case 'CREATOR':
      default:
        return DashboardPersonaConfig(
          roleKey: 'CREATOR',
          badgeLabel: 'CREATOR',
          dashboardSubtitle: 'Creator Dashboard',
          accentColor: AppColors.primary,
          roleIcon: Icons.auto_awesome_rounded,
          defaultGreetingPrefix: 'Good morning',
          recommendedSectionTitle: 'Recommended for You',
          opportunitiesSectionTitle: FeatureFlags.enableCorporateCampaigns
              ? 'Opportunities Near You'
              : 'Collabs & Opportunities Near You',
          alertBadgeLabel: FeatureFlags.enableCorporateCampaigns
              ? 'Matched Brief'
              : 'Collab Match',
          stat1FallbackTrend: '+12% wk',
          stat2FallbackSub: 'Verified',
          stat3FallbackSub: FeatureFlags.enableCorporateCampaigns
              ? 'Matched'
              : 'Active peer requests',
          quickActions: FeatureFlags.enableCorporateCampaigns
              ? const [
                  DashboardQuickAction(
                    id: 'edit_categories',
                    label: 'Categories',
                    icon: Icons.category_rounded,
                    badgeColor: AppColors.primary,
                  ),
                  DashboardQuickAction(
                    id: 'my_applications',
                    label: 'Applications',
                    icon: Icons.send_rounded,
                    badgeColor: AppColors.accentSky,
                  ),
                  DashboardQuickAction(
                    id: 'saved_briefs',
                    label: 'Saved Briefs',
                    icon: Icons.bookmark_border_rounded,
                    badgeColor: AppColors.accentMint,
                  ),
                  DashboardQuickAction(
                    id: 'role_details',
                    label: 'Rates & Formats',
                    icon: Icons.currency_rupee_rounded,
                    badgeColor: AppColors.accentPeach,
                  ),
                ]
              : const [
                  DashboardQuickAction(
                    id: 'edit_categories',
                    label: 'Categories',
                    icon: Icons.category_rounded,
                    badgeColor: AppColors.primary,
                  ),
                  DashboardQuickAction(
                    id: 'open_chat',
                    label: 'Collab Chat',
                    icon: Icons.chat_bubble_outline_rounded,
                    badgeColor: AppColors.accentSky,
                  ),
                  DashboardQuickAction(
                    id: 'portfolio',
                    label: 'Portfolio',
                    icon: Icons.collections_bookmark_rounded,
                    badgeColor: AppColors.accentMint,
                  ),
                  DashboardQuickAction(
                    id: 'role_details',
                    label: 'Rates & Formats',
                    icon: Icons.currency_rupee_rounded,
                    badgeColor: AppColors.accentPeach,
                  ),
                ],
        );
    }
  }

  static DashboardCategoryMeta? metaFor(String input) {
    final raw = input.trim();
    if (raw.isEmpty) return null;
    final normalized = raw.toLowerCase().replaceAll(RegExp(r'^cat[-_]'), '');

    for (final item in coreCategories) {
      if (item.id.toLowerCase() == raw.toLowerCase() ||
          item.slug.toLowerCase() == normalized ||
          item.slug.toLowerCase().replaceAll('-', '') == normalized.replaceAll('-', '') ||
          item.name.toLowerCase() == normalized ||
          normalized.contains(item.slug.toLowerCase()) ||
          item.slug.toLowerCase().contains(normalized) ||
          normalized.contains(item.name.toLowerCase()) ||
          item.name.toLowerCase().contains(normalized)) {
        return item;
      }
    }

    // Heuristic semantic mappings for common slugs/keywords
    if (normalized.contains('fashion') || normalized.contains('style') || normalized.contains('lifestyle')) {
      return coreCategories.firstWhere((c) => c.slug == 'fashion-lifestyle');
    }
    if (normalized.contains('food') || normalized.contains('cook') || normalized.contains('culinary') || normalized.contains('recipe')) {
      return coreCategories.firstWhere((c) => c.slug == 'food');
    }
    if (normalized.contains('fitness') || normalized.contains('gym') || normalized.contains('health') || normalized.contains('workout')) {
      return coreCategories.firstWhere((c) => c.slug == 'fitness');
    }
    if (normalized.contains('tech') || normalized.contains('gadget') || normalized.contains('software') || normalized.contains('ai')) {
      return coreCategories.firstWhere((c) => c.slug == 'tech');
    }
    if (normalized.contains('travel') || normalized.contains('trip') || normalized.contains('tourism')) {
      return coreCategories.firstWhere((c) => c.slug == 'travel');
    }
    if (normalized.contains('edu') || normalized.contains('career') || normalized.contains('learn')) {
      return coreCategories.firstWhere((c) => c.slug == 'education-career');
    }
    if (normalized.contains('game') || normalized.contains('gaming') || normalized.contains('esport')) {
      return coreCategories.firstWhere((c) => c.slug == 'gaming-esports');
    }
    if (normalized.contains('entertain') || normalized.contains('comedy') || normalized.contains('cinema') || normalized.contains('acting')) {
      return coreCategories.firstWhere((c) => c.slug == 'entertainment-comedy');
    }

    return null;
  }

  /// Formats raw category identifiers or tags into user-friendly Title Case labels
  static String formatCategoryName(String input) {
    final meta = metaFor(input);
    if (meta != null) return meta.name;
    final stripped = input.trim().replaceAll(RegExp(r'^cat[-_]'), '');
    if (stripped.isEmpty) return 'General';
    return stripped
        .split(RegExp(r'[-_\s]+'))
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
        .join(' ');
  }

  static List<String> resolveUserCategories({
    required String roleKey,
    required List<String> selectedCategoryIds,
    CreatorDetailsData? creatorDetails,
    ProfessionalDetailsData? professionalDetails,
    PodcastDetailsData? podcastDetails,
    CompanyDetailsData? companyDetails,
  }) {
    final resolved = <String>[];

    void addUnique(String value) {
      final clean = value.trim();
      if (clean.isEmpty) return;
      if (!resolved.any((e) => e.toLowerCase() == clean.toLowerCase())) {
        resolved.add(clean);
      }
    }

    for (final rawId in selectedCategoryIds) {
      final meta = metaFor(rawId);
      addUnique(meta?.name ?? formatCategoryName(rawId));
    }

    switch (roleKey.toUpperCase()) {
      case 'PROFESSIONAL':
        if (professionalDetails != null &&
            professionalDetails.professionalType.trim().isNotEmpty) {
          addUnique(professionalDetails.professionalType);
        }
        if (resolved.isEmpty) {
          addUnique('Tech');
          addUnique('Entertainment & Comedy');
          addUnique('Fashion & Lifestyle');
        }
        break;
      case 'PODCASTER':
        if (podcastDetails != null && podcastDetails.category.trim().isNotEmpty) {
          addUnique(podcastDetails.category);
        }
        if (resolved.isEmpty) {
          addUnique('Tech');
          addUnique('Education & Career');
          addUnique('Entertainment & Comedy');
        }
        break;
      case 'BRAND':
        if (companyDetails != null &&
            companyDetails.businessCategory.trim().isNotEmpty) {
          addUnique(companyDetails.businessCategory);
        }
        if (resolved.isEmpty) {
          addUnique('Fashion & Lifestyle');
          addUnique('Tech');
          addUnique('Food');
        }
        break;
      default:
        if (creatorDetails != null) {
          for (final ct in creatorDetails.contentTypes.take(2)) {
            if (resolved.length < 4 && ct.trim().isNotEmpty) {
              // Keep content formats secondary unless no taxonomy picked
              if (selectedCategoryIds.isEmpty) {
                addUnique(ct);
              }
            }
          }
        }
        if (resolved.isEmpty) {
          addUnique('Fashion & Lifestyle');
          addUnique('Tech');
          addUnique('Food');
        }
        break;
    }

    return resolved;
  }

  static bool matchesCategory({
    required String? activeCategory,
    required String primaryNiche,
    List<String> extraTags = const [],
    String? titleOrBio,
  }) {
    if (activeCategory == null ||
        activeCategory.trim().isEmpty ||
        activeCategory.trim().toLowerCase() == 'all') {
      return true;
    }

    final query = activeCategory.trim().toLowerCase();
    final tokens = query
        .split(RegExp(r'[\s&,/]+'))
        .where((t) => t.length >= 3)
        .toList();

    final haystack = [
      primaryNiche,
      ...extraTags,
      if (titleOrBio != null) titleOrBio,
    ].join(' ').toLowerCase();

    if (haystack.contains(query)) return true;
    return tokens.any(haystack.contains);
  }

  static String _distinctSecondaryCategory(
    List<String> userCategories,
    String primaryCat,
  ) {
    for (final cat in userCategories) {
      if (cat.trim().isNotEmpty &&
          cat.trim().toLowerCase() != primaryCat.trim().toLowerCase()) {
        return cat.trim();
      }
    }
    return coreCategories
        .firstWhere(
          (c) => c.name.toLowerCase() != primaryCat.trim().toLowerCase(),
          orElse: () => coreCategories.last,
        )
        .name;
  }

  static List<ProfileCardModel> buildFallbackProfiles({
    required String roleKey,
    required List<String> userCategories,
    required String city,
  }) {
    final safeCity = city.isNotEmpty ? city : 'Mumbai MMR';
    final primaryCat =
        userCategories.isNotEmpty ? userCategories.first : 'Fashion & Lifestyle';
    final secondaryCat = _distinctSecondaryCategory(userCategories, primaryCat);

    if (roleKey.toUpperCase() == 'BRAND') {
      return [
        ProfileCardModel(
          id: 'cat-creator-01',
          name: 'Aanya Verma',
          handle: '@aanya.creates',
          role: 'CREATOR',
          avatarUrl: '',
          isVerified: true,
          isOnline: true,
          niche: primaryCat,
          rating: 4.9,
          reviewCount: 24,
          startingRate: 18000,
          city: safeCity,
          deliverableTags: [primaryCat, 'Reels', 'Lookbooks'],
          matchReasons: [
            MatchReason(label: '$primaryCat match', icon: '🎯'),
            MatchReason(label: 'Near $safeCity', icon: '📍'),
          ],
        ),
        ProfileCardModel(
          id: 'cat-pro-02',
          name: 'Kabir Sen',
          handle: '@kabir.edits',
          role: 'PROFESSIONAL',
          avatarUrl: '',
          isVerified: true,
          isOnline: true,
          niche: secondaryCat,
          rating: 4.8,
          reviewCount: 19,
          startingRate: 12000,
          city: safeCity,
          deliverableTags: ['Reels Editing', 'Color Grading', secondaryCat],
          matchReasons: [
            const MatchReason(label: 'Verified Editor', icon: '⚡'),
          ],
        ),
        ProfileCardModel(
          id: 'cat-pod-03',
          name: 'Rohan Mehta',
          handle: '@rohan.talks',
          role: 'PODCASTER',
          avatarUrl: '',
          isVerified: true,
          isOnline: false,
          niche: 'Education & Career',
          rating: 4.9,
          reviewCount: 15,
          startingRate: 22000,
          city: 'Bengaluru',
          deliverableTags: ['Podcast Integration', 'Host Read', secondaryCat],
          matchReasons: [
            const MatchReason(label: 'High listener retention', icon: '🎙️'),
          ],
        ),
      ];
    }

    if (roleKey.toUpperCase() == 'PROFESSIONAL') {
      return [
        ProfileCardModel(
          id: 'pro-client-01',
          name: 'Studio Vogue India',
          handle: '@studiovogue.in',
          role: 'BRAND',
          avatarUrl: '',
          isVerified: true,
          isOnline: true,
          niche: primaryCat,
          rating: 4.9,
          reviewCount: 31,
          startingRate: 25000,
          city: safeCity,
          deliverableTags: [primaryCat, 'Video Editing', 'Color Grading'],
          matchReasons: [
            MatchReason(label: 'Hiring $primaryCat crew', icon: '🎬'),
          ],
        ),
        ProfileCardModel(
          id: 'pro-client-02',
          name: 'Meera Kapoor',
          handle: '@meera.vlogs',
          role: 'CREATOR',
          avatarUrl: '',
          isVerified: true,
          isOnline: true,
          niche: secondaryCat,
          rating: 4.8,
          reviewCount: 14,
          startingRate: 15000,
          city: safeCity,
          deliverableTags: ['YouTube Retainer', 'Motion Graphics', secondaryCat],
          matchReasons: [
            const MatchReason(label: 'Monthly retainer lead', icon: '⭐'),
          ],
        ),
      ];
    }

    if (roleKey.toUpperCase() == 'PODCASTER') {
      return [
        ProfileCardModel(
          id: 'pod-guest-01',
          name: 'Vikram Sethi',
          handle: '@vikram.founders',
          role: 'CREATOR',
          avatarUrl: '',
          isVerified: true,
          isOnline: true,
          niche: primaryCat,
          rating: 4.9,
          reviewCount: 22,
          startingRate: 10000,
          city: safeCity,
          deliverableTags: [primaryCat, 'Guest Speaker', 'Deep Dive'],
          matchReasons: [
            MatchReason(label: '$primaryCat guest match', icon: '🎙️'),
          ],
        ),
        ProfileCardModel(
          id: 'pod-cohost-02',
          name: 'Neha Rao',
          handle: '@neha.podcasts',
          role: 'PODCASTER',
          avatarUrl: '',
          isVerified: true,
          isOnline: true,
          niche: secondaryCat,
          rating: 4.9,
          reviewCount: 27,
          startingRate: 8500,
          city: safeCity,
          deliverableTags: ['Co-Host Swap', 'Audio Episode', secondaryCat],
          matchReasons: [
            const MatchReason(label: 'Podcast Collab', icon: '🎧'),
          ],
        ),
      ];
    }

    // Default CREATOR peer collaboration recommendations
    return [
      ProfileCardModel(
        id: 'cr-peer-01',
        name: 'Aanya Verma',
        handle: '@aanya.creates',
        role: 'CREATOR',
        avatarUrl: '',
        isVerified: true,
        isOnline: true,
        niche: primaryCat,
        rating: 4.9,
        reviewCount: 34,
        startingRate: 15000,
        city: safeCity,
        deliverableTags: [primaryCat, 'Collab Reels', 'Cross-Promo'],
        matchReasons: [
          MatchReason(label: '$primaryCat collab match', icon: '✨'),
        ],
      ),
      ProfileCardModel(
        id: 'cr-pod-02',
        name: 'Kabir Sen',
        handle: '@kabir.podcasts',
        role: 'PODCASTER',
        avatarUrl: '',
        isVerified: true,
        isOnline: true,
        niche: secondaryCat,
        rating: 4.8,
        reviewCount: 21,
        startingRate: 12000,
        city: safeCity,
        deliverableTags: ['Guest Segment', 'Video Podcast', secondaryCat],
        matchReasons: [
          MatchReason(label: 'Based in $safeCity', icon: '📍'),
        ],
      ),
    ];
  }

  static List<OpportunityBrief> buildFallbackOpportunities({
    required String roleKey,
    required List<String> userCategories,
    required String city,
  }) {
    final safeCity = city.isNotEmpty ? city : 'Mumbai MMR';
    final primaryCat =
        userCategories.isNotEmpty ? userCategories.first : 'Fashion & Lifestyle';
    final secondaryCat = _distinctSecondaryCategory(userCategories, primaryCat);

    if (roleKey.toUpperCase() == 'PROFESSIONAL') {
      return [
        OpportunityBrief(
          id: 'opp-pro-01',
          title: '$primaryCat Campaign Shoot & 4K Reels Edit',
          brandName: 'Studio Vogue India',
          brandLogo: '',
          budget: 28000,
          location: safeCity,
          deadline: '3 days left',
          deliverableType: 'Shoot + Edit',
          category: primaryCat,
          applicantsCount: 9,
        ),
        OpportunityBrief(
          id: 'opp-pro-02',
          title: 'Monthly YouTube Colorist & Motion Graphics Retainer',
          brandName: 'ByteCraft Media',
          brandLogo: '',
          budget: 35000,
          location: 'Remote ($safeCity)',
          deadline: '5 days left',
          deliverableType: 'Post Production',
          category: secondaryCat,
          applicantsCount: 12,
        ),
      ];
    }

    if (roleKey.toUpperCase() == 'PODCASTER') {
      return [
        OpportunityBrief(
          id: 'collab-pod-01',
          title: 'Guest Episode Swap — $primaryCat Podcast',
          brandName: 'Rohan Mehta (Podcaster)',
          brandLogo: '',
          budget: 0,
          currency: '',
          location: 'Remote ($safeCity)',
          deadline: 'This week',
          deliverableType: 'Co-Host + Cross-Promo',
          category: primaryCat,
          applicantsCount: 7,
        ),
        OpportunityBrief(
          id: 'collab-pod-02',
          title: 'Co-Hosted Roundtable on $secondaryCat Trends',
          brandName: 'FounderPulse Podcast',
          brandLogo: '',
          budget: 0,
          currency: '',
          location: safeCity,
          deadline: '6 days left',
          deliverableType: 'Video Podcast Segment',
          category: secondaryCat,
          applicantsCount: 11,
        ),
      ];
    }

    return [
      OpportunityBrief(
        id: 'collab-cr-01',
        title: 'Collab Reel Shoot — $primaryCat Lookbook',
        brandName: 'Aanya Verma · Creator Collab',
        brandLogo: '',
        budget: 0,
        currency: '',
        location: safeCity,
        deadline: '2 days left',
        deliverableType: '2x Collab Reels + Tag Swap',
        category: primaryCat,
        applicantsCount: 14,
      ),
      OpportunityBrief(
        id: 'collab-cr-02',
        title: 'Guest Segment & Cross-Feature ($secondaryCat)',
        brandName: 'Kabir Sen · Podcast & Shorts',
        brandLogo: '',
        budget: 0,
        currency: '',
        location: 'Remote ($safeCity)',
        deadline: '5 days left',
        deliverableType: 'Podcast Guest + YouTube Short',
        category: secondaryCat,
        applicantsCount: 19,
      ),
    ];
  }

  static List<BrandBriefProgress> buildFallbackCampaigns({
    required List<String> userCategories,
  }) {
    final primaryCat =
        userCategories.isNotEmpty ? userCategories.first : 'Fashion & Lifestyle';
    final secondaryCat = _distinctSecondaryCategory(userCategories, primaryCat);

    return [
      BrandBriefProgress(
        id: 'b-demo-01',
        title: '$primaryCat Creators Campaign 2026',
        applicantsCount: 18,
        targetApplicants: 30,
        deadline: '4 days left',
        status: 'PUBLISHED',
        category: primaryCat,
      ),
      BrandBriefProgress(
        id: 'b-demo-02',
        title: '$secondaryCat Product Walkthrough Reels',
        applicantsCount: 11,
        targetApplicants: 25,
        deadline: '7 days left',
        status: 'PUBLISHED',
        category: secondaryCat,
      ),
    ];
  }
}

