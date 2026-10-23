import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/discovery_entities.dart';
import '../controllers/module_d_controllers.dart';
import '../dialogs/pop_dialogs.dart';

class D07FilterBottomSheet extends ConsumerStatefulWidget {
  const D07FilterBottomSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const D07FilterBottomSheet(),
    );
  }

  @override
  ConsumerState<D07FilterBottomSheet> createState() => _D07FilterBottomSheetState();
}

class _D07FilterBottomSheetState extends ConsumerState<D07FilterBottomSheet> {
  late FilterState _tempFilter;
  int _activeSection = 0; // 0 = Basics & Location, 1 = Commercial & Trust

  @override
  void initState() {
    super.initState();
    _tempFilter = ref.read(filterStateProvider);
  }

  final List<String> _allCategories = const [
    'Fashion & Styling',
    'Tech & Gadgets',
    'Food & Culinary',
    'Fitness & Health',
    'Travel & Lifestyle',
    'Finance & Crypto',
    'Beauty & Skincare',
    'Gaming & Esports',
  ];

  final List<String> _hubCities = const [
    'Mumbai MMR',
    'Delhi NCR',
    'Bengaluru',
    'Hyderabad',
    'Pune',
    'Remote (Pan-India)',
  ];

  @override
  Widget build(BuildContext context) {
    final activeCount = _tempFilter.activeFilterCount;

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: AppColors.backgroundPrimary,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Column(
        children: [
          // Drag handle & Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
            child: Column(
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Filter Discovery', style: AppTypography.headingLarge().copyWith(fontSize: 18)),
                    TextButton(
                      onPressed: () async {
                        final confirm = await PopDialogs.showResetFiltersConfirmation(context);
                        if (confirm == true) {
                          setState(() {
                            _tempFilter = FilterState(role: _tempFilter.role);
                          });
                        }
                      },
                      child: const Text('Reset All', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Two-Part Tabs Segmented Pill
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Container(
              height: 40,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _activeSection = 0),
                      child: Container(
                        decoration: BoxDecoration(
                          color: _activeSection == 0 ? AppColors.textPrimary : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '1. Role, Niche & City',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: _activeSection == 0 ? Colors.white : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _activeSection = 1),
                      child: Container(
                        decoration: BoxDecoration(
                          color: _activeSection == 1 ? AppColors.textPrimary : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '2. Budget & Trust',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: _activeSection == 1 ? Colors.white : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Scrollable Sections
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: _activeSection == 0 ? _buildSectionOne() : _buildSectionTwo(),
            ),
          ),

          // Sticky Footer with Apply Button
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.border, width: 1)),
            ),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () {
                  ref.read(filterStateProvider.notifier).setFilter(_tempFilter);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                child: Text(
                  activeCount > 0 ? 'Apply Filters ($activeCount)' : 'Show Results',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionOne() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Role Chips
        const Text('Target Role', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: DiscoveryRole.values.map((role) {
            final isSelected = _tempFilter.role == role;
            return ChoiceChip(
              label: Text(role.displayName),
              selected: isSelected,
              onSelected: (selected) {
                if (selected) setState(() => _tempFilter = _tempFilter.copyWith(role: role));
              },
              selectedColor: AppColors.textPrimary,
              backgroundColor: AppColors.surface,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
                side: BorderSide(color: isSelected ? AppColors.textPrimary : AppColors.border),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 20),

        // Subcategories Multi-Select
        const Text('Categories & Niches', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _allCategories.map((cat) {
            final isSelected = _tempFilter.categories.contains(cat);
            return FilterChip(
              label: Text(cat),
              selected: isSelected,
              onSelected: (selected) {
                final list = List<String>.from(_tempFilter.categories);
                if (selected) {
                  list.add(cat);
                } else {
                  list.remove(cat);
                }
                setState(() => _tempFilter = _tempFilter.copyWith(categories: list));
              },
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.surface,
              labelStyle: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                fontSize: 12,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
                side: BorderSide(color: isSelected ? AppColors.textPrimary : AppColors.border),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 20),

        // Hub Cities
        const Text('City / Regional Hub', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _hubCities.map((city) {
            final isSelected = _tempFilter.city == city;
            return ChoiceChip(
              label: Text(city),
              selected: isSelected,
              onSelected: (selected) {
                setState(() => _tempFilter = _tempFilter.copyWith(city: selected ? city : null));
              },
              selectedColor: AppColors.textPrimary,
              backgroundColor: AppColors.surface,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
                side: BorderSide(color: isSelected ? AppColors.textPrimary : AppColors.border),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 20),

        // Follower Range Slider
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Audience Size (Followers)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            Text(
              '${(_tempFilter.minFollowers / 1000).toInt()}K – ${(_tempFilter.maxFollowers / 1000).toInt()}K+',
              style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFC98A16)),
            ),
          ],
        ),
        RangeSlider(
          values: RangeValues(_tempFilter.minFollowers, _tempFilter.maxFollowers),
          min: 10000,
          max: 500000,
          divisions: 49,
          activeColor: AppColors.textPrimary,
          inactiveColor: AppColors.border,
          onChanged: (vals) {
            setState(() => _tempFilter = _tempFilter.copyWith(minFollowers: vals.start, maxFollowers: vals.end));
          },
        ),
      ],
    );
  }

  Widget _buildSectionTwo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Budget Range Slider
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Deliverable Budget', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            Text(
              '₹${(_tempFilter.minBudget).toInt()} – ₹${(_tempFilter.maxBudget).toInt()}+',
              style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFC98A16)),
            ),
          ],
        ),
        RangeSlider(
          values: RangeValues(_tempFilter.minBudget, _tempFilter.maxBudget),
          min: 5000,
          max: 100000,
          divisions: 19,
          activeColor: AppColors.primary,
          inactiveColor: AppColors.border,
          onChanged: (vals) {
            setState(() => _tempFilter = _tempFilter.copyWith(minBudget: vals.start, maxBudget: vals.end));
          },
        ),
        const SizedBox(height: 16),

        // Toggles
        _buildToggle(
          title: 'Verified Badges Only',
          subtitle: 'Show profiles with confirmed social or company verification',
          value: _tempFilter.verifiedOnly,
          onChanged: (v) => setState(() => _tempFilter = _tempFilter.copyWith(verifiedOnly: v)),
        ),
        const Divider(color: AppColors.border, height: 20),
        _buildToggle(
          title: 'Available Immediately',
          subtitle: 'Ready to accept campaigns this week',
          value: _tempFilter.availableImmediately,
          onChanged: (v) => setState(() => _tempFilter = _tempFilter.copyWith(availableImmediately: v)),
        ),
        const Divider(color: AppColors.border, height: 20),
        _buildToggle(
          title: 'Has Media Portfolio',
          subtitle: 'Profiles with video reels or image showcases uploaded',
          value: _tempFilter.hasPortfolio,
          onChanged: (v) => setState(() => _tempFilter = _tempFilter.copyWith(hasPortfolio: v)),
        ),
        const SizedBox(height: 20),

        // Minimum Star Rating
        const Text('Minimum Rating', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 8),
        Row(
          children: [4.0, 4.5, 4.8].map((r) {
            final isSelected = _tempFilter.minRating == r;
            return Padding(
              padding: const EdgeInsets.only(right: 10),
              child: ChoiceChip(
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                    const SizedBox(width: 4),
                    Text('$r & up'),
                  ],
                ),
                selected: isSelected,
                onSelected: (sel) {
                  if (sel) setState(() => _tempFilter = _tempFilter.copyWith(minRating: r));
                },
                selectedColor: AppColors.primary,
                backgroundColor: AppColors.surface,
                labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                  side: BorderSide(color: isSelected ? AppColors.textPrimary : AppColors.border),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildToggle({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            ],
          ),
        ),
        Switch.adaptive(
          value: value,
          activeThumbColor: AppColors.textPrimary,
          activeTrackColor: AppColors.primary,
          onChanged: onChanged,
        ),
      ],
    );
  }
}
