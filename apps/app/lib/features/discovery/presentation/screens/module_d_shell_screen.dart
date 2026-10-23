import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  Widget build(BuildContext context) {
    final dashboardState = ref.watch(homeDashboardProvider);
    final notifState = ref.watch(notificationCenterProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: IndexedStack(
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

      // Persistent 5-Tab Bottom Bar with Central Elevated Yellow '+' FAB
      bottomNavigationBar: Container(
        height: 64,
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border, width: 1)),
        ),
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
            GestureDetector(
              onTap: () => _showCreateSheet(context),
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.4),
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
    );
  }

  Widget _buildHomeTab(HomeDashboardState dashboardState) {
    if (dashboardState.role == 'EMPTY') {
      return D03EmptyHomeScreen(
        onContinueProfileSetup: () {
          Navigator.pushNamed(context, '/profile/completion');
        },
        onExploreDiscovery: () {
          setState(() => _currentIndex = 1);
        },
      );
    }

    if (dashboardState.role == 'BRAND') {
      return D02BrandHomeScreen(
        onNavigateToNotifications: () => setState(() => _currentIndex = 3),
        onNavigateToChat: () => Navigator.pushNamed(context, '/conversations'),
        onOpenProfile: (id) => _navigateToProfile(context, id),
        onManageApplicants: (briefId) {
          Navigator.pushNamed(context, '/campaigns/manage-applicants', arguments: briefId);
        },
      );
    }

    return D01CreatorHomeScreen(
      onNavigateToNotifications: () => setState(() => _currentIndex = 3),
      onNavigateToChat: () => Navigator.pushNamed(context, '/conversations'),
      onOpenProfile: (id) => _navigateToProfile(context, id),
      onApplyOpportunity: (oppId) {
        Navigator.pushNamed(context, '/campaigns/brief-detail', arguments: oppId);
      },
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
                Icon(
                  icon,
                  size: 24,
                  color: isSelected ? AppColors.textPrimary : AppColors.textMuted,
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
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
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
              'Create & Publish',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
            const SizedBox(height: 14),
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
                backgroundColor: AppColors.secondary,
                child: Icon(Icons.video_collection_rounded, color: AppColors.textPrimary),
              ),
              title: const Text('Upload Portfolio Media', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              subtitle: const Text('Add 4K video reel or lookbook gallery to your showcase'),
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Opening Media Vault uploader...')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
