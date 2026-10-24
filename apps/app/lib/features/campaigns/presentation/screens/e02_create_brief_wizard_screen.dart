import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../controllers/campaign_controllers.dart';

class E02CreateBriefWizardScreen extends ConsumerStatefulWidget {
  final CampaignBrief? initialDraft;

  const E02CreateBriefWizardScreen({super.key, this.initialDraft});

  @override
  ConsumerState<E02CreateBriefWizardScreen> createState() => _E02CreateBriefWizardScreenState();
}

class _E02CreateBriefWizardScreenState extends ConsumerState<E02CreateBriefWizardScreen> {
  int _currentStep = 0;

  // Controllers for Step 1: Basics
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _selectedCategory = 'Fashion & Styling';
  String _location = 'Mumbai (Remote)';

  // Step 2: Deliverables
  final List<String> _selectedDeliverables = ['Reels', 'Story Set'];
  final _deliverableCountCtrl = TextEditingController(text: '1');
  final _targetApplicantsCtrl = TextEditingController(text: '30');

  // Step 3: Budget & Timeline
  BudgetModel _budgetModel = BudgetModel.fixed;
  final _budgetMinCtrl = TextEditingController(text: '35000');
  final _budgetMaxCtrl = TextEditingController(text: '35000');
  String _deadline = 'In 5 days';

  @override
  void initState() {
    super.initState();
    if (widget.initialDraft != null) {
      final d = widget.initialDraft!;
      _titleCtrl.text = d.title;
      _descCtrl.text = d.description;
      _selectedCategory = d.category;
      _location = d.location;
      _budgetModel = d.budgetType;
      _budgetMinCtrl.text = d.budgetMin.toString();
      _budgetMaxCtrl.text = d.budgetMax.toString();
      _deadline = d.deadline;
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _deliverableCountCtrl.dispose();
    _targetApplicantsCtrl.dispose();
    _budgetMinCtrl.dispose();
    _budgetMaxCtrl.dispose();
    super.dispose();
  }

  Future<void> _onPublish({bool asDraft = false}) async {
    final currentUser = Supabase.instance.client.auth.currentUser;
    final brandName = (currentUser?.userMetadata?['companyName'] ??
            currentUser?.userMetadata?['name'] ??
            currentUser?.email?.split('@').first ??
            'Brand')
        .toString();
    final brandLogo = currentUser?.userMetadata?['avatar_url'] as String? ?? '';
    final brandId = currentUser?.id ?? '';

    final brief = CampaignBrief(
      id: widget.initialDraft?.id ?? '',
      brandId: brandId,
      brandName: brandName,
      brandLogo: brandLogo,
      title: _titleCtrl.text.trim().isNotEmpty ? _titleCtrl.text.trim() : 'Collaboration Campaign',
      description: _descCtrl.text.trim().isNotEmpty ? _descCtrl.text.trim() : 'Seeking creators for collaboration.',
      category: _selectedCategory,
      status: asDraft ? CampaignStatus.draft : CampaignStatus.published,
      budgetType: _budgetModel,
      budgetMin: int.tryParse(_budgetMinCtrl.text) ?? 25000,
      budgetMax: int.tryParse(_budgetMaxCtrl.text) ?? 50000,
      location: _location,
      deadline: _deadline,
      deliverableTypes: _selectedDeliverables,
      targetApplicants: int.tryParse(_targetApplicantsCtrl.text) ?? 30,
    );

    final repo = ref.read(campaignRepositoryProvider);
    await repo.createBrief(brief, publishImmediately: !asDraft);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(asDraft ? 'Campaign saved as draft!' : 'Campaign published successfully! 🚀'),
          backgroundColor: const Color(0xFF2E7D32),
        ),
      );
      ref.read(brandBriefsProvider.notifier).loadBriefs();
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Post Collaboration Brief (${_currentStep + 1}/4)',
          style: AppTypography.headingMedium(color: AppColors.textPrimary),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress Bar
            LinearProgressIndicator(
              value: (_currentStep + 1) / 4.0,
              backgroundColor: AppColors.borderLight,
              color: AppColors.primary,
              minHeight: 4,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: _buildCurrentStepView(),
              ),
            ),
            // Footer Navigation
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: Row(
                children: [
                  if (_currentStep > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setState(() => _currentStep--),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textPrimary,
                          side: const BorderSide(color: AppColors.border),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Back', style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                  if (_currentStep > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () {
                        if (_currentStep < 3) {
                          setState(() => _currentStep++);
                        } else {
                          _onPublish(asDraft: false);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text(
                        _currentStep == 3 ? 'Publish Campaign' : 'Continue →',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentStepView() {
    switch (_currentStep) {
      case 0:
        return _buildStep1Basics();
      case 1:
        return _buildStep2Deliverables();
      case 2:
        return _buildStep3Budget();
      case 3:
        return _buildStep4Preview();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildStep1Basics() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Step 1: Campaign Basics', style: TextStyle(fontFamily: 'Archivo', fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Define the core title, category, and objective of this collaboration.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        const SizedBox(height: 24),
        const Text('Campaign Title', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        TextField(
          controller: _titleCtrl,
          decoration: InputDecoration(
            hintText: 'e.g. Monsoon Linen Lookbook Reel Campaign',
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 20),
        const Text('Category / Niche', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: _selectedCategory,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
          ),
          items: const [
            DropdownMenuItem(value: 'Fashion & Styling', child: Text('Fashion & Styling')),
            DropdownMenuItem(value: 'Beauty & Skincare', child: Text('Beauty & Skincare')),
            DropdownMenuItem(value: 'Consumer Tech', child: Text('Consumer Tech')),
            DropdownMenuItem(value: 'Food & Culinary', child: Text('Food & Culinary')),
            DropdownMenuItem(value: 'Fitness & Health', child: Text('Fitness & Health')),
          ],
          onChanged: (val) {
            if (val != null) setState(() => _selectedCategory = val);
          },
        ),
        const SizedBox(height: 20),
        const Text('Campaign Scope / Description', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        TextField(
          controller: _descCtrl,
          maxLines: 4,
          decoration: InputDecoration(
            hintText: 'Describe brand vibe, deliverables expectation, and style guidelines...',
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 20),
        const Text('Location Requirement', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: _location,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
          ),
          items: const [
            DropdownMenuItem(value: 'Pan-India (Remote)', child: Text('Pan-India (Remote)')),
            DropdownMenuItem(value: 'Mumbai (On-site / Studio)', child: Text('Mumbai (On-site / Studio)')),
            DropdownMenuItem(value: 'Bengaluru', child: Text('Bengaluru')),
            DropdownMenuItem(value: 'Delhi NCR', child: Text('Delhi NCR')),
          ],
          onChanged: (val) {
            if (val != null) setState(() => _location = val);
          },
        ),
      ],
    );
  }

  Widget _buildStep2Deliverables() {
    const availableTags = ['Reels', 'YouTube Review', 'Story Set', 'UGC Video', 'Carousel', 'Dedicated Short'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Step 2: Deliverables & Criteria', style: TextStyle(fontFamily: 'Archivo', fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Specify what deliverables creators will produce for this campaign.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        const SizedBox(height: 24),
        const Text('Select Required Deliverables', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: availableTags.map((tag) {
            final isSelected = _selectedDeliverables.contains(tag);
            return FilterChip(
              label: Text(tag),
              selected: isSelected,
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.surfaceWarm,
              labelStyle: TextStyle(fontWeight: FontWeight.w700, color: isSelected ? AppColors.textPrimary : AppColors.textSecondary),
              onSelected: (selected) {
                setState(() {
                  if (selected) {
                    _selectedDeliverables.add(tag);
                  } else {
                    _selectedDeliverables.remove(tag);
                  }
                });
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 24),
        const Text('Target Applicants Limit', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        TextField(
          controller: _targetApplicantsCtrl,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
      ],
    );
  }

  Widget _buildStep3Budget() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Step 3: Budget & Timeline', style: TextStyle(fontFamily: 'Archivo', fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Set compensation model and application deadline.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        const SizedBox(height: 24),
        const Text('Budget Structure', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: RadioListTile<BudgetModel>(
                title: const Text('Fixed Rate', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                value: BudgetModel.fixed,
                groupValue: _budgetModel,
                onChanged: (val) => setState(() => _budgetModel = val!),
                contentPadding: EdgeInsets.zero,
              ),
            ),
            Expanded(
              child: RadioListTile<BudgetModel>(
                title: const Text('Range', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                value: BudgetModel.range,
                groupValue: _budgetModel,
                onChanged: (val) => setState(() => _budgetModel = val!),
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text('Budget Amount (INR ₹)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _budgetMinCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: _budgetModel == BudgetModel.range ? 'Min Budget (₹)' : 'Amount (₹)',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                ),
              ),
            ),
            if (_budgetModel == BudgetModel.range) ...[
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _budgetMaxCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Max Budget (₹)',
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 20),
        const Text('Application Deadline', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: _deadline,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
          ),
          items: const [
            DropdownMenuItem(value: 'In 3 days', child: Text('In 3 days')),
            DropdownMenuItem(value: 'In 5 days', child: Text('In 5 days')),
            DropdownMenuItem(value: 'In 1 week', child: Text('In 1 week')),
            DropdownMenuItem(value: 'In 2 weeks', child: Text('In 2 weeks')),
          ],
          onChanged: (val) {
            if (val != null) setState(() => _deadline = val);
          },
        ),
      ],
    );
  }

  Widget _buildStep4Preview() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Step 4: Preview & Publish', style: TextStyle(fontFamily: 'Archivo', fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Review your campaign brief before launching to verified talent.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.surfacePure,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.borderLight, width: 1.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFFFFF9E6), borderRadius: BorderRadius.circular(99)),
                    child: Text(_selectedCategory, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF8A6D00))),
                  ),
                  Text(_deadline, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                ],
              ),
              const SizedBox(height: 12),
              Text(_titleCtrl.text.isEmpty ? 'Untitled Campaign' : _titleCtrl.text, style: AppTypography.headingMedium(color: AppColors.textPrimary)),
              const SizedBox(height: 8),
              Text(_descCtrl.text.isEmpty ? 'No description provided.' : _descCtrl.text, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.35)),
              const SizedBox(height: 16),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _selectedDeliverables.map((d) => Chip(label: Text(d, style: const TextStyle(fontSize: 11)), backgroundColor: AppColors.surfaceWarm)).toList(),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1, color: AppColors.borderLight),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Budget Offer', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                  Text('₹${_budgetMinCtrl.text}', style: const TextStyle(fontFamily: 'Archivo', fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => _onPublish(asDraft: true),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Save as Draft', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
