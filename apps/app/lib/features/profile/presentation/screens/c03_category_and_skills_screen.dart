import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/taxonomy_data.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../dialogs/discard_changes_dialog.dart';

class C03CategoryAndSkillsScreen extends StatefulWidget {
  final ProfileRepository? repository;

  const C03CategoryAndSkillsScreen({super.key, this.repository});

  @override
  State<C03CategoryAndSkillsScreen> createState() => _C03CategoryAndSkillsScreenState();
}

class _C03CategoryAndSkillsScreenState extends State<C03CategoryAndSkillsScreen> {
  late final ProfileRepository _repo;

  bool _isLoading = true;
  bool _isSaving = false;
  bool _isDirty = false;

  List<CategoryItem> _categories = [];
  List<SkillItem> _allSkills = [];
  Set<String> _selectedCategoryIds = {};
  Map<String, SkillProficiencyLevel> _selectedSkills = {};

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _loadTaxonomy();
  }

  Future<void> _loadTaxonomy() async {
    setState(() => _isLoading = true);
    try {
      final categories = await _repo.getCategories();
      final skills = await _repo.getSkills();
      final userSkills = await _repo.getUserSkills();
      final savedCats = _repo.selectedCategoryIds;

      final map = <String, SkillProficiencyLevel>{};
      for (final us in userSkills) {
        map[us.skillId] = us.proficiency;
      }

      if (mounted) {
        setState(() {
          _categories = categories;
          _allSkills = skills;
          _selectedCategoryIds = savedCats.isNotEmpty
              ? savedCats.toSet()
              : (categories.isNotEmpty ? {categories.first.id} : <String>{});
          _selectedSkills = map;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load categories: $e'),
            backgroundColor: const Color(0xFFD32F2F),
          ),
        );
      }
    }
  }

  void _saveDraft() {
    if (!mounted) return;
    _repo.saveCategorySelection(_selectedCategoryIds.toList());
    final list = _selectedSkills.entries.map((e) {
      final skill = _allSkills.firstWhere(
        (s) => s.id == e.key,
        orElse: () => SkillItem(id: e.key, slug: '', name: 'Skill'),
      );
      return UserSkillSelection(
        skillId: e.key,
        name: skill.name,
        proficiency: e.value,
      );
    }).toList();
    _repo.saveSkillSelection(list);
  }

  void _toggleCategory(String id) {
    setState(() {
      _isDirty = true;
      if (_selectedCategoryIds.contains(id)) {
        if (_selectedCategoryIds.length > 1) {
          _selectedCategoryIds.remove(id);
        }
      } else {
        if (_selectedCategoryIds.length < 3) {
          _selectedCategoryIds.add(id);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('You can choose up to 3 primary categories'),
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    });
    _saveDraft();
  }

  void _toggleSkill(SkillItem item) {
    setState(() {
      _isDirty = true;
      if (_selectedSkills.containsKey(item.id)) {
        _selectedSkills.remove(item.id);
      } else {
        _selectedSkills[item.id] = SkillProficiencyLevel.intermediate;
      }
    });
    _saveDraft();
  }

  void _cycleProficiency(String skillId) {
    setState(() {
      _isDirty = true;
      final current = _selectedSkills[skillId] ?? SkillProficiencyLevel.intermediate;
      switch (current) {
        case SkillProficiencyLevel.beginner:
          _selectedSkills[skillId] = SkillProficiencyLevel.intermediate;
          break;
        case SkillProficiencyLevel.intermediate:
          _selectedSkills[skillId] = SkillProficiencyLevel.advanced;
          break;
        case SkillProficiencyLevel.advanced:
          _selectedSkills[skillId] = SkillProficiencyLevel.expert;
          break;
        case SkillProficiencyLevel.expert:
          _selectedSkills[skillId] = SkillProficiencyLevel.beginner;
          break;
      }
    });
    _saveDraft();
  }

  Future<void> _saveAndContinue() async {
    if (_selectedSkills.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least 1 skill to showcase on your profile'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    final userSkillList = _selectedSkills.entries.map((e) {
      final item = _allSkills.firstWhere((s) => s.id == e.key,
          orElse: () => SkillItem(id: e.key, slug: 'skill', name: 'Skill'));
      return UserSkillSelection(
        skillId: e.key,
        name: item.name,
        proficiency: e.value,
      );
    }).toList();

    await _repo.updateUserSkills(userSkillList, _selectedCategoryIds.toList());

    if (mounted) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Categories and skills saved!'),
          backgroundColor: Color(0xFF2E7D32),
        ),
      );
      Navigator.pop(context, true);
    }
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
            'Category & Skills',
            style: TextStyle(
              fontFamily: 'Archivo',
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          centerTitle: false,
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : SafeArea(
                child: Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        children: [
                          const Text(
                            'Primary Categories',
                            style: TextStyle(
                              fontFamily: 'Archivo',
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Select 1 to 3 categories that best represent your content niche.',
                            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 8,
                            runSpacing: 10,
                            children: _categories.map((cat) {
                              final isSelected = _selectedCategoryIds.contains(cat.id);
                              return FilterChip(
                                label: Text(
                                  cat.name,
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
                                onSelected: (_) => _toggleCategory(cat.id),
                              );
                            }).toList(),
                          ),
                          const SizedBox(height: 28),
                          const Text(
                            'Skills & Expertise',
                            style: TextStyle(
                              fontFamily: 'Archivo',
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Tap a skill to add it. Tap the proficiency pill to toggle level.',
                            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 16),
                          ..._allSkills.map((sk) {
                            final isPicked = _selectedSkills.containsKey(sk.id);
                            final prof = _selectedSkills[sk.id] ?? SkillProficiencyLevel.intermediate;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: isPicked ? const Color(0xFFFFFDF5) : AppColors.surfacePure,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isPicked ? AppColors.primary : AppColors.borderLight,
                                  width: isPicked ? 1.5 : 1.0,
                                ),
                              ),
                              child: ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                leading: Icon(
                                  isPicked ? Icons.check_circle_rounded : Icons.add_circle_outline_rounded,
                                  color: isPicked ? const Color(0xFF2E7D32) : AppColors.textTertiary,
                                  size: 22,
                                ),
                                title: Text(
                                  sk.name,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isPicked ? FontWeight.w700 : FontWeight.w500,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                subtitle: Text(
                                  sk.slug,
                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                ),
                                trailing: isPicked
                                    ? InkWell(
                                        onTap: () => _cycleProficiency(sk.id),
                                        borderRadius: BorderRadius.circular(999),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceWarm,
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(color: AppColors.borderLight),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(
                                                prof.label,
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                  color: AppColors.textPrimary,
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                              const Icon(Icons.sync_rounded, size: 12, color: AppColors.textSecondary),
                                            ],
                                          ),
                                        ),
                                      )
                                    : null,
                                onTap: () => _toggleSkill(sk),
                              ),
                            );
                          }),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                    // Sticky Footer
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
                              : Text(
                                  'Save (${_selectedSkills.length} skills)',
                                  style: const TextStyle(
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
}
