import 'package:flutter/material.dart';
import 'core/config/env_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CreatorConnectApp());
}

class CreatorConnectApp extends StatefulWidget {
  const CreatorConnectApp({super.key});

  @override
  State<CreatorConnectApp> createState() => _CreatorConnectAppState();
}

class _CreatorConnectAppState extends State<CreatorConnectApp> {
  AppEnvironment _currentEnv = EnvironmentConfig.currentEnv;

  void _onEnvironmentChanged(AppEnvironment newEnv) {
    setState(() {
      _currentEnv = newEnv;
      EnvironmentConfig.setEnvironment(newEnv);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CreatorConnect',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFAF7F2), // Warm Cream
        colorScheme: const ColorScheme.light(
          primary: Color(0xFFFFCE38), // Signature Yellow
          onPrimary: Color(0xFF121212), // Rich Black
          surface: Colors.white,
          onSurface: Color(0xFF121212),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFFAF7F2),
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: Color(0xFF121212),
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
          iconTheme: IconThemeData(color: Color(0xFF121212)),
        ),
      ),
      home: AppTemplateHomeScreen(
        currentEnv: _currentEnv,
        onEnvironmentChanged: _onEnvironmentChanged,
      ),
    );
  }
}

class AppTemplateHomeScreen extends StatelessWidget {
  final AppEnvironment currentEnv;
  final ValueChanged<AppEnvironment> onEnvironmentChanged;

  const AppTemplateHomeScreen({
    super.key,
    required this.currentEnv,
    required this.onEnvironmentChanged,
  });

  final List<Map<String, String>> _services = const [
    {'name': 'Auth Service', 'path': 'lib/features/auth', 'desc': 'Identity sync, JWT & Supabase auth'},
    {'name': 'Users & Profile', 'path': 'lib/features/users', 'desc': 'User preferences, profiles & roles'},
    {'name': 'Campaigns', 'path': 'lib/features/campaigns', 'desc': 'Brand briefs & applications'},
    {'name': 'Discovery', 'path': 'lib/features/discovery', 'desc': 'Creator search & talent catalog'},
    {'name': 'Escrow & Payments', 'path': 'lib/features/escrow', 'desc': 'Milestones & Razorpay checkout'},
    {'name': 'Realtime Chat', 'path': 'lib/features/chat', 'desc': 'Socket.IO direct messaging'},
    {'name': 'Media Vault', 'path': 'lib/features/media', 'desc': 'Cloudflare R2 presigned uploads'},
    {'name': 'Notifications', 'path': 'lib/features/notifications', 'desc': 'FCM mobile push & in-app alerts'},
  ];

  @override
  Widget build(BuildContext context) {
    final activeConfig = EnvironmentConfig.current;

    return Scaffold(
      appBar: AppBar(
        title: const Text('CreatorConnect'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Chip(
              backgroundColor: const Color(0xFFFFCE38),
              label: Text(
                currentEnv.name.toUpperCase(),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF121212),
                ),
              ),
              padding: EdgeInsets.zero,
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // Environment Connection Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEDE7DE)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x06000000),
                  blurRadius: 6,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Environment & Connection',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF121212),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Target Base URL: ${activeConfig.apiBaseUrl}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: Color(0xFF6E685F),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Switch Environment:',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6E685F),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: AppEnvironment.values.map((env) {
                    final isSelected = currentEnv == env;
                    return ChoiceChip(
                      label: Text(env.name.toUpperCase()),
                      selected: isSelected,
                      onSelected: (val) {
                        if (val) onEnvironmentChanged(env);
                      },
                      selectedColor: const Color(0xFFFFCE38),
                      backgroundColor: const Color(0xFFF3EFE6),
                      labelStyle: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? const Color(0xFF121212) : const Color(0xFF6E685F),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Services & Folder Templates Header
          const Text(
            'Scaffolded Service Modules',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF121212),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Clean Architecture subfolders ready: data, domain, presentation (screens, dialogs, bottom_sheets, widgets, controllers).',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF6E685F),
            ),
          ),
          const SizedBox(height: 12),

          // List of Services
          ..._services.map((service) {
            return Card(
              color: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFEDE7DE)),
              ),
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFF3EFE6),
                  child: Icon(Icons.folder_outlined, color: Color(0xFF121212), size: 20),
                ),
                title: Text(
                  service['name']!,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
                subtitle: Text(
                  service['desc']!,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6E685F)),
                ),
                trailing: const Icon(Icons.check_circle, color: Color(0xFF27AE60), size: 18),
              ),
            );
          }),
        ],
      ),
    );
  }
}
