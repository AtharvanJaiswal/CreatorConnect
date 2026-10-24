import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../dialogs/remove_social_account_dialog.dart';

class C10SocialAccountDetailScreen extends StatefulWidget {
  final ProfileRepository? repository;
  final SocialPlatformAccount account;

  const C10SocialAccountDetailScreen({
    super.key,
    this.repository,
    required this.account,
  });

  @override
  State<C10SocialAccountDetailScreen> createState() => _C10SocialAccountDetailScreenState();
}

class _C10SocialAccountDetailScreenState extends State<C10SocialAccountDetailScreen> {
  late final ProfileRepository _repo;
  late SocialPlatformAccount _account;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _account = widget.account;
  }

  Future<void> _syncMetrics() async {
    setState(() => _isSyncing = true);
    await Future.delayed(const Duration(milliseconds: 1200));
    if (mounted) {
      setState(() {
        _account = _account.copyWith(
          lastSyncedText: 'Just now',
          followersCount: '24.9k',
        );
        _isSyncing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Audience metrics updated!'),
          backgroundColor: Color(0xFF2E7D32),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _disconnect() async {
    final confirm = await RemoveSocialAccountDialog.show(
      context,
      platform: _account.platform,
      handle: _account.handle,
    );
    if (confirm && mounted) {
      await _repo.disconnectSocialAccount(_account.platform);
      if (!mounted) return;
      Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          '${_account.platform} Account',
          style: const TextStyle(
            fontFamily: 'Archivo',
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        children: [
          // Header Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surfacePure,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.borderLight, width: 1.5),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFF0F5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.camera_alt, color: Color(0xFFE1306C), size: 28),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '@${_account.handle ?? "connected_user"}',
                            style: const TextStyle(
                              fontFamily: 'Archivo',
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Last synced: ${_account.lastSyncedText ?? "Recently"}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: _isSyncing
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                            )
                          : const Icon(Icons.sync_rounded, color: AppColors.textPrimary),
                      onPressed: _isSyncing ? null : _syncMetrics,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: _MetricTile(
                        title: 'Followers',
                        value: _account.followersCount ?? '—',
                        subtitle: _account.followersCount != null ? 'Live audience' : 'Awaiting sync',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricTile(
                        title: 'Total Posts',
                        value: _account.postsCount != null ? '${_account.postsCount}' : '—',
                        subtitle: 'Public media',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Audience Insights
          const Text(
            'Audience & Engagement',
            style: TextStyle(
              fontFamily: 'Archivo',
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.surfacePure,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Column(
              children: [
                _InsightRow(
                  title: 'Avg. Reel Views',
                  value: _account.followersCount != null ? '18,450' : 'Pending connection',
                ),
                const Divider(height: 24, color: AppColors.borderLight),
                _InsightRow(
                  title: 'Engagement Rate',
                  value: _account.followersCount != null ? '4.8%' : 'Pending connection',
                ),
                const Divider(height: 24, color: AppColors.borderLight),
                _InsightRow(
                  title: 'Top Location Hub',
                  value: _account.followersCount != null ? 'Delhi NCR (44%)' : 'Pending connection',
                ),
                const Divider(height: 24, color: AppColors.borderLight),
                _InsightRow(
                  title: 'Primary Gender',
                  value: _account.followersCount != null ? 'Women (68%)' : 'Pending connection',
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // Verification CTA
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              onPressed: () => Navigator.pushNamed(context, '/profile/verification-centre'),
              icon: const Icon(Icons.verified_rounded, size: 20, color: AppColors.textPrimary),
              label: const Text(
                'Verify this account',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: TextButton(
              onPressed: _disconnect,
              child: Text(
                'Disconnect ${_account.platform}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFD32F2F),
                ),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;

  const _MetricTile({
    required this.title,
    required this.value,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceWarm,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Archivo',
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF2E7D32))),
        ],
      ),
    );
  }
}

class _InsightRow extends StatelessWidget {
  final String title;
  final String value;

  const _InsightRow({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        Text(
          value,
          style: const TextStyle(
            fontFamily: 'Archivo',
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
