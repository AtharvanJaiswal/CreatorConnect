import 'dotenv/config';
import { PrismaClient, RoleType } from '@prisma/client';

import { generateUuidV7 } from '@creatorconnect/utils';

const prisma = new PrismaClient();

const ROLES_TO_SEED: Array<{ name: RoleType; description: string }> = [
  {
    name: RoleType.CREATOR,
    description: 'Content creator persona with media and portfolio capabilities',
  },
  {
    name: RoleType.PROFESSIONAL,
    description: 'Industry professional providing services, editing, and production',
  },
  {
    name: RoleType.BRAND,
    description: 'Brand representative creating campaigns and hiring creators',
  },
  {
    name: RoleType.PODCASTER,
    description: 'Podcaster seeking guests, sponsors, and audio production',
  },
  {
    name: RoleType.ADMIN,
    description: 'System administrator with operational and management access',
  },
];

export async function seedRoles(): Promise<void> {
  console.log('Seeding baseline platform roles...');
  for (const roleData of ROLES_TO_SEED) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: {
        id: generateUuidV7(),
        name: roleData.name,
        description: roleData.description,
      },
    });
  }
  console.log('Roles seeded successfully.');
}

const ADMIN_PERMISSIONS_TO_SEED = [
  // Users
  {
    name: 'users.read',
    module: 'users',
    description: 'View user accounts, profiles, and activity timeline',
  },
  { name: 'users.update', module: 'users', description: 'Update user profile attributes' },
  { name: 'users.suspend', module: 'users', description: 'Suspend user accounts' },
  { name: 'users.reactivate', module: 'users', description: 'Reactivate suspended user accounts' },
  { name: 'users.export', module: 'users', description: 'Export user data for compliance' },
  {
    name: 'users.privacy',
    module: 'users',
    description: 'Process privacy and legal hold requests',
  },

  // Projects
  {
    name: 'projects.read',
    module: 'projects',
    description: 'Search and view all marketplace projects',
  },
  {
    name: 'projects.moderate',
    module: 'projects',
    description: 'Suspend or moderate suspicious projects',
  },

  // Payments
  {
    name: 'payments.read',
    module: 'payments',
    description: 'View transactions, balances, and escrow details',
  },
  { name: 'payments.refund.request', module: 'payments', description: 'Initiate refund requests' },
  {
    name: 'payments.refund.approve',
    module: 'payments',
    description: 'Approve or reject dual-approval refunds',
  },
  { name: 'payments.reconcile', module: 'payments', description: 'Perform ledger reconciliation' },

  // Moderation
  {
    name: 'reports.review',
    module: 'moderation',
    description: 'Review abuse reports and evidence',
  },
  {
    name: 'reports.resolve',
    module: 'moderation',
    description: 'Take enforcement action on reports',
  },
  {
    name: 'reviews.moderate',
    module: 'moderation',
    description: 'Moderate reported project reviews',
  },

  // Support
  {
    name: 'support.manage',
    module: 'support',
    description: 'Assign tickets and update status/priority',
  },
  { name: 'support.reply', module: 'support', description: 'Send public responses to customers' },
  { name: 'support.notes', module: 'support', description: 'Create internal staff notes' },

  // Analytics
  {
    name: 'analytics.read',
    module: 'analytics',
    description: 'View platform overview and aggregate metrics',
  },

  // Admins
  {
    name: 'admins.manage',
    module: 'admins',
    description: 'Assign/revoke admin roles and manage permissions',
  },
  {
    name: 'admins.read',
    module: 'admins',
    description: 'View administrator roster and assigned roles',
  },

  // Settings
  {
    name: 'settings.read',
    module: 'settings',
    description: 'View platform configuration and feature flags',
  },
  {
    name: 'settings.manage',
    module: 'settings',
    description: 'Modify platform configuration and feature flags',
  },

  // Audit
  { name: 'audit.read', module: 'audit', description: 'View and export administrative audit logs' },

  // Wildcard
  { name: '*', module: 'system', description: 'Universal administrative super-permission' },
];

const ADMIN_ROLES_TO_SEED = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full platform authority, security, and administrative management',
    isSystem: true,
    permissions: ['*'],
  },
  {
    name: 'PLATFORM_ADMIN',
    description: 'Day-to-day platform management and marketplace operations',
    isSystem: true,
    permissions: [
      'users.read',
      'users.update',
      'users.suspend',
      'projects.read',
      'projects.moderate',
      'reports.review',
      'reports.resolve',
      'support.manage',
      'support.reply',
      'support.notes',
      'settings.read',
      'analytics.read',
      'audit.read',
    ],
  },
  {
    name: 'USER_ADMIN',
    description: 'User directory, suspensions, verification, and privacy requests',
    isSystem: true,
    permissions: [
      'users.read',
      'users.update',
      'users.suspend',
      'users.reactivate',
      'users.export',
      'users.privacy',
      'audit.read',
    ],
  },
  {
    name: 'FINANCE_ADMIN',
    description: 'Financial reconciliation, payment disputes, and refund management',
    isSystem: true,
    permissions: [
      'payments.read',
      'payments.refund.request',
      'payments.refund.approve',
      'payments.reconcile',
      'analytics.read',
      'audit.read',
    ],
  },
  {
    name: 'TRUST_SAFETY_ADMIN',
    description: 'Content moderation, abuse reports, review moderation, and suspensions',
    isSystem: true,
    permissions: [
      'reports.review',
      'reports.resolve',
      'reviews.moderate',
      'users.suspend',
      'projects.moderate',
      'audit.read',
    ],
  },
  {
    name: 'SUPPORT_ADMIN',
    description: 'Customer service escalation, ticket reassignment, and SLA oversight',
    isSystem: true,
    permissions: [
      'support.manage',
      'support.reply',
      'support.notes',
      'users.read',
      'projects.read',
    ],
  },
  {
    name: 'CONTENT_MODERATOR',
    description: 'Front-line review, community, and media content moderation',
    isSystem: true,
    permissions: ['reports.review', 'reviews.moderate', 'projects.read'],
  },
  {
    name: 'ANALYTICS_VIEWER',
    description: 'Read-only access to platform metrics and aggregate reports',
    isSystem: true,
    permissions: ['analytics.read'],
  },
];

export async function seedAdminRbac(): Promise<void> {
  console.log('Seeding administrative permissions...');
  const permissionMap = new Map<string, string>();

  for (const perm of ADMIN_PERMISSIONS_TO_SEED) {
    const record = await prisma.adminPermission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, module: perm.module },
      create: {
        id: generateUuidV7(),
        name: perm.name,
        description: perm.description,
        module: perm.module,
      },
    });
    permissionMap.set(perm.name, record.id);
  }

  console.log('Seeding administrative roles...');
  for (const roleData of ADMIN_ROLES_TO_SEED) {
    const role = await prisma.adminRole.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description, isSystem: roleData.isSystem },
      create: {
        id: generateUuidV7(),
        name: roleData.name,
        description: roleData.description,
        isSystem: roleData.isSystem,
      },
    });

    // Seed role-permission mappings
    for (const permName of roleData.permissions) {
      const permId = permissionMap.get(permName);
      if (permId) {
        await prisma.adminRolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            id: generateUuidV7(),
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }
  console.log('Administrative RBAC seeded successfully.');
}

async function main() {
  try {
    await seedRoles();
    await seedAdminRbac();
  } catch (error) {
    console.error('Seed execution failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('seed.ts')) {
  main();
}
