import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../widgets/settings_components.dart';

/// N10: Legal Documents (SCR-056) Screen
class LegalPoliciesScreen extends StatelessWidget {
  const LegalPoliciesScreen({super.key});

  void _showDocumentSheet(BuildContext context, String title, String body) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.modal)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.8,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (_, scrollController) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: scrollController,
                      child: Text(
                        body,
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Legal & Policies',
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
            const Text(
              'Platform terms, privacy agreements, and commercial escrow rules governing transactions on CreatorConnect.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),

            SettingsGroupCard(
              title: 'LEGAL AGREEMENTS & POLICIES',
              children: [
                SettingsNavTile(
                  leading: const Text('📜', style: TextStyle(fontSize: 20)),
                  title: 'Terms of Service',
                  subtitle: 'Last updated: 1 Nov 2026',
                  onTap: () => _showDocumentSheet(
                    context,
                    'Terms of Service',
                    'Welcome to CreatorConnect. By accessing or using our platform, mobile application, and related services, you agree to be bound by these Terms of Service.\n\n1. Scope of Service\nCreatorConnect provides a marketplace and escrow-enabled collaboration infrastructure connecting independent creators, production professionals, and commercial brands.\n\n2. User Accounts & Verification\nAll registered accounts must provide accurate identity information. Multi-role creative profiles operate under a singular legal identity, while Brand accounts represent verified corporate entities.\n\n3. Commercial Deliverables & Escrow\nAll project milestones are transacted through regulated trust escrow accounts. Milestone release requires formal client signoff or expiration of the 72-hour review period without dispute.',
                  ),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('🔒', style: TextStyle(fontSize: 20)),
                  title: 'Privacy Policy (GDPR / DPDP)',
                  subtitle: 'Data handling, storage, and erasure terms',
                  onTap: () => _showDocumentSheet(
                    context,
                    'Privacy Policy (GDPR / DPDP)',
                    'CreatorConnect complies with the Digital Personal Data Protection Act (DPDPA 2023) and General Data Protection Regulation (GDPR Article 17).\n\n1. Personal Data Collected\nWe collect profile identifiers, communication histories, portfolio assets, and payment verification records.\n\n2. Right to Erasure\nYou may request permanent deletion of your data at any time under Settings > Account Details > Delete Account, provided no active escrow contracts remain unsettled.\n\n3. Third-Party Processors\nPortfolio assets are encrypted and served via Cloudflare R2. Payment metadata is processed via licensed escrow gateways.',
                  ),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('⚖️', style: TextStyle(fontSize: 20)),
                  title: 'Escrow & Payment Agreement',
                  subtitle: 'Platform commission & payout terms',
                  onTap: () => _showDocumentSheet(
                    context,
                    'Escrow & Payment Agreement',
                    'This Escrow and Payment Agreement governs the holding and disbursement of commercial funds on CreatorConnect.\n\n1. Tripartite Trust\nClient deposits are held in dedicated escrow trust accounts until milestone deliverable acceptance.\n\n2. Dispute Resolution\nIn case of contested deliverables, funds remain locked in escrow until mutual resolution or platform arbitration under SOW §19.\n\n3. Fees & Taxes\nPlatform convenience fees and applicable GST / TDS deductions are calculated and itemized prior to milestone fund locking.',
                  ),
                ),
                const Divider(height: 1, color: AppColors.backgroundSecondary),
                SettingsNavTile(
                  leading: const Text('🛡️', style: TextStyle(fontSize: 20)),
                  title: 'Community Guidelines',
                  subtitle: 'Anti-harassment & quality standards',
                  onTap: () => _showDocumentSheet(
                    context,
                    'Community Guidelines',
                    'CreatorConnect enforces zero-tolerance standards against harassment, deceptive impersonation, portfolio copyright infringement, and off-platform escrow circumvention.\n\nViolations result in immediate account suspension and review by our Trust & Safety committee.',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Registered Entity Footer
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary.withOpacity(0.6),
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.border),
              ),
              child: const Text(
                'Registered Entity: Codly360 Technologies Pvt. Ltd. · CIN: U72900MH2024PTC412001 · Mumbai, Maharashtra, India.',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
