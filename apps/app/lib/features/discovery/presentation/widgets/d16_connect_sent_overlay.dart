import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class D16ConnectSentOverlay extends StatefulWidget {
  final String handle;
  final VoidCallback onUndo;
  final VoidCallback onDismissed;

  const D16ConnectSentOverlay({
    super.key,
    required this.handle,
    required this.onUndo,
    required this.onDismissed,
  });

  static void show(
    BuildContext context, {
    required String handle,
    required VoidCallback onUndo,
  }) {
    final overlayState = Overlay.of(context);
    late OverlayEntry overlayEntry;

    overlayEntry = OverlayEntry(
      builder: (ctx) => Positioned(
        bottom: 80,
        left: 20,
        right: 20,
        child: Material(
          color: Colors.transparent,
          child: D16ConnectSentOverlay(
            handle: handle,
            onUndo: () {
              overlayEntry.remove();
              onUndo();
            },
            onDismissed: () {
              if (overlayEntry.mounted) {
                overlayEntry.remove();
              }
            },
          ),
        ),
      ),
    );

    overlayState.insert(overlayEntry);
  }

  @override
  State<D16ConnectSentOverlay> createState() => _D16ConnectSentOverlayState();
}

class _D16ConnectSentOverlayState extends State<D16ConnectSentOverlay>
    with TickerProviderStateMixin {
  late AnimationController _animController;
  late AnimationController _entranceController;
  late Animation<double> _scaleBadgeAnimation;
  late Animation<Offset> _slideCardAnimation;
  late Animation<double> _fadeCardAnimation;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _slideCardAnimation = Tween<Offset>(
      begin: const Offset(0.0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOutCubic,
    ));

    _fadeCardAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOut,
    ));

    _scaleBadgeAnimation = Tween<double>(
      begin: 0.2,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _entranceController,
      curve: const Interval(0.2, 1.0, curve: Curves.elasticOut),
    ));

    _entranceController.forward();

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..forward();

    _animController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onDismissed();
      }
    });
  }

  @override
  void dispose() {
    _entranceController.dispose();
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slideCardAnimation,
      child: FadeTransition(
        opacity: _fadeCardAnimation,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.textPrimary,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.18),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    ScaleTransition(
                      scale: _scaleBadgeAnimation,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.check, size: 16, color: AppColors.textPrimary),
                      ),
                    ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Connection Request Sent!',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        'Sent to ${widget.handle}',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: widget.onUndo,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    minimumSize: const Size(0, 32),
                  ),
                  child: const Text(
                    'Undo',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          AnimatedBuilder(
            animation: _animController,
            builder: (context, child) {
              return LinearProgressIndicator(
                value: 1.0 - _animController.value,
                backgroundColor: Colors.white12,
                valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                minHeight: 3,
              );
            },
          ),
        ],
      ),
    ),
  ),
);
  }
}
