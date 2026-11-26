import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/application_entities.dart';

class StatusTimelineWidget extends StatelessWidget {
  final List<StatusTimelineEvent> events;

  const StatusTimelineWidget({
    super.key,
    required this.events,
  });

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int i = 0; i < events.length; i++) ...[
          _TimelineStep(
            event: events[i],
            isLast: i == events.length - 1,
            stepNumber: i + 1,
          ),
        ],
      ],
    );
  }
}

class _TimelineStep extends StatelessWidget {
  final StatusTimelineEvent event;
  final bool isLast;
  final int stepNumber;

  const _TimelineStep({
    required this.event,
    required this.isLast,
    required this.stepNumber,
  });

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Indicator & Line Column
          Column(
            children: [
              _buildDot(),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: event.isDone
                        ? AppColors.textPrimary
                        : AppColors.border,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          // Content
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          event.title,
                          style: AppTypography.headingMedium(
                            color: event.isActive
                                ? const Color(0xFF8C6A0A)
                                : AppColors.textPrimary,
                          ).copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      Text(
                        event.timestamp,
                        style: AppTypography.caption(color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    event.subtitle,
                    style: AppTypography.bodyMedium(
                      color: AppColors.textSecondary,
                    ).copyWith(fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot() {
    if (event.isDone && !event.isActive) {
      return Container(
        width: 24,
        height: 24,
        decoration: const BoxDecoration(
          color: AppColors.success,
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check, size: 14, color: Colors.white),
      );
    }

    if (event.isActive) {
      return Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: AppColors.primary,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.textPrimary, width: 2),
        ),
        child: const Center(
          child: Text(
            '★',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      );
    }

    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.border, width: 1.5),
      ),
      child: Center(
        child: Text(
          '$stepNumber',
          style: AppTypography.caption(color: AppColors.textMuted).copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
