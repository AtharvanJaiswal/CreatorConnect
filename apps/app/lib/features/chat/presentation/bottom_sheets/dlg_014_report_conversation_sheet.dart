import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class Dlg014ReportConversationSheet extends StatefulWidget {
  final String peerName;

  const Dlg014ReportConversationSheet({super.key, required this.peerName});

  static Future<String?> show(BuildContext context, {required String peerName}) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Dlg014ReportConversationSheet(peerName: peerName),
    );
  }

  @override
  State<Dlg014ReportConversationSheet> createState() => _Dlg014ReportConversationSheetState();
}

class _Dlg014ReportConversationSheetState extends State<Dlg014ReportConversationSheet> {
  String _selectedReason = 'Off-platform payment solicitation';

  static const List<String> _reasons = [
    'Off-platform payment solicitation',
    'Harassment or abusive conduct',
    'Spam or deceptive advertising',
    'Inappropriate media / copyright',
    'Other safety violation',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Report Conversation with ${widget.peerName}',
            style: const TextStyle(fontFamily: 'Archivo', fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 6),
          const Text(
            'Reports are reviewed by the CreatorConnect safety team within 24 hours under SOW §14.',
            style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.35),
          ),
          const SizedBox(height: 16),
          ..._reasons.map((reason) {
            final isSelected = _selectedReason == reason;
            return InkWell(
              onTap: () => setState(() => _selectedReason = reason),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                child: Row(
                  children: [
                    Icon(
                      isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                      size: 20,
                      color: isSelected ? AppColors.primaryDark : AppColors.textMuted,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        reason,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context, _selectedReason),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              child: const Text('Submit Report', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }
}
