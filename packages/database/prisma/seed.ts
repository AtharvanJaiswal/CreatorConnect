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

async function main() {
  try {
    await seedRoles();
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
