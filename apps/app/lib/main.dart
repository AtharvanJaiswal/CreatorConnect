import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/config/env_config.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/domain/entities/user_role.dart';
import 'features/auth/presentation/screens/splash_screen.dart';
import 'features/auth/presentation/screens/onboarding_screen.dart';
import 'features/auth/presentation/screens/account_type_screen.dart';
import 'features/auth/presentation/screens/mobile_register_screen.dart';
import 'features/auth/presentation/screens/email_register_screen.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/forgot_password_screen.dart';
import 'features/auth/presentation/screens/reset_password_screen.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';

// Profile Setup & Verification (Module C)
import 'features/profile/domain/entities/profile_entities.dart';
import 'features/profile/presentation/screens/c01_profile_completion_screen.dart';
import 'features/profile/presentation/screens/c02_basic_information_screen.dart';
import 'features/profile/presentation/screens/c03_category_and_skills_screen.dart';
import 'features/profile/presentation/screens/c04_creator_details_screen.dart';
import 'features/profile/presentation/screens/c05_professional_details_screen.dart';
import 'features/profile/presentation/screens/c06_podcast_details_screen.dart';
import 'features/profile/presentation/screens/c07_company_details_screen.dart';
import 'features/profile/presentation/screens/c08_social_accounts_screen.dart';
import 'features/profile/presentation/screens/c09_connecting_social_screen.dart';
import 'features/profile/presentation/screens/c10_social_account_detail_screen.dart';
import 'features/profile/presentation/screens/c11_connection_error_screen.dart';
import 'features/profile/presentation/screens/c12_verification_centre_screen.dart';
import 'features/profile/presentation/screens/c13_verification_request_screen.dart';
import 'features/profile/presentation/screens/c14_verification_result_screen.dart';
import 'features/profile/presentation/screens/c15_add_another_role_screen.dart';
import 'features/profile/presentation/screens/user_profile_screen.dart';

// Module E: Briefs, Campaigns & Applications
import 'features/campaigns/presentation/screens/e01_brand_briefs_dashboard_screen.dart';
import 'features/campaigns/presentation/screens/e02_create_brief_wizard_screen.dart';
import 'features/campaigns/presentation/screens/e06_brand_manage_applicants_screen.dart';
import 'features/campaigns/presentation/screens/e07_brief_detail_screen.dart';
import 'features/campaigns/presentation/screens/e08_submit_application_screen.dart';
import 'features/campaigns/presentation/screens/e10_creator_my_applications_screen.dart';
import 'features/campaigns/presentation/screens/e11_application_detail_screen.dart';
import 'features/campaigns/presentation/screens/e12_saved_briefs_screen.dart';
import 'features/campaigns/presentation/screens/e14_accept_applicant_screen.dart';
import 'features/discovery/presentation/screens/module_d_shell_screen.dart';
import 'features/discovery/presentation/screens/d04_notification_center_screen.dart';
import 'features/discovery/presentation/screens/d06_search_results_screen.dart';
import 'features/discovery/presentation/screens/d09_creator_public_profile_screen.dart';
import 'features/discovery/presentation/screens/d10_brand_public_profile_screen.dart';
import 'features/discovery/presentation/screens/d12_recommendations_screen.dart';
import 'features/chat/presentation/screens/e01_conversations_list_screen.dart';
import 'features/chat/presentation/screens/e04_chat_thread_screen.dart';
import 'features/campaigns/domain/entities/campaign_entities.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final config = EnvironmentConfig.current;
  if (config.supabaseAnonKey.isNotEmpty) {
    try {
      await Supabase.initialize(
        url: config.supabaseUrl,
        publishableKey: config.supabaseAnonKey,
      );
    } catch (e) {
      debugPrint('Supabase initialization notice: $e');
    }
  }

  runApp(const ProviderScope(child: CreatorConnectApp()));
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
      theme: AppTheme.lightTheme,
      home: const SplashScreen(),
      routes: {
        '/splash': (context) => const SplashScreen(),
        '/onboarding': (context) => const OnboardingScreen(),
        '/account-type': (context) => const AccountTypeScreen(),
        '/register-mobile': (context) {
          final args = ModalRoute.of(context)?.settings.arguments;
          final role = args is UserRole ? args : UserRole.creator;
          return MobileRegisterScreen(selectedRole: role);
        },
        '/register-email': (context) {
          final args = ModalRoute.of(context)?.settings.arguments;
          final role = args is UserRole ? args : UserRole.creator;
          return EmailRegisterScreen(selectedRole: role);
        },
        '/login': (context) => const LoginScreen(),
        '/forgot-password': (context) => const ForgotPasswordScreen(),
        '/reset-password': (context) => const ResetPasswordScreen(),
        '/dev-home': (context) => AppTemplateHomeScreen(
              currentEnv: _currentEnv,
              onEnvironmentChanged: _onEnvironmentChanged,
            ),
        // Module C: Profile Setup, Social Accounts & Verification
        '/profile/completion': (context) => const C01ProfileCompletionScreen(),
        '/profile/basic-info': (context) => const C02BasicInformationScreen(),
        '/profile/category-skills': (context) => const C03CategoryAndSkillsScreen(),
        '/profile/creator-details': (context) => const C04CreatorDetailsScreen(),
        '/profile/professional-details': (context) => const C05ProfessionalDetailsScreen(),
        '/profile/podcast-details': (context) => const C06PodcastDetailsScreen(),
        '/profile/company-details': (context) => const C07CompanyDetailsScreen(),
        '/profile/social-accounts': (context) => const C08SocialAccountsScreen(),
        '/profile/verification-centre': (context) => const C12VerificationCentreScreen(),
        '/profile/add-role': (context) => const C15AddAnotherRoleScreen(),
        '/profile': (context) => const UserProfileScreen(),

        // Module E: Briefs, Campaigns & Applications
        '/campaigns/brand-dashboard': (context) => const E01BrandBriefsDashboardScreen(),
        '/campaigns/create': (context) => const E02CreateBriefWizardScreen(),
        '/campaigns/my-applications': (context) => const E10CreatorMyApplicationsScreen(),
        '/campaigns/saved': (context) => const E12SavedBriefsScreen(),
        '/home': (context) => const ModuleDShellScreen(),
        '/discover': (context) => const ModuleDShellScreen(),
        '/notifications': (context) => const D04NotificationCenterScreen(),
        '/conversations': (context) => const E01ConversationsListScreen(),
        '/recommendations': (context) => D12RecommendationsScreen(
              onOpenProfile: (id) => Navigator.pushNamed(context, '/profile/detail', arguments: id),
            ),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/profile/detail') {
          final args = settings.arguments;
          String id = 'self';
          String? role;
          if (args is String) {
            id = args;
          } else if (args is Map) {
            id = args['id'] as String? ?? 'self';
            role = args['role'] as String?;
          }
          final isBrand = role?.toUpperCase() == 'BRAND' || id.startsWith('b-') || id == 'brand';
          if (isBrand) {
            return MaterialPageRoute(builder: (_) => D10BrandPublicProfileScreen(brandId: id));
          }
          return MaterialPageRoute(builder: (_) => D09CreatorPublicProfileScreen(profileId: id));
        }
        if (settings.name == '/search') {
          final query = settings.arguments as String?;
          return MaterialPageRoute(
            builder: (_) => D06SearchResultsScreen(
              initialQuery: query,
              onOpenProfile: (id) => Navigator.pushNamed(context, '/profile/detail', arguments: id),
            ),
          );
        }
        if (settings.name == '/profile/connecting-social') {
          final args = settings.arguments as Map<String, dynamic>?;
          final platform = args?['platform'] as String? ?? 'Instagram';
          return MaterialPageRoute(
            builder: (_) => C09ConnectingSocialScreen(platform: platform),
          );
        }
        if (settings.name == '/profile/social-account-detail') {
          final account = settings.arguments as SocialPlatformAccount? ??
              const SocialPlatformAccount(
                platform: 'Instagram',
                handle: 'anjana.creates',
                status: SocialPlatformStatus.connected,
                followersCount: '24.6k',
                postsCount: 312,
              );
          return MaterialPageRoute(
            builder: (_) => C10SocialAccountDetailScreen(account: account),
          );
        }
        if (settings.name == '/profile/connection-error') {
          final args = settings.arguments as Map<String, dynamic>?;
          final platform = args?['platform'] as String? ?? 'Instagram';
          return MaterialPageRoute(
            builder: (_) => C11ConnectionErrorScreen(platform: platform),
          );
        }
        if (settings.name == '/profile/verification-request') {
          final args = settings.arguments as Map<String, dynamic>?;
          final isBrand = args?['isBrand'] as bool? ?? false;
          return MaterialPageRoute(
            builder: (_) => C13VerificationRequestScreen(isBrand: isBrand),
          );
        }
        if (settings.name == '/profile/verification-result') {
          VerificationData? data;
          if (settings.arguments is VerificationData) {
            data = settings.arguments as VerificationData;
          } else if (settings.arguments is Map) {
            data = const VerificationData(state: VerificationState.underReview);
          }
          return MaterialPageRoute(
            builder: (_) => C14VerificationResultScreen(data: data),
          );
        }
        if (settings.name == '/chat') {
          final convId = settings.arguments as String? ?? 'conv-zara-01';
          return MaterialPageRoute(
            builder: (_) => E04ChatThreadScreen(conversationId: convId),
          );
        }
        if (settings.name == '/campaigns/manage-applicants') {
          final briefId = settings.arguments as String? ?? 'b-demo-01';
          return MaterialPageRoute(
            builder: (_) => E06BrandManageApplicantsScreen(briefId: briefId),
          );
        }
        if (settings.name == '/campaigns/brief-detail') {
          final briefId = settings.arguments as String? ?? 'b-demo-01';
          return MaterialPageRoute(
            builder: (_) => E07BriefDetailScreen(briefId: briefId),
          );
        }
        if (settings.name == '/campaigns/apply') {
          final brief = settings.arguments as CampaignBrief?;
          if (brief == null) {
            return MaterialPageRoute(
              builder: (_) => const Scaffold(
                body: Center(child: Text('Invalid campaign brief specified')),
              ),
            );
          }
          return MaterialPageRoute(
            builder: (_) => E08SubmitApplicationScreen(brief: brief),
          );
        }
        if (settings.name == '/campaigns/application-detail') {
          final app = settings.arguments as ApplicationItem?;
          if (app == null) {
            return MaterialPageRoute(
              builder: (_) => const Scaffold(
                body: Center(child: Text('Invalid application specified')),
              ),
            );
          }
          return MaterialPageRoute(
            builder: (_) => E11ApplicationDetailScreen(application: app),
          );
        }
        if (settings.name == '/campaigns/accept-applicant') {
          final applicant = settings.arguments as ApplicationItem?;
          if (applicant == null) {
            return MaterialPageRoute(
              builder: (_) => const Scaffold(
                body: Center(child: Text('Invalid applicant specified')),
              ),
            );
          }
          return MaterialPageRoute(
            builder: (_) => E14AcceptApplicantScreen(applicant: applicant),
          );
        }
        return null;
      },
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
    final isSupabaseConfigured = activeConfig.supabaseAnonKey.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('CreatorConnect'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
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
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'logout') {
                await AuthRepositoryImpl().signOut();
                if (context.mounted) {
                  Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
                }
              } else if (value == 'reset_onboarding') {
                await AuthRepositoryImpl().clearOnboarding();
                if (context.mounted) {
                  Navigator.of(context).pushNamedAndRemoveUntil('/splash', (route) => false);
                }
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 18),
                    SizedBox(width: 8),
                    Text('Log Out'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'reset_onboarding',
                child: Row(
                  children: [
                    Icon(Icons.refresh, size: 18),
                    SizedBox(width: 8),
                    Text('Reset Onboarding (Dev)'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // Supabase Connection Status Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isSupabaseConfigured ? const Color(0xFF27AE60) : const Color(0xFFE5A100),
                width: 1.5,
              ),  
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Supabase Connection',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF121212),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isSupabaseConfigured
                            ? const Color(0xFFE8F7ED)
                            : const Color(0xFFFFF6D9),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        isSupabaseConfigured ? 'CONNECTED' : 'URL SET • AWAITING ANON KEY',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isSupabaseConfigured
                              ? const Color(0xFF27AE60)
                              : const Color(0xFF7A5B00),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Project URL: ${activeConfig.supabaseUrl}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: Color(0xFF6E685F),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Target Base API: ${activeConfig.apiBaseUrl}',
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

          // Module D: Home, Discovery & Public Profiles
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFDF5),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFFD64A), width: 2),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Module D: Home & Discovery',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF121212),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF9E6),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFFFD64A)),
                      ),
                      child: const Text(
                        '16 SCREENS & SHEETS · PROD',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF8C6A0A),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'D01–D16: Home (Creator & Brand), Discovery, Search & Autocomplete, Public Profiles, SOW §13 Rule Matching, Quotas & Popups.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6E685F), height: 1.3),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFFD64A),
                      foregroundColor: const Color(0xFF1A1815),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    onPressed: () => Navigator.pushNamed(context, '/home'),
                    child: const Text(
                      'Launch Module D (Home & Discover)',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Module C: Profile Setup & Verification Feature Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFDF5),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFFD64A), width: 2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Module C: Profile & Verification',
                        style: TextStyle(
                          fontFamily: 'Archivo',
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF121212),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text(
                        '15 SCREENS · LIVE API',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF2E7D32),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'C01–C15: Checklist, Basic Info, Taxonomy, Rates, Social OAuth Handoff, Bio Code & Document Verification.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6E685F), height: 1.3),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFFD64A),
                      foregroundColor: const Color(0xFF1A1815),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    onPressed: () => Navigator.pushNamed(context, '/profile/completion'),
                    child: const Text(
                      'Open Profile Setup (C01)',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                  ),
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
                trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF27AE60), size: 14),
                onTap: () {
                  if (service['name'] == 'Discovery') {
                    Navigator.pushNamed(context, '/home');
                  } else if (service['name'] == 'Users & Profile') {
                    Navigator.pushNamed(context, '/profile/completion');
                  }
                },
              ),
            );
          }),
        ],
      ),
    );
  }
}
