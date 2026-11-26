import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/applications_invites_controllers.dart';
import '../dialogs/dlg_50_withdraw_application_dialog.dart';
import '../widgets/application_card_widget.dart';
import 'h03_application_detail_screen.dart';

/// H02: My Applications Dashboard (Master Catalogue §H, Page 9 & 23)
class H02MyApplicationsScreen extends ConsumerWidget {
  const H02MyApplicationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(applicationsListProvider);
    final activeFilter = ref.watch(applicationTabFilterProvider);
    final applications = ref.watch(filteredApplicationsProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'My Applications',
          style: AppTypography.headingLarge().copyWith(fontSize: 20),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: ApplicationTabFilter.values.map((filter) {
                    final isSelected = activeFilter == filter;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () {
                          ref.read(applicationTabFilterProvider.notifier).state =
                              filter;
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.textPrimary
                                : AppColors.backgroundSecondary,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            filter.label,
                            style: TextStyle(
                              color: isSelected
                                  ? Colors.white
                                  : AppColors.textSecondary,
                              fontSize: 11.5,
                              fontWeight:
                                  isSelected ? FontWeight.w800 : FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Container(color: AppColors.border, height: 1),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.textPrimary,
          backgroundColor: AppColors.primary,
          onRefresh: () async {
            await ref
                .read(applicationsListProvider.notifier)
                .loadApplications();
          },
          child: state.isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.textPrimary),
                )
              : applications.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: AppColors.backgroundSecondary,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            alignment: Alignment.center,
                            child: const Text('📋', style: TextStyle(fontSize: 28)),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'No ${activeFilter.label.toLowerCase()} applications',
                            style: AppTypography.headingMedium().copyWith(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Browse active briefs to discover opportunities and submit pitches.',
                            style: AppTypography.bodyMedium(
                              color: AppColors.textSecondary,
                            ).copyWith(fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: applications.length,
                      itemBuilder: (context, index) {
                        final app = applications[index];
                        return ApplicationCardWidget(
                          application: app,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    H03ApplicationDetailScreen(applicationId: app.id),
                              ),
                            );
                          },
                          onOpenChat: () {
                            Navigator.pushNamed(context, '/conversations');
                          },
                          onWithdraw: () {
                            Dlg50WithdrawApplicationDialog.show(
                              context,
                              brandName: app.brandName,
                              isShortlisted: app.isShortlisted,
                              onConfirmWithdraw: () async {
                                final ok = await ref
                                    .read(applicationsListProvider.notifier)
                                    .withdrawApplication(app.id);
                                if (context.mounted && ok) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Proposal withdrawn.'),
                                    ),
                                  );
                                }
                              },
                            );
                          },
                        );
                      },
                    ),
        ),
      ),
    );
  }
}
