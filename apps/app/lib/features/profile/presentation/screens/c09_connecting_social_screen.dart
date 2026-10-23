import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';

class C09ConnectingSocialScreen extends StatefulWidget {
  final ProfileRepository? repository;
  final String platform;
  final String handle;

  const C09ConnectingSocialScreen({
    super.key,
    this.repository,
    this.platform = 'Instagram',
    this.handle = 'anjana.creates',
  });

  @override
  State<C09ConnectingSocialScreen> createState() => _C09ConnectingSocialScreenState();
}

class _C09ConnectingSocialScreenState extends State<C09ConnectingSocialScreen> {
  late final ProfileRepository _repo;

  int _step = 0;
  bool _isSuccess = false;
  Timer? _timer;

  final List<String> _steps = [
    'Opening secure OAuth session...',
    'Verifying account permissions...',
    'Syncing audience metrics & media reach...',
    'Saving connection to CreatorConnect server...',
  ];

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _startSimulatedConnection();
  }

  void _startSimulatedConnection() {
    _timer = Timer.periodic(const Duration(milliseconds: 700), (t) async {
      if (!mounted) return;
      if (_step < _steps.length - 1) {
        setState(() => _step++);
      } else {
        t.cancel();
        // Call backend API to record social account link
        try {
          await _repo.connectSocialAccount(widget.platform, widget.handle);
          if (mounted) {
            setState(() => _isSuccess = true);
          }
        } catch (_) {
          if (mounted) {
            Navigator.pushReplacementNamed(
              context,
              '/profile/connection-error',
              arguments: {'platform': widget.platform},
            );
          }
        }
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              // Animated icon
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: _isSuccess ? const Color(0xFFE8F5E9) : const Color(0xFFFFF3CD),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: _isSuccess ? const Color(0xFF2E7D32) : AppColors.primary,
                    width: 3,
                  ),
                ),
                child: Icon(
                  _isSuccess ? Icons.check_circle_rounded : Icons.sync_rounded,
                  size: 44,
                  color: _isSuccess ? const Color(0xFF2E7D32) : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                _isSuccess ? '${widget.platform} Connected!' : 'Connecting to ${widget.platform}',
                style: const TextStyle(
                  fontFamily: 'Archivo',
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _isSuccess
                    ? 'Synced @${widget.handle} with CreatorConnect'
                    : 'Please wait while we establish a secure read-only handshake.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 36),
              // Checklist
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surfacePure,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Column(
                  children: List.generate(_steps.length, (index) {
                    final isDone = _isSuccess || _step > index;
                    final isCurrent = !_isSuccess && _step == index;

                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          if (isDone)
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32), size: 20)
                          else if (isCurrent)
                            const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                            )
                          else
                            const Icon(Icons.radio_button_unchecked, color: AppColors.textTertiary, size: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _steps[index],
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                                color: isDone || isCurrent ? AppColors.textPrimary : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ),
              ),
              const Spacer(),
              if (_isSuccess)
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text(
                      'Done',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
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
