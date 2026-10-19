enum AppEnvironment {
  local,
  dev,
  staging,
  prod,
}

class EnvironmentConfig {
  final AppEnvironment environment;
  final String apiBaseUrl;
  final String realtimeUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;

  const EnvironmentConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.realtimeUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
  });

  static AppEnvironment _currentEnv = _resolveDefaultEnvironment();

  static AppEnvironment get currentEnv => _currentEnv;

  static void setEnvironment(AppEnvironment env) {
    _currentEnv = env;
  }

  static AppEnvironment _resolveDefaultEnvironment() {
    const envString = String.fromEnvironment('ENV', defaultValue: 'dev');
    switch (envString.toLowerCase()) {
      case 'local':
        return AppEnvironment.local;
      case 'staging':
        return AppEnvironment.staging;
      case 'prod':
      case 'production':
        return AppEnvironment.prod;
      case 'dev':
      default:
        return AppEnvironment.dev;
    }
  }

  static EnvironmentConfig get current {
    switch (_currentEnv) {
      case AppEnvironment.local:
        return const EnvironmentConfig(
          environment: AppEnvironment.local,
          // 10.0.2.2 maps to host machine localhost in standard Android Emulator
          apiBaseUrl: 'http://10.0.2.2:4000/api/v1',
          realtimeUrl: 'http://10.0.2.2:4001',
          supabaseUrl: 'http://10.0.2.2:54321',
          supabaseAnonKey: 'local-dev-anon-key',
        );

      case AppEnvironment.dev:
        return const EnvironmentConfig(
          environment: AppEnvironment.dev,
          apiBaseUrl: 'https://dev-api.creatorconnect.com/api/v1',
          realtimeUrl: 'wss://dev-realtime.creatorconnect.com',
          supabaseUrl: 'https://dev.supabase.creatorconnect.com',
          supabaseAnonKey: 'dev-anon-key',
        );

      case AppEnvironment.staging:
        return const EnvironmentConfig(
          environment: AppEnvironment.staging,
          apiBaseUrl: 'https://staging-api.creatorconnect.com/api/v1',
          realtimeUrl: 'wss://staging-realtime.creatorconnect.com',
          supabaseUrl: 'https://staging.supabase.creatorconnect.com',
          supabaseAnonKey: 'staging-anon-key',
        );

      case AppEnvironment.prod:
        return const EnvironmentConfig(
          environment: AppEnvironment.prod,
          apiBaseUrl: 'https://api.creatorconnect.com/api/v1',
          realtimeUrl: 'wss://realtime.creatorconnect.com',
          supabaseUrl: 'https://auth.creatorconnect.com',
          supabaseAnonKey: 'prod-anon-key',
        );
    }
  }
}
