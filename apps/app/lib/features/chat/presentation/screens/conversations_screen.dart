import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class ConversationsScreen extends StatelessWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Messages & Collabs',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            // Search Input
            Container(
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderLight),
              ),
              child: const Row(
                children: [
                  Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
                  SizedBox(width: 8),
                  Text('Search conversations...', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Demo Chat Items
            _buildConversationTile(
              name: 'Urban Vogue',
              role: 'BRAND',
              message: 'Hi Priya, we loved your recent sustainable styling reel! Would love to collab.',
              time: '10m ago',
              unreadCount: 1,
              avatarUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100',
            ),
            _buildConversationTile(
              name: 'Sameer Sen',
              role: 'PROFESSIONAL',
              message: 'Hey, I can bring the Sony FX6 rig for the weekend shoot in Bandra.',
              time: '2h ago',
              unreadCount: 0,
              avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
            ),
            _buildConversationTile(
              name: 'FabIndia Collabs',
              role: 'BRAND',
              message: 'Campaign brief accepted. Milestone payment has been deposited in escrow.',
              time: '1d ago',
              unreadCount: 0,
              avatarUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=100',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConversationTile({
    required String name,
    required String role,
    required String message,
    required String time,
    required int unreadCount,
    required String avatarUrl,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: unreadCount > 0 ? AppColors.surfaceWarm : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundImage: NetworkImage(avatarUrl),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary),
                    ),
                    Text(
                      time,
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  message,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: unreadCount > 0 ? AppColors.textPrimary : AppColors.textSecondary,
                    fontWeight: unreadCount > 0 ? FontWeight.w700 : FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),
          if (unreadCount > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                '$unreadCount',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
