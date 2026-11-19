import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class CityHubInfo {
  final String city;
  final String state;
  final String hubName;
  final bool isMetro;

  const CityHubInfo({
    required this.city,
    required this.state,
    required this.hubName,
    this.isMetro = false,
  });
}

class CityPickerSheet extends StatefulWidget {
  final String? currentCity;

  const CityPickerSheet({super.key, this.currentCity});

  static Future<CityHubInfo?> show(BuildContext context, {String? currentCity}) {
    return showModalBottomSheet<CityHubInfo>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CityPickerSheet(currentCity: currentCity),
    );
  }

  @override
  State<CityPickerSheet> createState() => _CityPickerSheetState();
}

class _CityPickerSheetState extends State<CityPickerSheet> {
  final TextEditingController _searchCtrl = TextEditingController();

  static const List<CityHubInfo> _allCities = [
    CityHubInfo(city: 'New Delhi', state: 'Delhi', hubName: 'Delhi NCR hub', isMetro: true),
    CityHubInfo(city: 'Bengaluru', state: 'Karnataka', hubName: 'Bengaluru hub', isMetro: true),
    CityHubInfo(city: 'Mumbai', state: 'Maharashtra', hubName: 'Mumbai hub', isMetro: true),
    CityHubInfo(city: 'Gurugram', state: 'Haryana', hubName: 'Delhi NCR hub', isMetro: true),
    CityHubInfo(city: 'Noida', state: 'Uttar Pradesh', hubName: 'Delhi NCR hub', isMetro: true),
    CityHubInfo(city: 'Hyderabad', state: 'Telangana', hubName: 'Hyderabad hub', isMetro: true),
    CityHubInfo(city: 'Pune', state: 'Maharashtra', hubName: 'Pune hub', isMetro: true),
    CityHubInfo(city: 'Chennai', state: 'Tamil Nadu', hubName: 'Chennai hub', isMetro: true),
    CityHubInfo(city: 'Kolkata', state: 'West Bengal', hubName: 'Kolkata hub', isMetro: true),
    CityHubInfo(city: 'Ahmedabad', state: 'Gujarat', hubName: 'West Regional hub'),
    CityHubInfo(city: 'Jaipur', state: 'Rajasthan', hubName: 'North Regional hub'),
    CityHubInfo(city: 'Chandigarh', state: 'Punjab', hubName: 'North Regional hub'),
    CityHubInfo(city: 'Lucknow', state: 'Uttar Pradesh', hubName: 'North Regional hub'),
    CityHubInfo(city: 'Kochi', state: 'Kerala', hubName: 'South Regional hub'),
    CityHubInfo(city: 'Indore', state: 'Madhya Pradesh', hubName: 'Central Regional hub'),
    CityHubInfo(city: 'Goa', state: 'Goa', hubName: 'West Regional hub'),
    CityHubInfo(city: 'Surat', state: 'Gujarat', hubName: 'West Regional hub'),
    CityHubInfo(city: 'Bhopal', state: 'Madhya Pradesh', hubName: 'Central Regional hub'),
    CityHubInfo(city: 'Coimbatore', state: 'Tamil Nadu', hubName: 'South Regional hub'),
    CityHubInfo(city: 'Visakhapatnam', state: 'Andhra Pradesh', hubName: 'South Regional hub'),
  ];

  List<CityHubInfo> _filtered = _allCities;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(_onSearchChanged);
  }

  void _onSearchChanged() {
    final q = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      if (q.isEmpty) {
        _filtered = _allCities;
      } else {
        _filtered = _allCities.where((c) =>
            c.city.toLowerCase().contains(q) ||
            c.state.toLowerCase().contains(q) ||
            c.hubName.toLowerCase().contains(q)).toList();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      margin: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.surfaceWarm,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.borderLight,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Select city & creator hub',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Can be changed once every 30 days',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Search input
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchCtrl,
              autofocus: false,
              style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search city or state...',
                hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 14),
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18, color: AppColors.textTertiary),
                        onPressed: () => _searchCtrl.clear(),
                      )
                    : null,
                filled: true,
                fillColor: AppColors.surfacePure,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
              ),
            ),
          ),
          const SizedBox(height: 12),
          // City List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              itemCount: _filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = _filtered[index];
                final isSelected = widget.currentCity?.toLowerCase() == item.city.toLowerCase();

                return InkWell(
                  onTap: () => Navigator.pop(context, item),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: item.isMetro ? const Color(0xFFFFF3CD) : AppColors.surfaceWarm,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            item.isMetro ? Icons.location_city_rounded : Icons.place_outlined,
                            size: 18,
                            color: item.isMetro ? const Color(0xFF8A6D00) : AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.city,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${item.state} · ${item.hubName}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isSelected)
                          const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 22),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
