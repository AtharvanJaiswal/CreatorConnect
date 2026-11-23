import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-54: Decline Invite Action Bottom Sheet
class Dlg54DeclineInviteSheet extends StatefulWidget {
  final String senderName;
  final ValueChanged<String?> onConfirmDecline;

  const Dlg54DeclineInviteSheet({
    super.key,
    required this.senderName,
    required this.onConfirmDecline,
  });

  static Future<void> show(
    BuildContext context, {
    required String senderName,
    required ValueChanged<String?> onConfirmDecline,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Dlg54DeclineInviteSheet(
        senderName: senderName,
        onConfirmDecline: onConfirmDecline,
      ),
    );
  }

  @override
  State<Dlg54DeclineInviteSheet> createState() => _Dlg54DeclineInviteSheetState();
}

class _Dlg54DeclineInviteSheetState extends State<Dlg54DeclineInviteSheet> {
  String? _selectedReason = 'Fully booked';

  final List<String> _reasons = const [
    'Fully booked',
    'Budget below rate',
    'Timeline conflict',
    'Outside domain / niche',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.disabled,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Decline Invitation',
            style: AppTypography.headingLarge(),
          ),
          const SizedBox(height: 6),
          Text(
            'Let ${widget.senderName} know why you cannot accept this collaboration:',
            style: AppTypography.bodyMedium(color: AppColors.textSecondary)
                .copyWith(fontSize: 13),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _reasons.map((r) {
              final isSelected = _selectedReason == r;
              return ChoiceChip(
                label: Text(r),
                selected: isSelected,
                onSelected: (val) {
                  setState(() {
                    _selectedReason = val ? r : null;
                  });
                },
                selectedColor: AppColors.textPrimary,
                backgroundColor: AppColors.backgroundSecondary,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                  side: BorderSide(
                    color: isSelected ? AppColors.textPrimary : AppColors.border,
                  ),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                widget.onConfirmDecline(_selectedReason);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              child: Text(
                'Decline Invitation',
                style: AppTypography.buttonLarge(color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            height: 38,
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Keep Pending',
                style: AppTypography.buttonLarge(color: AppColors.textSecondary)
                    .copyWith(fontSize: 13),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
