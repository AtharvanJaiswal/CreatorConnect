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
    this.backgroundColor = Colors.transparent,
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
      ),
      child: Image.asset(
        'assets/images/creatorpeep_logo_192.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return Center(
            child: SizedBox(
              width: size,
              height: size,
              child: CustomPaint(
                painter: _CreatorPeepMarkPainter(),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CreatorPeepMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // 1. Draw Cream Squircle
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        size.width * 0.05,
        size.height * 0.05,
        size.width * 0.9,
        size.height * 0.9,
      ),
      Radius.circular(size.width * 0.26),
    );
    final bgPaint = Paint()..color = const Color(0xFFFAF3E8);
    canvas.drawRRect(rrect, bgPaint);

    final center = Offset(size.width / 2, size.height / 2);
    final ringRadius = size.width * 0.30;

    // 2. Yellow Ring (#FDD24B)
    final ringPaint = Paint()
      ..color = const Color(0xFFFDD24B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.085;
    canvas.drawCircle(center, ringRadius, ringPaint);

    // 3. Eye Lavender Outlines / Rings (#B8A2F8)
    final eyeRadius = size.width * 0.095;
    final leftEyeCenter = Offset(center.dx - size.width * 0.095, center.dy);
    final rightEyeCenter = Offset(center.dx + size.width * 0.095, center.dy);

    final eyeRingPaint = Paint()
      ..color = const Color(0xFFB8A2F8)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(leftEyeCenter, eyeRadius, eyeRingPaint);
    canvas.drawCircle(rightEyeCenter, eyeRadius, eyeRingPaint);

    // 4. Pupils (#0F0D0D)
    final pupilPaint = Paint()..color = const Color(0xFF0F0D0D);
    final pupilRadius = eyeRadius * 0.76;
    canvas.drawCircle(leftEyeCenter, pupilRadius, pupilPaint);
    canvas.drawCircle(rightEyeCenter, pupilRadius, pupilPaint);

    // 5. Specular Highlights (white dots)
    final specPaint = Paint()..color = Colors.white;
    canvas.drawCircle(
      Offset(
        leftEyeCenter.dx - pupilRadius * 0.35,
        leftEyeCenter.dy - pupilRadius * 0.35,
      ),
      pupilRadius * 0.32,
      specPaint,
    );
    canvas.drawCircle(
      Offset(
        rightEyeCenter.dx - pupilRadius * 0.35,
        rightEyeCenter.dy - pupilRadius * 0.35,
      ),
      pupilRadius * 0.32,
      specPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
