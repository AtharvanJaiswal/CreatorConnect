import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RootPage from '../../app/page';
import { middleware } from '../../middleware';
import AdminLoginPage from '../../app/admin/login/page';
import AdminRootLayout from '../../app/admin/layout';
import { NAV_SECTIONS, NavSection } from './AdminSidebar';
import { NextRequest } from 'next/server';

// Mock navigation
const mockRedirect = vi.fn();
const mockPush = vi.fn();
let mockPathname = '/admin/dashboard';

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}));

// Mock auth hook
let mockUser: any = null;
let mockIsLoading = false;
const mockLogin = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: mockIsLoading,
    login: mockLogin,
    signOut: mockSignOut,
  }),
}));

describe('Admin-Only Architecture & Security Audits', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUser = null;
    mockIsLoading = false;
    mockPathname = '/admin/dashboard';
  });

  describe('1. Root & Public Route Protection', () => {
    it('executes server-side redirect from / to /admin/login', () => {
      RootPage();
      expect(mockRedirect).toHaveBeenCalledWith('/admin/login');
    });

    it('middleware redirects root / to /admin/login', () => {
      const req = new NextRequest('https://creatorconnect.in/');
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://creatorconnect.in/admin/login');
    });

    it('middleware intercepts legacy public creator/brand routes and redirects to /admin/login', () => {
      const legacyPaths = [
        '/assignments',
        '/brand',
        '/creator',
        '/community',
        '/discovery',
        '/onboarding',
        '/messages',
        '/profiles/me',
      ];

      for (const path of legacyPaths) {
        const req = new NextRequest(`https://creatorconnect.in${path}`);
        const res = middleware(req);
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('https://creatorconnect.in/admin/login');
      }
    });

    it('middleware allows /admin/* requests with cryptographic CSP nonces, strict-dynamic, and defense-in-depth headers', () => {
      vi.stubEnv('NODE_ENV', 'production');
      try {
        const req1 = new NextRequest('https://creatorconnect.in/admin/dashboard');
        const req2 = new NextRequest('https://creatorconnect.in/admin/dashboard');
        const res1 = middleware(req1);
        const res2 = middleware(req2);

        expect(res1.status).toBe(200);
        expect(res1.headers.get('X-Frame-Options')).toBe('DENY');
        expect(res1.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res1.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
        expect(res1.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');

        const csp1 = res1.headers.get('Content-Security-Policy') || '';
        const csp2 = res2.headers.get('Content-Security-Policy') || '';

        expect(csp1).toContain("frame-ancestors 'none'");
        expect(csp1).toContain("object-src 'none'");
        expect(csp1).toContain('upgrade-insecure-requests');
        expect(csp1).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]+={0,2}' 'strict-dynamic'/);

        const scriptSrcDirective =
          csp1
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('script-src')) || '';
        expect(scriptSrcDirective).not.toContain("'unsafe-inline'");
        expect(scriptSrcDirective).not.toContain("'unsafe-eval'");

        const nonceMatch1 = csp1.match(/'nonce-([^']+)'/);
        const nonceMatch2 = csp2.match(/'nonce-([^']+)'/);
        expect(nonceMatch1?.[1]).toBeTruthy();
        expect(nonceMatch2?.[1]).toBeTruthy();
        expect(nonceMatch1?.[1]).not.toBe(nonceMatch2?.[1]);

        // Local HTTP requests must not emit HSTS or upgrade-insecure-requests so Firefox/WebKit work on http://127.0.0.1
        const httpReq = new NextRequest('http://127.0.0.1:3002/admin/dashboard');
        const httpRes = middleware(httpReq);
        const httpCsp = httpRes.headers.get('Content-Security-Policy') || '';
        expect(httpCsp).not.toContain('upgrade-insecure-requests');
        expect(httpRes.headers.get('Strict-Transport-Security')).toBeNull();
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('2. Hardened Admin Login', () => {
    it('renders hardened login form with staff email and password fields', () => {
      const html = renderToStaticMarkup(<AdminLoginPage />);
      expect(html).toContain('Admin Web Console');
      expect(html).toContain('Staff Email');
      expect(html).toContain('Password');
      expect(html).toContain('Authenticate &amp; Enter');
    });

    it('strictly does not contain dev test account buttons or hardcoded credentials', () => {
      const html = renderToStaticMarkup(<AdminLoginPage />);
      expect(html).not.toContain('Dev Test Accounts');
      expect(html).not.toContain('handleQuickLogin');
      expect(html).not.toContain('AdminPassword123!');
      expect(html).not.toContain('superadmin@creatorconnect.in');
    });

    it('strictly does not contain links to public app or download website', () => {
      const html = renderToStaticMarkup(<AdminLoginPage />);
      expect(html).not.toContain('Return to Public');
      expect(html).not.toContain('Download on Google Play');
      expect(html).not.toContain('Download on the App Store');
    });
  });

  describe('3. Admin Layout & Unauthenticated Route Protection', () => {
    it('blocks unauthenticated access and renders Restricted Admin Console barrier', () => {
      mockUser = null;
      mockPathname = '/admin/dashboard';

      const html = renderToStaticMarkup(
        <AdminRootLayout>
          <div>CONFIDENTIAL_LEDGER_DATA</div>
        </AdminRootLayout>,
      );

      expect(html).toContain('Restricted Admin Console');
      expect(html).toContain('Administrative privileges required');
      expect(html).toContain('Sign In to Admin Console');
      expect(html).not.toContain('CONFIDENTIAL_LEDGER_DATA');
      expect(html).not.toContain('Return to Public Site');
    });

    it('blocks non-staff authenticated users from viewing admin pages', () => {
      mockUser = {
        id: 'user-regular',
        email: 'consumer@creatorconnect.in',
        roles: ['CREATOR'],
        adminRoles: [],
        adminPermissions: [],
      };
      mockPathname = '/admin/payments';

      const html = renderToStaticMarkup(
        <AdminRootLayout>
          <div>CONFIDENTIAL_PAYMENT_DATA</div>
        </AdminRootLayout>,
      );

      expect(html).toContain('Restricted Admin Console');
      expect(html).not.toContain('CONFIDENTIAL_PAYMENT_DATA');
    });

    it('blocks bare ADMIN users without assigned adminRoles or adminPermissions (fail-closed)', () => {
      mockUser = {
        id: 'bare-admin',
        email: 'bare-admin@creatorconnect.in',
        roles: ['ADMIN'],
        adminRoles: [],
        adminPermissions: [],
      };
      mockPathname = '/admin/disputes';

      const html = renderToStaticMarkup(
        <AdminRootLayout>
          <div>SENSITIVE_DISPUTES_TABLE</div>
        </AdminRootLayout>,
      );

      expect(html).toContain('Restricted Admin Console');
      expect(html).toContain('Zero-trust access denied');
      expect(html).not.toContain('SENSITIVE_DISPUTES_TABLE');
    });

    it('filters sidebar links strictly by granted permissions for granular roles', () => {
      mockUser = {
        id: 'support-admin',
        email: 'support@creatorconnect.in',
        roles: ['ADMIN'],
        adminRoles: ['SUPPORT_ADMIN'],
        adminPermissions: ['support.manage', 'users.read', 'projects.read'],
      };
      mockPathname = '/admin/support';

      const html = renderToStaticMarkup(
        <AdminRootLayout>
          <div>SUPPORT_QUEUE</div>
        </AdminRootLayout>,
      );

      expect(html).toContain('SUPPORT_QUEUE');
      expect(html).toContain('Support Inquiries');
      expect(html).toContain('Users Directory');
      expect(html).not.toContain('Dual-Approval Refunds');
      expect(html).not.toContain('Ledger Reconciliation');
      expect(html).not.toContain('Staff &amp; RBAC');
      expect(html).not.toContain('Audit Trail');
    });

    it('renders admin shell with navigation and header for authenticated staff', () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@creatorconnect.in',
        roles: ['ADMIN'],
        adminRoles: ['SUPER_ADMIN'],
        adminPermissions: ['*'],
      };
      mockPathname = '/admin/dashboard';

      const html = renderToStaticMarkup(
        <AdminRootLayout>
          <div>DASHBOARD_CONTENT</div>
        </AdminRootLayout>,
      );

      expect(html).toContain('DASHBOARD_CONTENT');
      expect(html).toContain('Admin Console');
      expect(html).toContain('Dashboard');
      expect(html).toContain('aria-controls="admin-mobile-drawer"');
      expect(html).toContain('aria-label="Open navigation menu"');
      expect(html).toContain('id="admin-mobile-drawer"');
      expect(html).not.toContain('Restricted Admin Console');
    });

    it('renders login page directly without shell barrier when on /admin/login', () => {
      mockUser = null;
      mockPathname = '/admin/login';

      const html = renderToStaticMarkup(
        <AdminRootLayout>
          <div>LOGIN_PAGE_CONTENT</div>
        </AdminRootLayout>,
      );

      expect(html).toContain('LOGIN_PAGE_CONTENT');
      expect(html).not.toContain('Restricted Admin Console');
    });
  });

  describe('4. Admin Navigation Inventory Audit', () => {
    it('contains all 15+ verified operational admin modules in sidebar', () => {
      const allHrefs = NAV_SECTIONS.flatMap((section: NavSection) =>
        section.items.map((item) => item.href),
      );

      const requiredAdminRoutes = [
        '/admin/dashboard',
        '/admin/users',
        '/admin/verification',
        '/admin/assignments',
        '/admin/moderation',
        '/admin/reviews',
        '/admin/payments',
        '/admin/refunds',
        '/admin/reconciliation',
        '/admin/referrals',
        '/admin/notifications',
        '/admin/disputes',
        '/admin/jobs',
        '/admin/config',
        '/admin/admins',
        '/admin/roles',
        '/admin/audit',
        '/admin/lifecycle',
        '/admin/support',
      ];

      for (const route of requiredAdminRoutes) {
        expect(allHrefs).toContain(route);
      }
    });

    it('contains strictly zero links to public creator or brand portal pages', () => {
      const allHrefs = NAV_SECTIONS.flatMap((section: NavSection) =>
        section.items.map((item) => item.href),
      );

      const forbiddenRoutes = ['/', '/onboarding', '/discovery', '/brand', '/creator', '/messages'];

      for (const route of forbiddenRoutes) {
        expect(allHrefs).not.toContain(route);
      }
    });
  });
});
