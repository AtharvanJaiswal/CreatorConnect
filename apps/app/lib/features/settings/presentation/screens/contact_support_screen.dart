import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/entities/settings_entities.dart';
import '../controllers/settings_controllers.dart';
import '../widgets/settings_components.dart';

/// N09: Contact Support (SCR-055) Screen
class ContactSupportScreen extends ConsumerStatefulWidget {
  const ContactSupportScreen({super.key});

  @override
  ConsumerState<ContactSupportScreen> createState() => _ContactSupportScreenState();
}

class _ContactSupportScreenState extends ConsumerState<ContactSupportScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _subjectController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _assignmentController = TextEditingController();

  SupportCategory _selectedCategory = SupportCategory.escrowReconciliation;
  bool _hasAttachment = false;

  @override
  void dispose() {
    _subjectController.dispose();
    _descController.dispose();
    _assignmentController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final notifier = ref.read(supportTicketControllerProvider.notifier);
    final ticket = await notifier.submitTicket(
      category: _selectedCategory,
      subject: _subjectController.text.trim(),
      description: _descController.text.trim(),
      linkedAssignmentId: _assignmentController.text.trim().isNotEmpty
          ? _assignmentController.text.trim()
          : null,
    );

    if (mounted && ticket != null) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.modal)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎉', style: TextStyle(fontSize: 36)),
              const SizedBox(height: 12),
              const Text(
                'Ticket Submitted!',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Your ticket ${ticket.ticketNumber} has been logged. Our escrow and support team will respond within 24 hours.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.button)),
                ),
                child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(supportTicketControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Contact Support',
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
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SettingsGroupCard(
                title: 'TICKET DETAILS',
                children: [
                  const Text(
                    'Select Issue Category *',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: AppColors.backgroundPrimary,
                      borderRadius: BorderRadius.circular(AppRadii.input),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<SupportCategory>(
                        value: _selectedCategory,
                        isExpanded: true,
                        style: const TextStyle(fontSize: 14, color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                        items: SupportCategory.values.map((cat) {
                          return DropdownMenuItem(value: cat, child: Text(cat.label));
                        }).toList(),
                        onChanged: (cat) {
                          if (cat != null) setState(() => _selectedCategory = cat);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  const Text(
                    'Related Assignment (Optional)',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _assignmentController,
                    decoration: InputDecoration(
                      hintText: 'e.g. Summer Reels Campaign (#ASN-00412)',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.backgroundPrimary,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                  const SizedBox(height: 16),

                  const Text(
                    'Subject *',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _subjectController,
                    validator: (v) => (v == null || v.trim().length < 5) ? 'Minimum 5 characters required' : null,
                    decoration: InputDecoration(
                      hintText: 'e.g. Milestone 2 payment delay',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.backgroundPrimary,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                  const SizedBox(height: 16),

                  const Text(
                    'Explain the Issue *',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _descController,
                    maxLines: 4,
                    validator: (v) => (v == null || v.trim().length < 10) ? 'Please explain the issue (min 10 characters)' : null,
                    decoration: InputDecoration(
                      hintText: 'Provide details about the milestone, chat date, or contract problem…',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.backgroundPrimary,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                  const SizedBox(height: 16),

                  // Attachments
                  const Text(
                    'Attach Screenshots / Receipts',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () {
                      setState(() => _hasAttachment = !_hasAttachment);
                    },
                    borderRadius: BorderRadius.circular(AppRadii.input),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                      decoration: BoxDecoration(
                        color: AppColors.backgroundPrimary,
                        borderRadius: BorderRadius.circular(AppRadii.input),
                        border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _hasAttachment ? Icons.check_circle_rounded : Icons.add_photo_alternate_outlined,
                            size: 18,
                            color: _hasAttachment ? AppColors.success : AppColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _hasAttachment ? 'Screenshot Attached (deliverable_receipt.png)' : '+ Add Screenshot (PNG, PDF)',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: _hasAttachment ? AppColors.success : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: state.isSubmitting ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.button),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: state.isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textPrimary),
                        )
                      : const Text(
                          'Submit Ticket (#TKT-NEW) →',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
