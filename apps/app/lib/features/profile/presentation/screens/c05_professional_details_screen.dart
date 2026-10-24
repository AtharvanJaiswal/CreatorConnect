import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../bottom_sheets/multi_select_sheet.dart';
import '../dialogs/discard_changes_dialog.dart';

class C05ProfessionalDetailsScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const C05ProfessionalDetailsScreen({super.key, this.repository});

  @override
  State<C05ProfessionalDetailsScreen> createState() => _C05ProfessionalDetailsScreenState();
}

class _C05ProfessionalDetailsScreenState extends State<C05ProfessionalDetailsScreen> {
  late final ProfileRepository _repo;
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _minRateCtrl;
  late final TextEditingController _maxRateCtrl;

  String _proType = '';
  String _experience = '';
  List<String> _tools = [];
  RateUnit _rateUnit = RateUnit.perProject;
  bool _hasPortfolioSample = false;

  bool _isSaving = false;
  bool _isDirty = false;

  static const List<String> _proTypes = [
    'Video editor',
    'Cinematographer',
    'Colorist',
    'Sound designer',
    '2D/3D Animator',
    'Thumbnail designer',
    'Scriptwriter',
    'Channel manager',
  ];

  static const List<String> _experienceTiers = [
    '< 1 year',
    '1–3 years',
    '3–5 years',
    '5+ years',
  ];

  static const List<String> _allTools = [
    'Premiere Pro',
    'DaVinci Resolve',
    'After Effects',
    'Final Cut Pro',
    'Photoshop',
    'Lightroom',
    'Blender',
    'Cinema 4D',
    'Pro Tools',
    'Logic Pro',
    'CapCut Pro',
    'Figma',
  ];

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _minRateCtrl = TextEditingController();
    _maxRateCtrl = TextEditingController();
    _minRateCtrl.addListener(_saveDraft);
    _maxRateCtrl.addListener(_saveDraft);
    _loadInitialData();
  }

  void _saveDraft() {
    if (!mounted) return;
    final minR = int.tryParse(_minRateCtrl.text.trim());
    final maxR = int.tryParse(_maxRateCtrl.text.trim());
    _repo.saveProfessionalDetailsDraft(ProfessionalDetailsData(
      professionalType: _proType,
      experience: _experience,
      tools: _tools,
      minRate: minR,
      maxRate: maxR,
      rateUnit: _rateUnit,
      hasPortfolioSample: _hasPortfolioSample,
    ));
  }

  Future<void> _loadInitialData() async {
    final details = await _repo.getProfessionalDetails();
    if (!mounted) return;
    setState(() {
      _proType = details.professionalType;
      _experience = details.experience;
      _tools = List.from(details.tools);
      _minRateCtrl.text = details.minRate != null ? details.minRate.toString() : '';
      _maxRateCtrl.text = details.maxRate != null ? details.maxRate.toString() : '';
      _rateUnit = details.rateUnit;
      _hasPortfolioSample = details.hasPortfolioSample;
    });
  }

  Future<void> _pickTools() async {
    final selected = await MultiSelectSheet.show(
      context,
      title: 'Tools & Software',
      subtitle: 'Pick software you are proficient with',
      availableItems: _allTools,
      initialSelected: _tools,
    );

    if (selected != null) {
      setState(() {
        _tools = selected;
        _isDirty = true;
      });
      _saveDraft();
    }
  }

  Future<void> _saveAndContinue() async {
    if (_proType.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select your creative role'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final minR = int.tryParse(_minRateCtrl.text.trim());
    final maxR = int.tryParse(_maxRateCtrl.text.trim());

    final data = ProfessionalDetailsData(
      professionalType: _proType,
      experience: _experience,
      tools: _tools,
      minRate: minR,
      maxRate: maxR,
      rateUnit: _rateUnit,
      hasPortfolioSample: _hasPortfolioSample,
    );

    await _repo.updateProfessionalDetails(data);

    if (mounted) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Professional details saved!'),
          backgroundColor: Color(0xFF2E7D32),
        ),
      );
      Navigator.pop(context, true);
    }
  }

  @override
  void dispose() {
    _minRateCtrl.dispose();
    _maxRateCtrl.dispose();
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
            'Professional Details',
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
                        'Creative Role',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
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
                            value: _proType.isNotEmpty ? _proType : null,
                            hint: const Text('Select your creative role', style: TextStyle(color: AppColors.textTertiary)),
                            isExpanded: true,
                            items: _proTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                            onChanged: (v) {
                              if (v != null) {
                                setState(() {
                                  _proType = v;
                                  _isDirty = true;
                                });
                                _saveDraft();
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Industry Experience',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
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
                            value: _experience.isNotEmpty ? _experience : null,
                            hint: const Text('Select experience tier', style: TextStyle(color: AppColors.textTertiary)),
                            isExpanded: true,
                            items: _experienceTiers.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                            onChanged: (v) {
                              if (v != null) {
                                setState(() {
                                  _experience = v;
                                  _isDirty = true;
                                });
                                _saveDraft();
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      // Tools & Software
                      const Text(
                        'Tools & Equipment',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ..._tools.map(
                            (t) => Chip(
                              label: Text(t, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              backgroundColor: AppColors.surfacePure,
                              side: const BorderSide(color: AppColors.borderLight),
                              deleteIcon: const Icon(Icons.close, size: 16),
                              onDeleted: () {
                                setState(() {
                                  _tools.remove(t);
                                  _isDirty = true;
                                });
                                _saveDraft();
                              },
                            ),
                          ),
                          ActionChip(
                            avatar: const Icon(Icons.add, size: 16, color: AppColors.textPrimary),
                            label: const Text('Add tool', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                            backgroundColor: const Color(0xFFFFF3CD),
                            side: const BorderSide(color: AppColors.primary),
                            onPressed: _pickTools,
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      const Text(
                        'Commercial Day / Project Rate',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Base Rate (₹)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _minRateCtrl,
                                  keyboardType: TextInputType.number,
                                  onChanged: (_) => setState(() => _isDirty = true),
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                  decoration: _rateInputDecoration('Min rate'),
                                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Max Rate (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _maxRateCtrl,
                                  keyboardType: TextInputType.number,
                                  onChanged: (_) => setState(() => _isDirty = true),
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                  decoration: _rateInputDecoration('Max rate'),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: RateUnit.values.map((unit) {
                          final isSelected = _rateUnit == unit;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  _rateUnit = unit;
                                  _isDirty = true;
                                });
                                _saveDraft();
                              },
                              child: Container(
                                margin: const EdgeInsets.symmetric(horizontal: 4),
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
                                  unit.label,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              // Sticky Save Button
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
                            'Save professional details',
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

  InputDecoration _rateInputDecoration(String hint) {
    return InputDecoration(
      prefixText: '₹ ',
      prefixStyle: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
      hintText: hint,
      filled: true,
      fillColor: AppColors.surfacePure,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
