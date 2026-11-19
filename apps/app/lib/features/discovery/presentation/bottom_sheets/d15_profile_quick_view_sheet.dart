import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../../../../core/widgets/safe_image.dart';

class D15ProfileQuickViewSheet extends StatelessWidget {
  final ProfileCardModel profile;
  final VoidCallback onViewFullProfile;
  final VoidCallback onConnect;

  const D15ProfileQuickViewSheet({
    super.key,
    required this.profile,
    required this.onViewFullProfile,
    required this.onConnect,
  });

  static void show(
    BuildContext context, {
    required ProfileCardModel profile,
    required VoidCallback onViewFullProfile,
    required VoidCallback onConnect,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => D15ProfileQuickViewSheet(
        profile: profile,
        onViewFullProfile: onViewFullProfile,
        onConnect: onConnect,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.backgroundPrimary,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
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

          // Header: Avatar, Name, Handle, Rating
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundImage: safeNetworkImage(profile.avatarUrl),
                child: safeNetworkImage(profile.avatarUrl) == null
                    ? Text(
                        profile.name.isNotEmpty ? profile.name[0] : 'U',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                      )
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            profile.name,
                            style: AppTypography.headingMedium().copyWith(fontSize: 16),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (profile.isVerified) ...[
                          const SizedBox(width: 4),
                          const Icon(Icons.verified_rounded, size: 16, color: Color(0xFF2E7CF6)),
                        ],
                      ],
                    ),
                    Text(
                      '${profile.handle} • ${profile.city}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                        const SizedBox(width: 2),
                        Text(
                          '${profile.rating.toStringAsFixed(1)} (${profile.reviewCount} reviews)',
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Bio Snippet
          if (profile.bio.isNotEmpty) ...[
            Text(
              profile.bio,
              style: AppTypography.bodyMedium().copyWith(fontSize: 12.5),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 14),
          ],

          // 3-Thumbnail Portfolio Strip
          if (profile.portfolioThumbnails.isNotEmpty) ...[
            const Text('Recent Portfolio', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            SizedBox(
              height: 88,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: profile.portfolioThumbnails.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, idx) {
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      profile.portfolioThumbnails[idx],
                      width: 88,
                      height: 88,
                      fit: BoxFit.cover,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Action Buttons: View Full Profile (Outline) & Connect (Yellow)
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    onViewFullProfile();
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.textPrimary, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('View Full Profile', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    onConnect();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Connect', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
