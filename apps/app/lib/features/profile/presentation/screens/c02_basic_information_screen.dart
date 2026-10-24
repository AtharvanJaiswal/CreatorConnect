import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../bottom_sheets/photo_source_sheet.dart';
import '../bottom_sheets/city_picker_sheet.dart';
import '../bottom_sheets/multi_select_sheet.dart';
import '../dialogs/discard_changes_dialog.dart';
import '../dialogs/city_change_limit_dialog.dart';

class C02BasicInformationScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const C02BasicInformationScreen({super.key, this.repository});

  @override
  State<C02BasicInformationScreen> createState() => _C02BasicInformationScreenState();
}

class _C02BasicInformationScreenState extends State<C02BasicInformationScreen> {
  late final ProfileRepository _repo;
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameCtrl;
  late final TextEditingController _bioCtrl;

  String? _photoUrl;
  Uint8List? _photoBytes;
  String _city = '';
  String _hubName = '';
  List<String> _languages = [];
  DateTime? _cityLastChangedAt;

  String? _initialCity;
  bool _isSaving = false;
  bool _isDirty = false;
  String? _bioValidationError;

  static const List<String> _allLanguages = [
    'English',
    'Hindi',
    'Bengali',
    'Telugu',
    'Marathi',
    'Tamil',
    'Urdu',
    'Gujarati',
    'Kannada',
    'Malayalam',
    'Odia',
    'Punjabi',
    'Assamese',
    'Maithili',
    'Sanskrit',
  ];

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _nameCtrl = TextEditingController();
    _bioCtrl = TextEditingController();
    _nameCtrl.addListener(_saveDraft);
    _bioCtrl.addListener(_saveDraft);
    _loadInitialData();
  }

  void _saveDraft() {
    if (!mounted) return;
    _repo.saveBasicInfoDraft(BasicInfoData(
      photoUrl: _photoUrl,
      displayName: _nameCtrl.text.trim(),
      bio: _bioCtrl.text.trim(),
      city: _city,
      hubName: _hubName,
      languages: _languages,
      cityLastChangedAt: _cityLastChangedAt,
    ));
  }

  Future<void> _loadInitialData() async {
    final info = await _repo.getBasicInfo();
    if (!mounted) return;
    setState(() {
      _photoUrl = info.photoUrl;
      _nameCtrl.text = info.displayName;
      _bioCtrl.text = info.bio;
      _city = info.city;
      _initialCity = info.city;
      _hubName = info.hubName;
      _languages = List.from(info.languages);
      _cityLastChangedAt = info.cityLastChangedAt;
      _validateBio(info.bio);
    });
  }

  void _validateBio(String text) {
    if (text.isEmpty) {
      _bioValidationError = null;
      return;
    }
    // Regex for email
    final emailRegex = RegExp(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}');
    // Regex for phone numbers (7+ digits)
    final phoneRegex = RegExp(r'(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}|\b\d{10}\b');
    // Regex for URLs / links
    final urlRegex = RegExp(r'(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9]+\.(?:com|in|org|io|net|co)');

    if (emailRegex.hasMatch(text) || phoneRegex.hasMatch(text) || urlRegex.hasMatch(text)) {
      _bioValidationError =
          "Please keep contacts in private chats. Bios shouldn't contain emails, numbers, or links.";
    } else {
      _bioValidationError = null;
    }
  }

  Future<void> _onPickPhoto() async {
    final action = await PhotoSourceSheet.show(
      context,
      hasExistingPhoto: _photoUrl != null && _photoUrl!.isNotEmpty,
    );
    if (action == null) return;

    if (action == PhotoSourceAction.remove) {
      setState(() {
        _photoUrl = null;
        _photoBytes = null;
        _isDirty = true;
      });
      _saveDraft();
      return;
    }

    final picker = ImagePicker();
    final source = action == PhotoSourceAction.camera ? ImageSource.camera : ImageSource.gallery;
    try {
      final XFile? image = await picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (image != null && mounted) {
        final bytes = await image.readAsBytes();
        setState(() {
          _photoBytes = bytes;
          _photoUrl = image.path;
          _isDirty = true;
        });
        _saveDraft();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open photo: $e'),
            backgroundColor: const Color(0xFFD32F2F),
          ),
        );
      }
    }
  }

  Future<void> _onPickCity() async {
    if (_cityLastChangedAt != null) {
      final daysSince = DateTime.now().difference(_cityLastChangedAt!).inDays;
      if (daysSince < 30) {
        CityChangeLimitDialog.show(context, daysRemaining: 30 - daysSince);
        return;
      }
    }

    final selected = await CityPickerSheet.show(context, currentCity: _city);
    if (selected != null) {
      setState(() {
        _city = selected.city;
        _hubName = selected.hubName;
        _isDirty = true;
      });
      _saveDraft();
    }
  }

  Future<void> _onPickLanguages() async {
    final selected = await MultiSelectSheet.show(
      context,
      title: 'Languages you create in',
      subtitle: 'Select up to 5 languages',
      availableItems: _allLanguages,
      initialSelected: _languages,
      maxSelections: 5,
    );

    if (selected != null) {
      setState(() {
        _languages = selected;
        _isDirty = true;
      });
      _saveDraft();
    }
  }

  Future<void> _saveAndContinue() async {
    if (_bioValidationError != null) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final cityChanged = _initialCity != null && _initialCity!.isNotEmpty && _city != _initialCity;
    final data = BasicInfoData(
      photoUrl: _photoUrl,
      displayName: _nameCtrl.text.trim(),
      bio: _bioCtrl.text.trim(),
      city: _city,
      hubName: _hubName,
      languages: _languages,
      cityLastChangedAt: cityChanged ? DateTime.now() : (_cityLastChangedAt ?? DateTime.now()),
    );

    await _repo.updateBasicInfo(data);

    if (mounted) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Basic info updated successfully!'),
          backgroundColor: Color(0xFF2E7D32),
          duration: Duration(seconds: 2),
        ),
      );
      Navigator.pop(context, true);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _bioCtrl.dispose();
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
            'Basic Information',
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
                      // Avatar picker
                      Center(
                        child: Stack(
                          children: [
                            Builder(
                              builder: (_) {
                                ImageProvider? provider;
                                if (_photoBytes != null && _photoBytes!.isNotEmpty) {
                                  provider = MemoryImage(_photoBytes!);
                                } else if (_photoUrl != null && _photoUrl!.isNotEmpty) {
                                  if (_photoUrl!.startsWith('http://') ||
                                      _photoUrl!.startsWith('https://')) {
                                    provider = NetworkImage(_photoUrl!);
                                  } else if (!kIsWeb && !_photoUrl!.startsWith('blob:')) {
                                    provider = FileImage(File(_photoUrl!));
                                  }
                                }
                                final hasInitials = _nameCtrl.text.trim().isNotEmpty;
                                return Container(
                                  width: 104,
                                  height: 104,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.surfacePure,
                                    border: Border.all(color: AppColors.primary, width: 3),
                                    image: provider != null
                                        ? DecorationImage(
                                            image: provider,
                                            fit: BoxFit.cover,
                                          )
                                        : null,
                                  ),
                                  child: provider == null
                                      ? Center(
                                          child: hasInitials
                                              ? Text(
                                                  _nameCtrl.text.trim()[0].toUpperCase(),
                                                  style: const TextStyle(
                                                    fontFamily: 'Archivo',
                                                    fontSize: 38,
                                                    fontWeight: FontWeight.w800,
                                                    color: AppColors.textPrimary,
                                                  ),
                                                )
                                              : const Icon(
                                                  Icons.person_rounded,
                                                  size: 48,
                                                  color: AppColors.textTertiary,
                                                ),
                                        )
                                      : null,
                                );
                              },
                            ),
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: InkWell(
                                onTap: _onPickPhoto,
                                borderRadius: BorderRadius.circular(999),
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: AppColors.surfaceWarm, width: 2),
                                  ),
                                  child: const Icon(
                                    Icons.camera_alt_rounded,
                                    size: 18,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: TextButton(
                          onPressed: _onPickPhoto,
                          child: const Text(
                            'Change profile photo',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      // Display Name
                      const Text(
                        'Display name',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _nameCtrl,
                        maxLength: 50,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('Enter your name or creator pseudonym'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter a name' : null,
                      ),
                      const SizedBox(height: 16),
                      // Bio
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Bio',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                          ),
                          Text(
                            '${_bioCtrl.text.length}/160',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _bioCtrl.text.length > 160 ? const Color(0xFFD32F2F) : AppColors.textTertiary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _bioCtrl,
                        maxLines: 3,
                        maxLength: 160,
                        buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                        onChanged: (val) {
                          setState(() {
                            _isDirty = true;
                            _validateBio(val);
                          });
                        },
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('Brief headline summarizing your craft or niche'),
                      ),
                      if (_bioValidationError != null) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFEBEE),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFFFCDD2)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.info_outline_rounded, color: Color(0xFFD32F2F), size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _bioValidationError!,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFFD32F2F),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      // City & Hub
                      const Text(
                        'Location & Creator Hub',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: _onPickCity,
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: AppColors.surfacePure,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.borderLight, width: 1.2),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.location_on_outlined, color: AppColors.textSecondary, size: 22),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _city.isNotEmpty ? _city : 'Select your city',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: _city.isNotEmpty ? AppColors.textPrimary : AppColors.textTertiary,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _city.isNotEmpty ? _hubName : 'Tap to choose your location & hub',
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      // Languages
                      const Text(
                        'Languages spoken',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      if (_languages.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text(
                            'No languages added yet. Add languages you create content in.',
                            style: TextStyle(fontSize: 13, color: AppColors.textTertiary),
                          ),
                        ),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ..._languages.map(
                            (lang) => Chip(
                              label: Text(
                                lang,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                              backgroundColor: AppColors.surfacePure,
                              side: const BorderSide(color: AppColors.borderLight),
                              deleteIcon: const Icon(Icons.close, size: 16),
                              onDeleted: () {
                                setState(() {
                                  _languages.remove(lang);
                                  _isDirty = true;
                                });
                              },
                            ),
                          ),
                          ActionChip(
                            avatar: const Icon(Icons.add, size: 16, color: AppColors.textPrimary),
                            label: const Text(
                              'Add language',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                            ),
                            backgroundColor: const Color(0xFFFFF3CD),
                            side: const BorderSide(color: AppColors.primary),
                            onPressed: _onPickLanguages,
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),
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
                      backgroundColor: _bioValidationError != null ? AppColors.borderLight : AppColors.primary,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    onPressed: _isSaving || _bioValidationError != null ? null : _saveAndContinue,
                    child: _isSaving
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.textPrimary),
                          )
                        : const Text(
                            'Save & continue',
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
