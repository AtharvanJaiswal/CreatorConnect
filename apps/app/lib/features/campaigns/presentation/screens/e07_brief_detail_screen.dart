import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../controllers/campaign_controllers.dart';

class E07BriefDetailScreen extends ConsumerStatefulWidget {
  final String briefId;

  const E07BriefDetailScreen({super.key, required this.briefId});

  @override
  ConsumerState<E07BriefDetailScreen> createState() => _E07BriefDetailScreenState();
}

class _E07BriefDetailScreenState extends ConsumerState<E07BriefDetailScreen> {
  bool _isBookmarked = false;

  @override
  Widget build(BuildContext context) {
    final briefAsync = ref.watch(briefDetailProvider(widget.briefId));

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: briefAsync.when(
        data: (brief) {
          if (brief == null) {
            return const Center(child: Text('Campaign brief not found.'));
          }
          return _buildBody(context, ref, brief);
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.textPrimary)),
        error: (err, _) => Center(child: Text('Error loading brief: $err')),
      ),
    );
  }

  Widget _buildBody(BuildContext context, WidgetRef ref, CampaignBrief brief) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 180,
            pinned: true,
            backgroundColor: AppColors.textPrimary,
            leading: CircleAvatar(
              backgroundColor: Colors.black45,
              child: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            actions: [
              CircleAvatar(
                backgroundColor: Colors.black45,
                child: IconButton(
                  icon: Icon(
                    brief.isBookmarked || _isBookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                    color: Colors.white,
                  ),
                  onPressed: () async {
                    final saved = await ref.read(campaignRepositoryProvider).toggleBookmarkBrief(brief.id);
                    setState(() => _isBookmarked = saved);
                    ref.invalidate(briefDetailProvider(widget.briefId));
                  },
                ),
              ),
              const SizedBox(width: 8),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF2C2520), Color(0xFF121212)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        brief.category,
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Brand Header row
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundImage: brief.brandLogo.isNotEmpty ? NetworkImage(brief.brandLogo) : null,
                        child: brief.brandLogo.isEmpty ? const Icon(Icons.business_rounded, size: 20) : null,
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(brief.brandName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                              const SizedBox(width: 4),
                              const Icon(Icons.verified_rounded, size: 14, color: AppColors.primaryDark),
                            ],
                          ),
                          Text('Posted ${brief.createdAt}', style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Title & Budget Box
                  Text(brief.title, style: AppTypography.headingLarge().copyWith(fontSize: 22)),
                  const SizedBox(height: 14),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surfacePure,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.borderLight, width: 1.5),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Fixed Budget', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                            const SizedBox(height: 2),
                            Text(brief.budgetFormatted, style: const TextStyle(fontFamily: 'Archivo', fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
                          ],
                        ),
                        Container(height: 32, width: 1, color: AppColors.borderLight),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Deadline', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                            const SizedBox(height: 2),
                            Text(brief.deadline, style: const TextStyle(fontFamily: 'Archivo', fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Overview / Description
                  const Text('Campaign Overview', style: TextStyle(fontFamily: 'Archivo', fontSize: 17, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(brief.description, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.45)),
                  const SizedBox(height: 24),

                  // Deliverable Types
                  const Text('Deliverable Requirements', style: TextStyle(fontFamily: 'Archivo', fontSize: 17, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: brief.deliverableTypes.map((tag) {
                      return Chip(
                        label: Text(tag, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                        backgroundColor: AppColors.surfaceWarm,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),

                  // Brand Guidelines / Dos & Don'ts
                  const Text('Guidelines & Standards', style: TextStyle(fontFamily: 'Archivo', fontSize: 17, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  ...brief.guidelines.map((g) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF27AE60)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(g, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.35)),
                          ),
                        ],
                      ),
                    );
                  }),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomSheet: Container(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.borderLight)),
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pushNamed(context, '/conversations'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Ask Question', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pushNamed(context, '/campaigns/apply', arguments: brief);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Apply / Send Pitch →', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
