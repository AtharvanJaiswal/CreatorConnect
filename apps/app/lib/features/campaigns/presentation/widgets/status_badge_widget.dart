import 'package:flutter/material.dart';
import '../../domain/entities/campaign_entities.dart';

class StatusBadgeWidget extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final Color? borderColor;

  const StatusBadgeWidget({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    this.borderColor,
  });

  factory StatusBadgeWidget.fromCampaignStatus(CampaignStatus status) {
    switch (status) {
      case CampaignStatus.published:
        return const StatusBadgeWidget(
          label: 'Active',
          backgroundColor: Color(0xFFFFF9E6),
          textColor: Color(0xFF8A6D00),
          borderColor: Color(0xFFFFD64A),
        );
      case CampaignStatus.draft:
        return const StatusBadgeWidget(
          label: 'Draft',
          backgroundColor: Color(0xFFF3EFE6),
          textColor: Color(0xFF6E685F),
          borderColor: Color(0xFFD6CEBF),
        );
      case CampaignStatus.inProgress:
        return const StatusBadgeWidget(
          label: 'In Progress',
          backgroundColor: Color(0xFFE8F7ED),
          textColor: Color(0xFF27AE60),
          borderColor: Color(0xFFA8E6CF),
        );
      case CampaignStatus.completed:
        return const StatusBadgeWidget(
          label: 'Completed',
          backgroundColor: Color(0xFFE3F2FD),
          textColor: Color(0xFF1976D2),
        );
      case CampaignStatus.closed:
        return const StatusBadgeWidget(
          label: 'Closed',
          backgroundColor: Color(0xFFEEEEEE),
          textColor: Color(0xFF757575),
        );
    }
  }

  factory StatusBadgeWidget.fromApplicationStatus(ApplicationStatus status) {
    switch (status) {
      case ApplicationStatus.submitted:
        return const StatusBadgeWidget(
          label: 'Applied',
          backgroundColor: Color(0xFFE3F2FD),
          textColor: Color(0xFF1565C0),
        );
      case ApplicationStatus.underReview:
        return const StatusBadgeWidget(
          label: 'Under Review',
          backgroundColor: Color(0xFFFFF9E6),
          textColor: Color(0xFF8A6D00),
          borderColor: Color(0xFFFFD64A),
        );
      case ApplicationStatus.shortlisted:
        return const StatusBadgeWidget(
          label: 'Shortlisted ⭐',
          backgroundColor: Color(0xFFF3E8FF),
          textColor: Color(0xFF6B21A8),
          borderColor: Color(0xFFC9B6F7),
        );
      case ApplicationStatus.accepted:
        return const StatusBadgeWidget(
          label: 'Hired 🎉',
          backgroundColor: Color(0xFFE8F5E9),
          textColor: Color(0xFF2E7D32),
          borderColor: Color(0xFFA8E6CF),
        );
      case ApplicationStatus.rejected:
        return const StatusBadgeWidget(
          label: 'Declined',
          backgroundColor: Color(0xFFFFEBEE),
          textColor: Color(0xFFC62828),
        );
      case ApplicationStatus.withdrawn:
        return const StatusBadgeWidget(
          label: 'Withdrawn',
          backgroundColor: Color(0xFFEEEEEE),
          textColor: Color(0xFF757575),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: borderColor != null ? Border.all(color: borderColor!, width: 1) : null,
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: textColor,
        ),
      ),
    );
  }
}
