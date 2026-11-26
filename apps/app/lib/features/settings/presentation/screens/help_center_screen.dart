import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../widgets/settings_components.dart';

/// N08: Help Centre (SCR-054) Screen
class HelpCenterScreen extends StatefulWidget {
  const HelpCenterScreen({super.key});

  @override
  State<HelpCenterScreen> createState() => _HelpCenterScreenState();
}

class _HelpCenterScreenState extends State<HelpCenterScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'All';

  final List<Map<String, String>> _allFaqs = [
    {
      'category': 'Payments & Escrow',
      'question': 'How does milestone escrow release work?',
      'answer':
          'When an assignment is booked, client funds are securely held in a tripartite escrow trust. Once you deliver the project assets and the brand approves them (or after the 72-hour review inspection window lapses without dispute), funds are instantly released directly to your verified payout account.',
    },
    {
      'category': 'Briefs & Pitches',
      'question': 'What happens if a brand cancels a brief?',
      'answer':
          'If a brand cancels an active brief before work begins, you are notified immediately. If work has already been accepted and submitted, the escrow terms protect your work through formal dispute reconciliation or partial milestone disbursement under SOW §19.',
    },
    {
      'category': 'Level 1 Verification',
      'question': 'How do I verify external portfolio links?',
      'answer':
          'Navigate to Profile > Social Accounts to connect your YouTube, Instagram, or Behance channels using secure OAuth. Verified links earn your profile higher search placement and a verified badge.',
    },
    {
      'category': 'Dispute Resolution',
      'question': 'How is creator commission calculated?',
      'answer':
          'CreatorConnect charges transparent platform fees tiered by project volume. The exact breakdown is displayed on the contract confirmation sheet before escrow commitment with zero hidden deductions.',
    },
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final filteredFaqs = _allFaqs.where((faq) {
      final matchesQuery = query.isEmpty ||
          faq['question']!.toLowerCase().contains(query) ||
          faq['answer']!.toLowerCase().contains(query);
      final matchesCategory = _selectedCategory == 'All' || faq['category'] == _selectedCategory;
      return matchesQuery && matchesCategory;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Help Centre',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search Bar
            TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Search help topics or escrow questions…',
                hintStyle: const TextStyle(fontSize: 14, color: AppColors.textMuted),
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18),
                        onPressed: () => setState(() => _searchController.clear()),
                      )
                    : null,
                filled: true,
                fillColor: AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.input),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.input),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Topic Cards Grid
            Row(
              children: [
                Expanded(
                  child: _buildTopicCard(
                    icon: '💳',
                    label: 'Payments & Escrow',
                    onTap: () => setState(() => _selectedCategory = 'Payments & Escrow'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildTopicCard(
                    icon: '📋',
                    label: 'Briefs & Pitches',
                    onTap: () => setState(() => _selectedCategory = 'Briefs & Pitches'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _buildTopicCard(
                    icon: '⭐',
                    label: 'Level 1 Verification',
                    onTap: () => setState(() => _selectedCategory = 'Level 1 Verification'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildTopicCard(
                    icon: '⚖️',
                    label: 'Dispute Resolution',
                    onTap: () => setState(() => _selectedCategory = 'Dispute Resolution'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // FAQs Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'FREQUENTLY ASKED QUESTIONS',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                if (_selectedCategory != 'All')
                  TextButton(
                    onPressed: () => setState(() => _selectedCategory = 'All'),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Show All', style: TextStyle(fontSize: 12, color: AppColors.warning)),
                  ),
              ],
            ),
            const SizedBox(height: 10),

            SettingsGroupCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              children: [
                for (int i = 0; i < filteredFaqs.length; i++) ...[
                  if (i > 0) const Divider(height: 1, color: AppColors.backgroundSecondary),
                  ExpansionTile(
                    tilePadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    childrenPadding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                    shape: const Border(),
                    collapsedShape: const Border(),
                    title: Text(
                      filteredFaqs[i]['question']!,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    children: [
                      Text(
                        filteredFaqs[i]['answer']!,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
            const SizedBox(height: 24),

            // Contact Support Callout Footer
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Cannot find what you need?',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Our support team is available 24/7 for active assignments',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pushNamed(context, '/settings/support'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.button),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text(
                        'Contact Support Team →',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                      ),
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

  Widget _buildTopicCard({
    required String icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final isSelected = _selectedCategory == label;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withOpacity(0.18) : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Text(icon, style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
