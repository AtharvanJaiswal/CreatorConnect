import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/animations/app_animations.dart';
import '../../../../core/config/feature_flags.dart';
import '../../../../core/theme/app_colors.dart';
import '../controllers/module_d_controllers.dart';
import 'd01_creator_home_screen.dart';
import 'd02_brand_home_screen.dart';
import 'd03_empty_home_screen.dart';
import 'd04_notification_center_screen.dart';
import 'd05_discover_home_screen.dart';
import 'd06_search_results_screen.dart';
import 'd09_creator_public_profile_screen.dart';
import 'd10_brand_public_profile_screen.dart';
import 'd14_search_presearch_screen.dart';
import '../../../profile/presentation/screens/user_profile_screen.dart';

class ModuleDShellScreen extends ConsumerStatefulWidget {
  const ModuleDShellScreen({super.key});

  @override
  ConsumerState<ModuleDShellScreen> createState() => _ModuleDShellScreenState();
}

class _ModuleDShellScreenState extends ConsumerState<ModuleDShellScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) {
        ref.read(homeDashboardProvider.notifier).initDashboard();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final dashboardState = ref.watch(homeDashboardProvider);
    final notifState = ref.watch(notificationCenterProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 240),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) {
          return FadeTransition(opacity: animation, child: child);
        },
        child: KeyedSubtree(
          key: ValueKey<int>(_currentIndex),
          child: IndexedStack(
            index: _currentIndex,
            children: [
              // Tab 0: Home (Routes role-specifically to D01, D02, or D03)
              _buildHomeTab(dashboardState),

              // Tab 1: Discover (D05)
              D05DiscoverHomeScreen(
                onOpenProfile: (id) => _navigateToProfile(context, id),
                onOpenSearch: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => D14SearchPreSearchScreen(
                        onSelectQuery: (q) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => D06SearchResultsScreen(
                                initialQuery: q,
                                onOpenProfile: (pid) => _navigateToProfile(context, pid),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  );
                },
              ),

              // Tab 2: Placeholder for index alignment (FAB handles tap)
              const SizedBox.shrink(),

              // Tab 3: Notifications (D04)
              const D04NotificationCenterScreen(),

              // Tab 4: User Profile (Self Authenticated Profile)
              const UserProfileScreen(),
            ],
          ),
        ),
      ),

      // Persistent 5-Tab Bottom Bar with Central Elevated Yellow '+' FAB
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border, width: 1)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _navItem(
                  index: 0,
                  icon: Icons.home_rounded,
                  label: 'Home',
                  isSelected: _currentIndex == 0,
                ),
                _navItem(
                  index: 1,
                  icon: Icons.explore_rounded,
                  label: 'Discover',
                  isSelected: _currentIndex == 1,
                ),
                // Central Elevated Yellow '+' FAB
                BouncingScaleTap(
                  onTap: () => _showCreateSheet(context),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.4),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.add_rounded, size: 28, color: AppColors.textPrimary),
                  ),
                ),
                _navItem(
                  index: 3,
                  icon: Icons.notifications_rounded,
                  label: 'Alerts',
                  isSelected: _currentIndex == 3,
                  badgeCount: notifState.unreadCount,
                ),
                _navItem(
                  index: 4,
                  icon: Icons.person_rounded,
                  label: 'Profile',
                  isSelected: _currentIndex == 4,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleQuickAction(
    String actionId,
    HomeDashboardState dashboardState,
  ) async {
    switch (actionId) {
      case 'edit_categories':
        await Navigator.pushNamed(context, '/profile/category-skills');
        if (mounted) {
          await ref
              .read(homeDashboardProvider.notifier)
              .loadDashboard(dashboardState.role);
        }
        break;
      case 'portfolio':
      case 'profile_hub':
        await Navigator.pushNamed(context, '/profile');
        if (mounted) {
          await ref
              .read(homeDashboardProvider.notifier)
              .loadDashboard(dashboardState.role);
        }
        break;
      case 'role_details':
        final route = switch (dashboardState.role.toUpperCase()) {
          'BRAND' => FeatureFlags.enableBrandDashboard
              ? '/profile/company-details'
              : '/profile/creator-details',
          'PROFESSIONAL' => FeatureFlags.enableProfessionalRegistration
              ? '/profile/professional-details'
              : '/profile/creator-details',
          'PODCASTER' => '/profile/podcast-details',
          _ => '/profile/creator-details',
        };
        await Navigator.pushNamed(context, route);
        if (mounted) {
          await ref
              .read(homeDashboardProvider.notifier)
              .loadDashboard(dashboardState.role);
        }
        break;
      case 'open_chat':
        Navigator.pushNamed(context, '/conversations');
        break;
      case 'my_applications':
        Navigator.pushNamed(
          context,
          FeatureFlags.enableCorporateApplications
              ? '/campaigns/my-applications'
              : '/conversations',
        );
        break;
      case 'saved_briefs':
        Navigator.pushNamed(
          context,
          FeatureFlags.enableCorporateCampaigns
              ? '/campaigns/saved'
              : '/conversations',
        );
        break;
      case 'create_brief':
        Navigator.pushNamed(
          context,
          FeatureFlags.enableCorporateCampaigns
              ? '/campaigns/create'
              : '/conversations',
        );
        break;
      case 'brand_dashboard':
        Navigator.pushNamed(
          context,
          FeatureFlags.enableBrandDashboard
              ? '/campaigns/brand-dashboard'
              : '/home',
        );
        break;
      case 'discover':
        setState(() => _currentIndex = 1);
        break;
      default:
        break;
    }
  }

  Widget _buildHomeTab(HomeDashboardState dashboardState) {
    if (dashboardState.role == 'EMPTY') {
      return D03EmptyHomeScreen(
        completionPercentage: dashboardState.completionPercentage,
        roleKey: dashboardState.role,
        selectedCategories: dashboardState.selectedCategories,
        onContinueProfileSetup: () => _handleQuickAction('profile_hub', dashboardState),
        onPickCategories: () => _handleQuickAction('edit_categories', dashboardState),
        onExploreDiscovery: () {
          setState(() => _currentIndex = 1);
        },
      );
    }

    if (dashboardState.role == 'BRAND' && FeatureFlags.enableBrandDashboard) {
      return D02BrandHomeScreen(
        onNavigateToNotifications: () => setState(() => _currentIndex = 3),
        onNavigateToChat: () => Navigator.pushNamed(context, '/conversations'),
        onOpenProfile: (id) => _navigateToProfile(context, id),
        onManageApplicants: (briefId) {
          Navigator.pushNamed(context, '/campaigns/manage-applicants', arguments: briefId);
        },
        onEditCategories: () => _handleQuickAction('edit_categories', dashboardState),
        onQuickAction: (id) => _handleQuickAction(id, dashboardState),
      );
    }

    return D01CreatorHomeScreen(
      onNavigateToNotifications: () => setState(() => _currentIndex = 3),
      onNavigateToChat: () => Navigator.pushNamed(context, '/conversations'),
      onOpenProfile: (id) => _navigateToProfile(context, id),
      onApplyOpportunity: (oppId) {
        if (FeatureFlags.enableCorporateCampaigns &&
            FeatureFlags.enableCorporateApplications) {
          Navigator.pushNamed(context, '/campaigns/brief-detail', arguments: oppId);
        } else {
          Navigator.pushNamed(context, '/conversations');
        }
      },
      onEditCategories: () => _handleQuickAction('edit_categories', dashboardState),
      onQuickAction: (id) => _handleQuickAction(id, dashboardState),
      onOpenDiscoverTab: () => setState(() => _currentIndex = 1),
    );
  }

  Widget _navItem({
    required int index,
    required IconData icon,
    required String label,
    required bool isSelected,
    int badgeCount = 0,
  }) {
    return InkWell(
      onTap: () => setState(() => _currentIndex = index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedScale(
                  scale: isSelected ? 1.1 : 1.0,
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOutCubic,
                  child: Icon(
                    icon,
                    size: 24,
                    color: isSelected ? AppColors.textPrimary : AppColors.textMuted,
                  ),
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: -2,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.error,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$badgeCount',
                        style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? AppColors.textPrimary : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToProfile(BuildContext context, String profileId, [String? role]) {
    final isBrand = role?.toUpperCase() == 'BRAND' || profileId.startsWith('b-') || profileId == 'brand';
    if (isBrand) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => D10BrandPublicProfileScreen(brandId: profileId),
        ),
      );
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => D09CreatorPublicProfileScreen(profileId: profileId),
        ),
      );
    }
  }

  void _showCreateSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Create & Quick Actions',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
              ),
              const SizedBox(height: 14),
              ..._buildRoleSheetTiles(ctx),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildRoleSheetTiles(BuildContext ctx) {
    final role = ref.read(homeDashboardProvider).role.toUpperCase();
    if (!FeatureFlags.enableCorporateCampaigns &&
        !FeatureFlags.enableBrandDashboard) {
      return [
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.secondary,
            child: Icon(Icons.category_rounded, color: AppColors.textPrimary),
          ),
          title: const Text(
            'Customize Content Categories & Skills',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          subtitle: const Text('Tune your niches & skills for better peer collab matches'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/profile/category-skills');
          },
        ),
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.primary,
            child: Icon(Icons.collections_bookmark_rounded, color: AppColors.textPrimary),
          ),
          title: const Text(
            'Upload to Media Vault / Portfolio',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          subtitle: const Text('Showcase your reels, lookbooks, and podcast episodes'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/profile');
          },
        ),
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.accentMint,
            child: Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textPrimary),
          ),
          title: const Text(
            'Start a Collaboration Chat',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          subtitle: const Text('Message creators and podcasters directly in real time'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/conversations');
          },
        ),
      ];
    }

    if (role == 'BRAND') {
      return [
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.primary,
            child: Icon(Icons.campaign_rounded, color: AppColors.textPrimary),
          ),
          title: const Text('Post Collaboration Brief', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          subtitle: const Text('Publish a new campaign seeking creators or production pros'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/campaigns/create');
          },
        ),
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.accentSky,
            child: Icon(Icons.work_outline_rounded, color: AppColors.textPrimary),
          ),
          title: const Text('Manage Brand Briefs', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          subtitle: const Text('Review applicants and track campaign pipelines'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/campaigns/brand-dashboard');
          },
        ),
      ];
    }

    if (role == 'PROFESSIONAL') {
      return [
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.secondary,
            child: Icon(Icons.videocam_rounded, color: AppColors.textPrimary),
          ),
          title: const Text('Update Services & Day Rates', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          subtitle: const Text('Customize equipment, software stack & availability'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/profile/professional-details');
          },
        ),
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.accentMint,
            child: Icon(Icons.assignment_turned_in_rounded, color: AppColors.textPrimary),
          ),
          title: const Text('Track Crew Bids & Applications', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          subtitle: const Text('Check status of submitted production proposals'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/campaigns/my-applications');
          },
        ),
      ];
    }

    if (role == 'PODCASTER') {
      return [
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.accentMint,
            child: Icon(Icons.podcasts_rounded, color: AppColors.textPrimary),
          ),
          title: const Text('Update Podcast Show & RSS', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          subtitle: const Text('Refresh show category, platforms & release cadence'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/profile/podcast-details');
          },
        ),
        ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.primary,
            child: Icon(Icons.bookmark_rounded, color: AppColors.textPrimary),
          ),
          title: const Text('Saved Sponsor Briefs', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          subtitle: const Text('Review bookmarked brand sponsorship opportunities'),
          onTap: () {
            Navigator.pop(ctx);
            Navigator.pushNamed(context, '/campaigns/saved');
          },
        ),
      ];
    }

    return [
      ListTile(
        leading: const CircleAvatar(
          backgroundColor: AppColors.secondary,
          child: Icon(Icons.category_rounded, color: AppColors.textPrimary),
        ),
        title: const Text('Customize Content Categories', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        subtitle: const Text('Tune your niches & skills for better brief matches'),
        onTap: () {
          Navigator.pop(ctx);
          Navigator.pushNamed(context, '/profile/category-skills');
        },
      ),
      ListTile(
        leading: const CircleAvatar(
          backgroundColor: AppColors.primary,
          child: Icon(Icons.send_rounded, color: AppColors.textPrimary),
        ),
        title: const Text('My Campaign Applications', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        subtitle: const Text('Track active pitches and saved brand collaborations'),
        onTap: () {
          Navigator.pop(ctx);
          Navigator.pushNamed(context, '/campaigns/my-applications');
        },
      ),
    ];
  }
}
