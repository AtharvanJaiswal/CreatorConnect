import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StepIndicator extends StatelessWidget {
  final int count;
  final int currentIndex;

  const StepIndicator({
    super.key,
    required this.count,
    required this.currentIndex,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (index) {
        final isActive = index == currentIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.only(right: 6.0),
          width: isActive ? 24.0 : 8.0,
          height: 8.0,
          decoration: BoxDecoration(
            color: isActive ? AppColors.textPrimary : AppColors.disabled,
            borderRadius: BorderRadius.circular(999.0),
          ),
        );
      }),
    );
  }
}
