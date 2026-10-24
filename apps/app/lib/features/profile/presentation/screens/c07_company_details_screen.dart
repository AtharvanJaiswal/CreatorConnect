import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../bottom_sheets/city_picker_sheet.dart';
import '../dialogs/discard_changes_dialog.dart';

class C07CompanyDetailsScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const C07CompanyDetailsScreen({super.key, this.repository});

  @override
  State<C07CompanyDetailsScreen> createState() => _C07CompanyDetailsScreenState();
}

class _C07CompanyDetailsScreenState extends State<C07CompanyDetailsScreen> {
  late final ProfileRepository _repo;
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _websiteCtrl;
  late final TextEditingController _gstCtrl;

  String _category = '';
  String _city = '';
  String _teamSize = '';

  bool _isSaving = false;
  bool _isDirty = false;

  static const List<String> _industries = [
    'Home & Lifestyle',
    'Fashion & Apparel',
    'D2C FMCG & Food',
    'Beauty & Skincare',
    'Consumer Tech & Electronics',
    'FinTech & Banking',
    'EdTech & Learning',
    'Health & Wellness',
    'Media & Gaming',
  ];

  static const List<String> _teamSizes = [
    '1–10',
    '11–50',
    '51–200',
    '201–500',
    '500+',
  ];

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _nameCtrl = TextEditingController();
    _descCtrl = TextEditingController();
    _websiteCtrl = TextEditingController();
    _gstCtrl = TextEditingController();
    _nameCtrl.addListener(_saveDraft);
    _descCtrl.addListener(_saveDraft);
    _websiteCtrl.addListener(_saveDraft);
    _gstCtrl.addListener(_saveDraft);
    _loadInitialData();
  }

  void _saveDraft() {
    if (!mounted) return;
    _repo.saveCompanyDetailsDraft(CompanyDetailsData(
      companyName: _nameCtrl.text.trim(),
      description: _descCtrl.text.trim(),
      businessCategory: _category,
      city: _city,
      teamSize: _teamSize,
      websiteUrl: _websiteCtrl.text.trim(),
      gstNumber: _gstCtrl.text.trim().isNotEmpty ? _gstCtrl.text.trim() : null,
    ));
  }

  Future<void> _loadInitialData() async {
    final details = await _repo.getCompanyDetails();
    if (!mounted) return;
    setState(() {
      _nameCtrl.text = details.companyName;
      _descCtrl.text = details.description;
      _category = details.businessCategory;
      _city = details.city;
      _teamSize = details.teamSize;
      _websiteCtrl.text = details.websiteUrl;
      _gstCtrl.text = details.gstNumber ?? '';
    });
  }

  Future<void> _pickCity() async {
    final selected = await CityPickerSheet.show(context, currentCity: _city);
    if (selected != null) {
      setState(() {
        _city = selected.city;
        _isDirty = true;
      });
      _saveDraft();
    }
  }

  Future<void> _saveAndContinue() async {
    if (!_formKey.currentState!.validate()) return;
    if (_category.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select an industry sector'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }
    if (_city.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select headquarters city'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }
    if (_teamSize.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select company size'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    final data = CompanyDetailsData(
      companyName: _nameCtrl.text.trim(),
      description: _descCtrl.text.trim(),
      businessCategory: _category,
      city: _city,
      teamSize: _teamSize,
      websiteUrl: _websiteCtrl.text.trim(),
      gstNumber: _gstCtrl.text.trim().isNotEmpty ? _gstCtrl.text.trim().toUpperCase() : null,
    );

    await _repo.updateCompanyDetails(data);

    if (mounted) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Company details saved!'),
          backgroundColor: Color(0xFF2E7D32),
        ),
      );
      Navigator.pop(context, true);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _websiteCtrl.dispose();
    _gstCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_isDirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          final discard = await DiscardChangesDialog.show(context);
          if (discard && context.mounted) {
            Navigator.pop(context);
          }
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.backgroundWarm,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
            onPressed: () async {
              if (_isDirty) {
                final discard = await DiscardChangesDialog.show(context);
                if (discard && context.mounted) {
                  Navigator.pop(context);
                }
              } else {
                Navigator.pop(context);
              }
            },
          ),
          title: const Text(
            'Company Details',
            style: TextStyle(
              fontFamily: 'Archivo',
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          centerTitle: false,
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    children: [
                      const Text(
                        'Registered Company / Brand Name',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _nameCtrl,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('e.g. Studio Frame Co.'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter company name' : null,
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Industry / Sector',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: AppColors.surfacePure,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.borderLight),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _category.isNotEmpty ? _category : null,
                            hint: const Text('Select industry sector', style: TextStyle(color: AppColors.textTertiary)),
                            isExpanded: true,
                            items: _industries.map((ind) => DropdownMenuItem(value: ind, child: Text(ind))).toList(),
                            onChanged: (v) {
                              if (v != null) {
                                setState(() {
                                  _category = v;
                                  _isDirty = true;
                                });
                                _saveDraft();
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'About the Brand',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _descCtrl,
                        maxLines: 3,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('Short bio describing your brand mission and products'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please provide brand description' : null,
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Headquarters City',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: _pickCity,
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: AppColors.surfacePure,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.borderLight),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.location_city_outlined, color: AppColors.textSecondary, size: 22),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  _city.isNotEmpty ? _city : 'Select headquarters city',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: _city.isNotEmpty ? AppColors.textPrimary : AppColors.textTertiary,
                                  ),
                                ),
                              ),
                              const Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Team Size',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: _teamSizes.map((size) {
                          final isSelected = _teamSize == size;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  _teamSize = size;
                                  _isDirty = true;
                                });
                                _saveDraft();
                              },
                              child: Container(
                                margin: const EdgeInsets.symmetric(horizontal: 3),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFFFFF3CD) : AppColors.surfacePure,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSelected ? AppColors.primary : AppColors.borderLight,
                                    width: isSelected ? 1.8 : 1.0,
                                  ),
                                ),
                                child: Text(
                                  size,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Official Website',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _websiteCtrl,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('https://yourcompany.com'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter website URL' : null,
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'GSTIN (Optional for Level 1, Required for Level 2)',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _gstCtrl,
                        textCapitalization: TextCapitalization.characters,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(
                          fontSize: 15,
                          fontFamily: 'Courier',
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                        decoration: _inputDecoration('29ABCDE1234F1Z5'),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              // Sticky Save Footer
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                decoration: const BoxDecoration(
                  color: AppColors.surfacePure,
                  border: Border(top: BorderSide(color: AppColors.borderLight)),
                ),
                child: SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    onPressed: _isSaving ? null : _saveAndContinue,
                    child: _isSaving
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.textPrimary),
                          )
                        : const Text(
                            'Save company details',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 14),
      filled: true,
      fillColor: AppColors.surfacePure,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.borderLight),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.borderLight),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
    );
  }
}
