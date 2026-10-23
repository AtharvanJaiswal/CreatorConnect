import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../bottom_sheets/permission_explainer_sheet.dart';
import '../dialogs/remove_social_account_dialog.dart';

class C08SocialAccountsScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const C08SocialAccountsScreen({super.key, this.repository});

  @override
  State<C08SocialAccountsScreen> createState() => _C08SocialAccountsScreenState();
}

class _C08SocialAccountsScreenState extends State<C08SocialAccountsScreen> {
  late final ProfileRepository _repo;
  List<SocialPlatformAccount> _accounts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _loadAccounts();
  }

  Future<void> _loadAccounts() async {
    setState(() => _isLoading = true);
    final list = await _repo.getSocialAccounts();
    if (mounted) {
      setState(() {
        _accounts = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleConnect(SocialPlatformAccount item) async {
    final confirmed = await PermissionExplainerSheet.show(context, platform: item.platform);
    if (confirmed == true && mounted) {
      final result = await Navigator.pushNamed(
        context,
        '/profile/connecting-social',
        arguments: {'platform': item.platform},
      );
      if (result == true) {
        _loadAccounts();
      }
    }
  }

  Future<void> _handleDisconnect(SocialPlatformAccount item) async {
    final confirm = await RemoveSocialAccountDialog.show(
      context,
      platform: item.platform,
      handle: item.handle,
    );

    if (confirm && mounted) {
      await _repo.disconnectSocialAccount(item.platform);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${item.platform} disconnected'),
          backgroundColor: AppColors.textPrimary,
        ),
      );
      _loadAccounts();
    }
  }

  void _handleViewDetail(SocialPlatformAccount item) async {
    final result = await Navigator.pushNamed(
      context,
      '/profile/social-account-detail',
      arguments: item,
    );
    if (result == true) {
      _loadAccounts();
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
        title: const Text(
          'Social Accounts',
          style: TextStyle(
            fontFamily: 'Archivo',
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _loadAccounts,
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                children: [
                  const Text(
                    'Connect your channels',
                    style: TextStyle(
                      fontFamily: 'Archivo',
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Connecting accounts verifies your audience size and displays live analytics to verified brands.',
                    style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  ..._accounts.map(_buildAccountCard),
                  const SizedBox(height: 20),
                  // Security info card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surfacePure,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.lock_outline_rounded, color: AppColors.textSecondary, size: 20),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Your credentials are never stored. We connect via official OAuth APIs with read-only permissions.',
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildAccountCard(SocialPlatformAccount item) {
    final isConnected = item.status == SocialPlatformStatus.connected ||
        item.status == SocialPlatformStatus.verified;
    final isExpired = item.status == SocialPlatformStatus.expired;

    Color badgeColor;
    Color badgeTextColor;
    switch (item.status) {
      case SocialPlatformStatus.notConnected:
        badgeColor = const Color(0xFFF5F5F5);
        badgeTextColor = AppColors.textSecondary;
        break;
      case SocialPlatformStatus.connected:
        badgeColor = const Color(0xFFFFF3CD);
        badgeTextColor = const Color(0xFF8A6D00);
        break;
      case SocialPlatformStatus.expired:
        badgeColor = const Color(0xFFFFEBEE);
        badgeTextColor = const Color(0xFFD32F2F);
        break;
      case SocialPlatformStatus.verified:
        badgeColor = const Color(0xFFE8F5E9);
        badgeTextColor = const Color(0xFF2E7D32);
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isConnected ? AppColors.primary.withValues(alpha: 0.5) : AppColors.borderLight,
          width: isConnected ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _buildPlatformIcon(item.platform),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          item.platform,
                          style: const TextStyle(
                            fontFamily: 'Archivo',
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: badgeColor,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            item.status.label,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: badgeTextColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.handle != null
                          ? '@${item.handle} ${item.followersCount != null ? "· ${item.followersCount} followers" : ""}'
                          : 'Not linked yet',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.borderLight),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (isConnected || isExpired) ...[
                TextButton(
                  onPressed: () => _handleDisconnect(item),
                  child: const Text(
                    'Disconnect',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFD32F2F)),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              if (!isConnected && !isExpired)
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                  onPressed: () => _handleConnect(item),
                  child: const Text(
                    'Connect',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                )
              else if (isExpired)
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                  onPressed: () => _handleConnect(item),
                  child: const Text(
                    'Reconnect',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                )
              else
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    side: const BorderSide(color: AppColors.borderLight),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                  onPressed: () => _handleViewDetail(item),
                  child: const Text(
                    'View metrics',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPlatformIcon(String platform) {
    IconData icon;
    Color color;
    switch (platform.toLowerCase()) {
      case 'instagram':
        icon = Icons.camera_alt;
        color = const Color(0xFFE1306C);
        break;
      case 'youtube':
        icon = Icons.play_circle_fill;
        color = const Color(0xFFFF0000);
        break;
      case 'linkedin':
        icon = Icons.business_center;
        color = const Color(0xFF0077B5);
        break;
      default:
        icon = Icons.alternate_email;
        color = AppColors.textPrimary;
        break;
    }

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color, size: 24),
    );
  }
}
