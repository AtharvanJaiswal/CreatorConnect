import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';

class D04NotificationCenterScreen extends ConsumerWidget {
  const D04NotificationCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notificationCenterProvider);
    final notifier = ref.read(notificationCenterProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Notifications', style: AppTypography.headingLarge().copyWith(fontSize: 18)),
        actions: [
          if (state.unreadCount > 0)
            TextButton(
              onPressed: () => notifier.markAllAsRead(),
              child: const Text('Mark all as read', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textPrimary)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: Row(
              children: [
                _buildTabChip(
                  label: 'All',
                  isSelected: state.selectedTab == NotificationTab.all,
                  onTap: () => notifier.setTab(NotificationTab.all),
                ),
                const SizedBox(width: 8),
                _buildTabChip(
                  label: 'Applications',
                  isSelected: state.selectedTab == NotificationTab.applications,
                  onTap: () => notifier.setTab(NotificationTab.applications),
                ),
                const SizedBox(width: 8),
                _buildTabChip(
                  label: 'System & Reviews',
                  isSelected: state.selectedTab == NotificationTab.system,
                  onTap: () => notifier.setTab(NotificationTab.system),
                ),
              ],
            ),
          ),

          // Notification List
          Expanded(
            child: state.filteredItems.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.notifications_off_outlined, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        Text('No notifications yet', style: AppTypography.headingMedium().copyWith(fontSize: 16)),
                        const SizedBox(height: 4),
                        const Text('When someone accepts your brief or connects, it will show up here.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    itemCount: state.filteredItems.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, idx) {
                      final item = state.filteredItems[idx];
                      return _buildNotificationItem(context, item);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.textPrimary,
      backgroundColor: AppColors.surface,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppColors.textPrimary,
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
        side: BorderSide(color: isSelected ? AppColors.textPrimary : AppColors.border),
      ),
    );
  }

  Widget _buildNotificationItem(BuildContext context, NotificationItemModel item) {
    return InkWell(
      onTap: () {
        if (item.actionUrl != null) {
          if (item.actionUrl!.startsWith('/profile/')) {
            final id = item.actionUrl!.split('/').last;
            Navigator.pushNamed(context, '/profile/detail', arguments: id);
          } else if (item.actionUrl == '/conversations') {
            Navigator.pushNamed(context, '/conversations');
          }
        }
      },
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: item.isUnread ? const Color(0xFFFFFDF5) : AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: item.isUnread ? AppColors.primary : AppColors.border,
            width: item.isUnread ? 1.8 : 1.2,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTypeIcon(item.type),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontWeight: item.isUnread ? FontWeight.w900 : FontWeight.w700,
                            fontSize: 13.5,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        item.timeAgo,
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.body,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeIcon(String type) {
    Color bg;
    IconData icon;
    Color iconColor;

    switch (type) {
      case 'APPLICATION':
        bg = const Color(0xFFE6F4EC);
        icon = Icons.celebration_rounded;
        iconColor = AppColors.success;
        break;
      case 'CONNECTION':
        bg = const Color(0xFFFFF2D6);
        icon = Icons.person_add_rounded;
        iconColor = const Color(0xFFC98A16);
        break;
      case 'REVIEW':
        bg = const Color(0xFFFFF9E6);
        icon = Icons.star_rounded;
        iconColor = const Color(0xFFFFB800);
        break;
      default:
        bg = AppColors.backgroundSecondary;
        icon = Icons.info_outline_rounded;
        iconColor = AppColors.textSecondary;
    }

    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: Icon(icon, size: 20, color: iconColor),
    );
  }
}
