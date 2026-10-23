import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class BrandLogoMark extends StatelessWidget {
  final double size;
  final Color backgroundColor;
  final Color iconColor;
  final double borderRadius;

  const BrandLogoMark({
    super.key,
    this.size = 80.0,
    this.backgroundColor = AppColors.textPrimary,
    this.iconColor = AppColors.backgroundPrimary,
    this.borderRadius = 24.0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F000000),
            blurRadius: 16,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Center(
        child: SizedBox(
          width: size * 0.5,
          height: size * 0.5,
          child: CustomPaint(
            painter: _InfinityMarkPainter(color: iconColor),
          ),
        ),
      ),
    );
  }
}

class _InfinityMarkPainter extends CustomPainter {
  final Color color;

  const _InfinityMarkPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.16
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // Rotate ~ -25 degrees to match the dynamic angled brand mark
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(-math.pi / 7.5);
    canvas.translate(-size.width / 2, -size.height / 2);

    final w = size.width;
    final h = size.height;

    // Infinity loop path
    final loopRadius = w * 0.22;
    final leftCenter = Offset(w * 0.28, h * 0.5);
    final rightCenter = Offset(w * 0.72, h * 0.5);

    // Left circle
    canvas.drawCircle(leftCenter, loopRadius, paint);
    // Right circle
    canvas.drawCircle(rightCenter, loopRadius, paint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _InfinityMarkPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
