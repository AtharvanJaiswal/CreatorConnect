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

export const DEFAULT_CATEGORIES = [
  {
    id: '018f0001-0000-7000-8000-000000000001',
    slug: 'fashion-lifestyle',
    name: 'Fashion & Lifestyle',
    description: 'Fashion, beauty, styling and lifestyle content',
  },
  {
    id: '018f0001-0000-7000-8000-000000000002',
    slug: 'food',
    name: 'Food',
    description: 'Cooking, recipes, restaurant reviews, and culinary arts',
  },
  {
    id: '018f0001-0000-7000-8000-000000000003',
    slug: 'fitness',
    name: 'Fitness',
    description: 'Health, wellness, gym workouts, nutrition, and yoga',
  },
  {
    id: '018f0001-0000-7000-8000-000000000004',
    slug: 'tech',
    name: 'Tech',
    description: 'Technology reviews, software, gadgets, and consumer tech',
  },
  {
    id: '018f0001-0000-7000-8000-000000000005',
    slug: 'travel',
    name: 'Travel',
    description: 'Travel guides, hospitality, vlogs, and destination cinematics',
  },
  {
    id: '018f0001-0000-7000-8000-000000000006',
    slug: 'education',
    name: 'Education & Career',
    description: 'Tutorials, career guidance, and learning',
  },
  {
    id: '018f0001-0000-7000-8000-000000000007',
    slug: 'gaming',
    name: 'Gaming & Esports',
    description: 'Gameplay, streaming, esports and game reviews',
  },
  {
    id: '018f0001-0000-7000-8000-000000000008',
    slug: 'entertainment',
    name: 'Entertainment & Comedy',
    description: 'Comedy sketches, reaction videos, and cinema',
  },
];

export const DEFAULT_SKILLS = [
  { id: '018f0002-0000-7000-8000-000000000001', slug: 'video-editing', name: 'Video Editing' },
  { id: '018f0002-0000-7000-8000-000000000002', slug: 'color-grading', name: 'Color Grading' },
  { id: '018f0002-0000-7000-8000-000000000003', slug: 'motion-graphics', name: 'Motion Graphics' },
  { id: '018f0002-0000-7000-8000-000000000004', slug: 'drone-operation', name: 'Drone Operation' },
  {
    id: '018f0002-0000-7000-8000-000000000005',
    slug: 'sound-design',
    name: 'Sound Design & Mixing',
  },
  { id: '018f0002-0000-7000-8000-000000000006', slug: 'lighting-grip', name: 'Lighting & Grip' },
  { id: '018f0002-0000-7000-8000-000000000007', slug: 'scriptwriting', name: 'Scriptwriting' },
  {
    id: '018f0002-0000-7000-8000-000000000008',
    slug: 'photography',
    name: 'Commercial Photography',
  },
];

export async function seedTaxonomy(): Promise<void> {
  console.log('Seeding baseline taxonomy categories and skills...');
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, isActive: true },
      create: {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        isActive: true,
      },
    });
  }
  for (const sk of DEFAULT_SKILLS) {
    await prisma.skill.upsert({
      where: { slug: sk.slug },
      update: { name: sk.name, isActive: true },
      create: { id: sk.id, slug: sk.slug, name: sk.name, isActive: true },
    });
  }
  console.log('Taxonomy seeded successfully.');
}

async function main() {
  try {
    await seedRoles();
    await seedTaxonomy();
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
