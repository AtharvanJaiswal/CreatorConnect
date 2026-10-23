import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../dialogs/discard_changes_dialog.dart';

class C06PodcastDetailsScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const C06PodcastDetailsScreen({super.key, this.repository});

  @override
  State<C06PodcastDetailsScreen> createState() => _C06PodcastDetailsScreenState();
}

class _C06PodcastDetailsScreenState extends State<C06PodcastDetailsScreen> {
  late final ProfileRepository _repo;
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _showNameCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _spotifyUrlCtrl;
  late final TextEditingController _appleUrlCtrl;

  String _category = '';
  ReleaseFrequency _frequency = ReleaseFrequency.weekly;

  bool _isSaving = false;
  bool _isDirty = false;

  static const List<String> _podcastCategories = [
    'Business & Creator economy',
    'Tech & Science',
    'Society & Culture',
    'Comedy & Entertainment',
    'True Crime',
    'Health & Fitness',
    'News & Politics',
    'Personal Development',
  ];

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _showNameCtrl = TextEditingController();
    _descCtrl = TextEditingController();
    _spotifyUrlCtrl = TextEditingController();
    _appleUrlCtrl = TextEditingController();
    _showNameCtrl.addListener(_saveDraft);
    _descCtrl.addListener(_saveDraft);
    _spotifyUrlCtrl.addListener(_saveDraft);
    _appleUrlCtrl.addListener(_saveDraft);
    _loadInitialData();
  }

  void _saveDraft() {
    if (!mounted) return;
    final links = <String>[];
    if (_spotifyUrlCtrl.text.trim().isNotEmpty) links.add(_spotifyUrlCtrl.text.trim());
    if (_appleUrlCtrl.text.trim().isNotEmpty) links.add(_appleUrlCtrl.text.trim());
    _repo.savePodcastDetailsDraft(PodcastDetailsData(
      showName: _showNameCtrl.text.trim(),
      category: _category,
      description: _descCtrl.text.trim(),
      platformLinks: links,
      frequency: _frequency,
    ));
  }

  Future<void> _loadInitialData() async {
    final details = await _repo.getPodcastDetails();
    if (!mounted) return;
    setState(() {
      _showNameCtrl.text = details.showName;
      _category = details.category;
      _descCtrl.text = details.description;
      if (details.platformLinks.isNotEmpty) {
        _spotifyUrlCtrl.text = details.platformLinks.first;
      }
      if (details.platformLinks.length > 1) {
        _appleUrlCtrl.text = details.platformLinks[1];
      }
      _frequency = details.frequency;
    });
  }

  Future<void> _saveAndContinue() async {
    if (_category.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a show category'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final links = <String>[];
    if (_spotifyUrlCtrl.text.trim().isNotEmpty) links.add(_spotifyUrlCtrl.text.trim());
    if (_appleUrlCtrl.text.trim().isNotEmpty) links.add(_appleUrlCtrl.text.trim());

    final data = PodcastDetailsData(
      showName: _showNameCtrl.text.trim(),
      category: _category,
      description: _descCtrl.text.trim(),
      platformLinks: links,
      frequency: _frequency,
    );

    await _repo.updatePodcastDetails(data);

    if (mounted) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Podcast show details saved!'),
          backgroundColor: Color(0xFF2E7D32),
        ),
      );
      Navigator.pop(context, true);
    }
  }

  @override
  void dispose() {
    _showNameCtrl.dispose();
    _descCtrl.dispose();
    _spotifyUrlCtrl.dispose();
    _appleUrlCtrl.dispose();
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
            'Podcast Details',
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
                        'Show Name',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _showNameCtrl,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('e.g. The Creator Hour'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter show name' : null,
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Primary Genre / Category',
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
                            hint: const Text('Select show category', style: TextStyle(color: AppColors.textTertiary)),
                            isExpanded: true,
                            items: _podcastCategories
                                .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                                .toList(),
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
                        'Show Description',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _descCtrl,
                        maxLines: 3,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('What is your podcast about and who is your audience?'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please provide a show summary' : null,
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Show Platform Link (Spotify or Apple)',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _spotifyUrlCtrl,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('https://open.spotify.com/show/...'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter at least one platform link' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _appleUrlCtrl,
                        onChanged: (_) => setState(() => _isDirty = true),
                        style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
                        decoration: _inputDecoration('Apple Podcasts / YouTube RSS link (optional)'),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Episode Frequency',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: ReleaseFrequency.values.map((f) {
                          final isSelected = _frequency == f;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  _frequency = f;
                                  _isDirty = true;
                                });
                                _saveDraft();
                              },
                              child: Container(
                                margin: const EdgeInsets.symmetric(horizontal: 4),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFFFFF3CD) : AppColors.surfacePure,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: isSelected ? AppColors.primary : AppColors.borderLight,
                                    width: isSelected ? 1.8 : 1.0,
                                  ),
                                ),
                                child: Text(
                                  f.label,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 13,
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
                            'Save podcast details',
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
