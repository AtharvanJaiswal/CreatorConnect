import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/chat_entities.dart';
import '../controllers/chat_controllers.dart';
import '../widgets/conversation_tile_widget.dart';
import 'e04_chat_thread_screen.dart';

/// SCR-E01, SCR-E02, SCR-E03: Conversations List Inbox Screen
/// Primary messages inbox, quarantined message requests, and zero-state screen.
class E01ConversationsListScreen extends ConsumerStatefulWidget {
  const E01ConversationsListScreen({super.key});

  @override
  ConsumerState<E01ConversationsListScreen> createState() => _E01ConversationsListScreenState();
}

class _E01ConversationsListScreenState extends ConsumerState<E01ConversationsListScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(conversationsProvider);
    final notifier = ref.read(conversationsProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else {
              Navigator.pushReplacementNamed(context, '/home');
            }
          },
        ),
        title: Text(
          'Messages',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search Bar & Tab Toggle Container
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Column(
                children: [
                  // Search Bar
                  Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.backgroundSecondary,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _searchCtrl,
                            onChanged: (val) {
                              notifier.setSearchQuery(val.trim().isNotEmpty ? val : null);
                            },
                            style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                            decoration: const InputDecoration(
                              hintText: 'Search conversations or messages...',
                              hintStyle: TextStyle(fontSize: 13, color: AppColors.textMuted),
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                        ),
                        if (_searchCtrl.text.isNotEmpty)
                          GestureDetector(
                            onTap: () {
                              _searchCtrl.clear();
                              notifier.setSearchQuery(null);
                            },
                            child: const Icon(Icons.close_rounded, size: 18, color: AppColors.textMuted),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Tabs: Primary vs Requests (SCR-E01 & SCR-E02)
                  Container(
                    height: 40,
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: AppColors.backgroundSecondary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _buildTabButton(
                            title: 'Primary',
                            isSelected: state.activeTab == ChatTab.primary,
                            onTap: () => notifier.setTab(ChatTab.primary),
                          ),
                        ),
                        Expanded(
                          child: _buildTabButton(
                            title: 'Requests',
                            badgeCount: state.requestConversations.length,
                            isSelected: state.activeTab == ChatTab.requests,
                            onTap: () => notifier.setTab(ChatTab.requests),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Explanatory Banner for Requests Quarantine (SCR-E02)
            if (state.activeTab == ChatTab.requests)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: const BoxDecoration(
                  color: AppColors.surfaceWarm,
                  border: Border(bottom: BorderSide(color: AppColors.border, width: 1)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'People you aren\'t connected with. They won\'t know you\'ve read their message until you accept.',
                        style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary, height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),

            // Content List / Empty State / Error State
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.textPrimary))
                  : state.errorMessage != null && state.activeItems.isEmpty
                      ? _buildErrorState(context, state.errorMessage!, notifier)
                      : state.activeItems.isEmpty
                          ? _buildEmptyState(context, state.activeTab)
                          : RefreshIndicator(
                          color: AppColors.textPrimary,
                          onRefresh: () => notifier.loadInbox(),
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: state.activeItems.length,
                            itemBuilder: (context, index) {
                              final item = state.activeItems[index];
                              return ConversationTileWidget(
                                conversation: item,
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => E04ChatThreadScreen(conversationId: item.id),
                                    ),
                                  ).then((_) {
                                    notifier.loadInbox();
                                  });
                                },
                                onAcceptRequest: () async {
                                  await notifier.acceptRequest(item.id);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('Chat request from ${item.peerName} accepted! Moved to Primary.'),
                                        backgroundColor: AppColors.success,
                                      ),
                                    );
                                  }
                                },
                                onDeclineRequest: () async {
                                  await notifier.declineRequest(item.id);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Request from ${item.peerName} declined.')),
                                    );
                                  }
                                },
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabButton({
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
    int badgeCount = 0,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
              ),
            ),
            if (badgeCount > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : AppColors.textMuted,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$badgeCount',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// SCR-E03: Messages Empty State
  Widget _buildEmptyState(BuildContext context, ChatTab tab) {
    if (tab == ChatTab.requests) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: AppColors.backgroundSecondary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.mark_email_read_rounded, size: 48, color: AppColors.textMuted),
              ),
              const SizedBox(height: 18),
              const Text(
                'No message requests',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              const Text(
                'Direct inquiries from unverified contacts or creators will appear here for review.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
            ],
          ),
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.18),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chat_bubble_outline_rounded, size: 48, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 20),
            Text(
              'No conversations yet',
              style: AppTypography.headingMedium(color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'Connect with brands, apply to briefs or message collaborators to kick off projects.',
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.pushNamed(context, '/discover');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              child: const Text(
                'Explore Collaborators',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, String message, ConversationsNotifier notifier) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.cloud_off_rounded, size: 48, color: AppColors.error),
            ),
            const SizedBox(height: 18),
            const Text(
              'Messaging Server Connection Error',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => notifier.loadInbox(),
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry Connection', style: TextStyle(fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                elevation: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
