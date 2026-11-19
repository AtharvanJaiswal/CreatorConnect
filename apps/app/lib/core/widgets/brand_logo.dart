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
    this.backgroundColor = AppColors.primary,
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
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: Image.asset(
          'assets/images/creatorpeep_logo_192.png',
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Center(
              child: SizedBox(
                width: size * 0.72,
                height: size * 0.72,
                child: CustomPaint(
                  painter: _CreatorPeepMarkPainter(),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CreatorPeepMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width * 0.42;

    // Outer Lavender Ring
    final ringPaint = Paint()
      ..color = const Color(0xFFC9B6F7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.12;
    canvas.drawCircle(center, radius, ringPaint);

    // Eye sockets
    final eyeSocketPaint = Paint()
      ..color = const Color(0xFFD6C7F9)
      ..style = PaintingStyle.fill;
    final eyeRadius = size.width * 0.13;
    final leftEyeCenter = Offset(center.dx - size.width * 0.13, center.dy);
    final rightEyeCenter = Offset(center.dx + size.width * 0.13, center.dy);

    canvas.drawCircle(leftEyeCenter, eyeRadius, eyeSocketPaint);
    canvas.drawCircle(rightEyeCenter, eyeRadius, eyeSocketPaint);

    // Pupils
    final pupilPaint = Paint()..color = const Color(0xFF14110F);
    final pupilRadius = size.width * 0.095;
    canvas.drawCircle(leftEyeCenter, pupilRadius, pupilPaint);
    canvas.drawCircle(rightEyeCenter, pupilRadius, pupilPaint);

    // Specular highlights
    final specPaint = Paint()..color = Colors.white;
    canvas.drawCircle(
      Offset(leftEyeCenter.dx - pupilRadius * 0.35, leftEyeCenter.dy - pupilRadius * 0.35),
      pupilRadius * 0.35,
      specPaint,
    );
    canvas.drawCircle(
      Offset(rightEyeCenter.dx - pupilRadius * 0.35, rightEyeCenter.dy - pupilRadius * 0.35),
      pupilRadius * 0.35,
      specPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
