import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class C11ConnectionErrorScreen extends StatelessWidget {
  final String platform;

  const C11ConnectionErrorScreen({
    super.key,
    this.platform = 'Instagram',
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFEBEE),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFD32F2F), size: 40),
              ),
              const SizedBox(height: 24),
              const Text(
                'Connection failed',
                style: TextStyle(
                  fontFamily: 'Archivo',
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'We could not complete authentication with $platform.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surfacePure,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Common reasons & tips:',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    SizedBox(height: 12),
                    _TroubleTip(
                      number: '1',
                      text: 'Ensure your Instagram profile is switched to a Creator or Business account in settings.',
                    ),
                    SizedBox(height: 10),
                    _TroubleTip(
                      number: '2',
                      text: 'Grant all requested read-only permissions during the Meta approval screen.',
                    ),
                    SizedBox(height: 10),
                    _TroubleTip(
                      number: '3',
                      text: 'Check if you have an active Facebook Page linked to your Instagram creator profile.',
                    ),
                  ],
                ),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  onPressed: () {
                    Navigator.pushReplacementNamed(
                      context,
                      '/profile/connecting-social',
                      arguments: {'platform': platform},
                    );
                  },
                  child: Text(
                    'Try connecting $platform again',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    side: const BorderSide(color: AppColors.borderLight, width: 1.5),
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Back to social accounts',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TroubleTip extends StatelessWidget {
  final String number;
  final String text;

  const _TroubleTip({required this.number, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: const BoxDecoration(
            color: Color(0xFFFFF3CD),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              number,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF8A6D00)),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.3),
          ),
        ),
      ],
    );
  }
}
