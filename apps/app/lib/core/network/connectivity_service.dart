import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/env_config.dart';
import '../../../features/discovery/presentation/controllers/module_d_controllers.dart';
import '../../../features/chat/presentation/controllers/chat_controllers.dart';

@immutable
class NetworkConnectivityState {
  final bool isOnline;
  final bool isProbing;
  final DateTime? lastChecked;
  final String? activeHost;

  const NetworkConnectivityState({
    this.isOnline = true,
    this.isProbing = false,
    this.lastChecked,
    this.activeHost,
  });

  NetworkConnectivityState copyWith({
    bool? isOnline,
    bool? isProbing,
    DateTime? lastChecked,
    String? activeHost,
  }) {
    return NetworkConnectivityState(
      isOnline: isOnline ?? this.isOnline,
      isProbing: isProbing ?? this.isProbing,
      lastChecked: lastChecked ?? this.lastChecked,
      activeHost: activeHost ?? this.activeHost,
    );
  }
}

class NetworkConnectivityNotifier extends StateNotifier<NetworkConnectivityState> {
  final Ref _ref;
  final bool enablePeriodicMonitoring;
  Timer? _periodicTimer;
  final Dio _probeDio;

  NetworkConnectivityNotifier(
    this._ref, {
    this.enablePeriodicMonitoring = true,
    Dio? dio,
  })  : _probeDio = dio ??
            Dio(
              BaseOptions(
                connectTimeout: const Duration(milliseconds: 1800),
                receiveTimeout: const Duration(milliseconds: 1800),
              ),
            ),
        super(const NetworkConnectivityState()) {
    if (enablePeriodicMonitoring) {
      probeConnectivity();
      _startPeriodicMonitoring();
    }
  }

  void _startPeriodicMonitoring() {
    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      probeConnectivity();
    });
  }

  /// Probes the backend /health endpoint to verify end-to-end network & database reachability.
  Future<bool> probeConnectivity() async {
    if (state.isProbing) return state.isOnline;
    state = state.copyWith(isProbing: true);

    bool online = false;
    String? resolvedHost;

    final candidateHosts = {
      EnvironmentConfig.activeHost,
      if (EnvironmentConfig.currentEnv == AppEnvironment.local) ...[
        '192.168.1.104',
        '192.168.1.103',
        '127.0.0.1',
        '10.0.2.2',
        '192.168.1.42',
        '192.168.1.108',
      ],
    }.toList();

    for (final host in candidateHosts) {
      try {
        final res = await _probeDio.get('http://$host:3000/health');
        if (res.statusCode == 200) {
          online = true;
          resolvedHost = host;
          if (host != EnvironmentConfig.activeHost) {
            EnvironmentConfig.setActiveHost(host);
          }
          break;
        }
      } catch (_) {
        // Probe next host
      }
    }

    final wasOffline = !state.isOnline;
    state = state.copyWith(
      isOnline: online,
      isProbing: false,
      lastChecked: DateTime.now(),
      activeHost: resolvedHost ?? state.activeHost,
    );

    // Automatic recovery trigger: when connection transitions from offline -> online,
    // automatically refresh stale Riverpod providers without requiring manual app restart.
    if (wasOffline && online) {
      debugPrint('NetworkConnectivityService: Connection restored! Auto-syncing dashboard, discovery, and chat...');
      _triggerAutoRecovery();
    }

    return online;
  }

  void _triggerAutoRecovery() {
    try {
      _ref.read(homeDashboardProvider.notifier).initDashboard();
      _ref.read(discoveryFeedProvider.notifier).fetchFeed();
      _ref.read(conversationsProvider.notifier).loadInbox();
    } catch (e) {
      debugPrint('NetworkConnectivityService: Auto-recovery provider sync notice: $e');
    }
  }

  @override
  void dispose() {
    _periodicTimer?.cancel();
    super.dispose();
  }
}

final networkConnectivityProvider =
    StateNotifierProvider<NetworkConnectivityNotifier, NetworkConnectivityState>((ref) {
  return NetworkConnectivityNotifier(ref);
});
