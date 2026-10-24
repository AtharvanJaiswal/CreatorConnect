import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../dialogs/discard_changes_dialog.dart';

class C04CreatorDetailsScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const C04CreatorDetailsScreen({super.key, this.repository});

  @override
  State<C04CreatorDetailsScreen> createState() => _C04CreatorDetailsScreenState();
}

class _C04CreatorDetailsScreenState extends State<C04CreatorDetailsScreen> {
  late final ProfileRepository _repo;
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _minRateCtrl;
  late final TextEditingController _maxRateCtrl;

  List<String> _contentTypes = [];
  RateUnit _rateUnit = RateUnit.perProject;
  bool _showRate = true;
  AvailabilityStatus _availability = AvailabilityStatus.availableNow;

  bool _isSaving = false;
  bool _isDirty = false;

  static const List<String> _allFormats = [
    'Reels',
    'Shorts',
    'YouTube videos',
    'Static Posts',
    'Instagram Stories',
    'Live Streams',
    'UGC Content',
    'Event Appearances',
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
    _repo.saveCreatorDetailsDraft(CreatorDetailsData(
      contentTypes: _contentTypes,
      minRate: minR,
      maxRate: maxR,
      rateUnit: _rateUnit,
      showRateOnProfile: _showRate,
      availability: _availability,
    ));
  }

  Future<void> _loadInitialData() async {
    final details = await _repo.getCreatorDetails();
    if (!mounted) return;
    setState(() {
      _contentTypes = List.from(details.contentTypes);
      _minRateCtrl.text = details.minRate != null ? details.minRate.toString() : '';
      _maxRateCtrl.text = details.maxRate != null ? details.maxRate.toString() : '';
      _rateUnit = details.rateUnit;
      _showRate = details.showRateOnProfile;
      _availability = details.availability;
    });
  }

  void _toggleFormat(String format) {
    setState(() {
      _isDirty = true;
      if (_contentTypes.contains(format)) {
        _contentTypes.remove(format);
      } else {
        _contentTypes.add(format);
      }
    });
    _saveDraft();
  }

  Future<void> _saveAndContinue() async {
    if (_contentTypes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one content format'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final minR = int.tryParse(_minRateCtrl.text.trim());
    final maxR = int.tryParse(_maxRateCtrl.text.trim());

    final data = CreatorDetailsData(
      contentTypes: _contentTypes,
      minRate: minR,
      maxRate: maxR,
      rateUnit: _rateUnit,
      showRateOnProfile: _showRate,
      availability: _availability,
    );

    await _repo.updateCreatorDetails(data);

    if (mounted) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Creator details saved successfully!'),
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
            'Creator Details',
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
                        'Content Formats',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'What deliverables can brands commission you for?',
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _allFormats.map((fmt) {
                          final isSelected = _contentTypes.contains(fmt);
                          return FilterChip(
                            label: Text(
                              fmt,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            selected: isSelected,
                            selectedColor: const Color(0xFFFFF3CD),
                            backgroundColor: AppColors.surfacePure,
                            checkmarkColor: AppColors.textPrimary,
                            side: BorderSide(
                              color: isSelected ? AppColors.primary : AppColors.borderLight,
                              width: isSelected ? 1.8 : 1.0,
                            ),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            onSelected: (_) => _toggleFormat(fmt),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 28),
                      const Text(
                        'Commercial Rates (INR ₹)',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Set your starting rate so brands understand your price bracket.',
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Starting Rate', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _minRateCtrl,
                                  keyboardType: TextInputType.number,
                                  onChanged: (_) => setState(() => _isDirty = true),
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                  decoration: _rateInputDecoration('₹ min rate'),
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
                                  decoration: _rateInputDecoration('₹ max rate'),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      // Rate Unit selector
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
                      const SizedBox(height: 14),
                      // Show rate toggle
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.surfacePure,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.borderLight),
                        ),
                        child: SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text(
                            'Show starting rate on public card',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                          subtitle: const Text(
                            'Filtered into brand budget searches',
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                          value: _showRate,
                          activeThumbColor: AppColors.primary,
                          onChanged: (val) {
                            setState(() {
                              _showRate = val;
                              _isDirty = true;
                            });
                            _saveDraft();
                          },
                        ),
                      ),
                      const SizedBox(height: 28),
                      // Availability
                      const Text(
                        'Collaboration Availability',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...AvailabilityStatus.values.map((status) {
                        final isSelected = _availability == status;
                        return InkWell(
                          onTap: () {
                            setState(() {
                              _availability = status;
                              _isDirty = true;
                            });
                            _saveDraft();
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFFFFF9E6) : AppColors.surfacePure,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected ? AppColors.primary : AppColors.borderLight,
                                width: isSelected ? 1.8 : 1.0,
                              ),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    status.label,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ),
                                Container(
                                  width: 22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isSelected ? AppColors.primary : Colors.transparent,
                                    border: Border.all(
                                      color: isSelected ? AppColors.primary : AppColors.borderLight,
                                      width: 2,
                                    ),
                                  ),
                                  child: isSelected
                                      ? const Icon(Icons.check, size: 14, color: AppColors.textPrimary)
                                      : null,
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
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
                            'Save details',
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
      hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 13),
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
