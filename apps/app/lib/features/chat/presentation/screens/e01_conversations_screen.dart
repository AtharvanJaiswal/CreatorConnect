import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/chat_entities.dart';
import '../controllers/chat_controllers.dart';
import '../widgets/conversation_tile_widget.dart';
import '../screens/e04_chat_thread_screen.dart';

class E01ConversationsScreen extends ConsumerStatefulWidget {
  const E01ConversationsScreen({super.key});

  @override
  ConsumerState<E01ConversationsScreen> createState() => _E01ConversationsScreenState();
}

class _E01ConversationsScreenState extends ConsumerState<E01ConversationsScreen> {
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
        title: Text(
          'Messages & Collabs',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Segmented Tabs: Primary vs Requests
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: Colors.white,
              child: Row(
                children: [
                  _tabChip(
                    label: 'Primary (${state.primaryConversations.length})',
                    isSelected: state.activeTab == ChatTab.primary,
                    onTap: () => notifier.setTab(ChatTab.primary),
                  ),
                  const SizedBox(width: 8),
                  _tabChip(
                    label: 'Requests (${state.requestConversations.length})',
                    isSelected: state.activeTab == ChatTab.requests,
                    onTap: () => notifier.setTab(ChatTab.requests),
                    hasBadge: state.requestConversations.isNotEmpty,
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),

            // Search Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _searchCtrl,
                        decoration: const InputDecoration(
                          hintText: 'Search chats or brands...',
                          hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 13),
                          border: InputBorder.none,
                          isDense: true,
                        ),
                        onChanged: (val) => notifier.setSearchQuery(val),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Conversations List or Empty State
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.textPrimary))
                  : state.activeItems.isEmpty
                      ? _buildEmptyState(state.activeTab)
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: state.activeItems.length,
                          itemBuilder: (context, idx) {
                            final conv = state.activeItems[idx];
                            return ConversationTileWidget(
                              conversation: conv,
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => E04ChatThreadScreen(conversationId: conv.id),
                                  ),
                                );
                              },
                              onAcceptRequest: () => notifier.acceptRequest(conv.id),
                              onDeclineRequest: () => notifier.declineRequest(conv.id),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    bool hasBadge = false,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.surfaceWarm,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: isSelected ? AppColors.primaryDark : AppColors.borderLight),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              if (hasBadge && !isSelected) ...[
                const SizedBox(width: 6),
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(ChatTab tab) {
    final isReq = tab == ChatTab.requests;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isReq ? Icons.mark_email_unread_outlined : Icons.chat_bubble_outline_rounded, size: 52, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(isReq ? 'No pending message requests' : 'No active conversations', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 8),
            Text(
              isReq ? 'Outreach from unverified or unconnected profiles will appear here.' : 'Connect with collaborators or brands to start messaging.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted, height: 1.35),
            ),
          ],
        ),
      ),
    );
  }
}
