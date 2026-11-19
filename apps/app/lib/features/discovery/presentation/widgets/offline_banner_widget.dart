import 'package:flutter/material.dart';

class OfflineBannerWidget extends StatelessWidget {
  final VoidCallback onRetry;

  const OfflineBannerWidget({
    super.key,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: const Color(0xFFFBF1DC),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 16, color: Color(0xFFC98A16)),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Offline mode — Showing cached data.',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF8A5D07),
              ),
            ),
          ),
          InkWell(
            onTap: onRetry,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              child: Text(
                'Retry',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  decoration: TextDecoration.underline,
                  color: Color(0xFF8A5D07),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
