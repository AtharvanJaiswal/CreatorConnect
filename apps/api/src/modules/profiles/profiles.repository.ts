import { getPrismaClient, type Category, type Skill, type Prisma } from '@creatorconnect/database';

export class ProfilesRepository {
  constructor(private prisma = getPrismaClient()) {}

  // ==============================================================================
  // Creator Profile
  // ==============================================================================

  async findCreatorProfileById(id: string) {
    return this.prisma.creatorProfile.findUnique({
      where: { id },
      include: {
        categories: {
          include: { category: true },
        },
        user: true,
      },
    });
  }

  async findCreatorProfileByUserId(userId: string) {
    return this.prisma.creatorProfile.findUnique({
      where: { userId },
      include: {
        categories: {
          include: { category: true },
        },
        user: true,
      },
    });
  }

  async upsertCreatorProfile(
    userId: string,
    data: Prisma.CreatorProfileUpdateInput,
    createData: Prisma.CreatorProfileUncheckedCreateInput,
    categoryIds?: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.creatorProfile.upsert({
        where: { userId },
        update: data,
        create: createData,
      });

      if (categoryIds !== undefined) {
        await tx.creatorProfileCategory.deleteMany({
          where: { creatorProfileId: profile.id },
        });

        if (categoryIds.length > 0) {
          await tx.creatorProfileCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              creatorProfileId: profile.id,
              categoryId,
            })),
          });
        }
      }

      return tx.creatorProfile.findUnique({
        where: { id: profile.id },
        include: {
          categories: { include: { category: true } },
          user: true,
        },
      });
    });
  }

  // ==============================================================================
  // Professional Profile
  // ==============================================================================

  async findProfessionalProfileById(id: string) {
    return this.prisma.professionalProfile.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findProfessionalProfileByUserId(userId: string) {
    return this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async upsertProfessionalProfile(
    userId: string,
    data: Prisma.ProfessionalProfileUpdateInput,
    createData: Prisma.ProfessionalProfileUncheckedCreateInput,
  ) {
    return this.prisma.professionalProfile.upsert({
      where: { userId },
      update: data,
      create: createData,
      include: { user: true },
    });
  }

  // ==============================================================================
  // Brand Profile
  // ==============================================================================

  async findBrandProfileById(id: string) {
    return this.prisma.brandProfile.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findBrandProfileByUserId(userId: string) {
    return this.prisma.brandProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async upsertBrandProfile(
    userId: string,
    data: Prisma.BrandProfileUpdateInput,
    createData: Prisma.BrandProfileUncheckedCreateInput,
  ) {
    return this.prisma.brandProfile.upsert({
      where: { userId },
      update: data,
      create: createData,
      include: { user: true },
    });
  }

  // ==============================================================================
  // Podcaster Profile
  // ==============================================================================

  async findPodcasterProfileById(id: string) {
    return this.prisma.podcasterProfile.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findPodcasterProfileByUserId(userId: string) {
    return this.prisma.podcasterProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async upsertPodcasterProfile(
    userId: string,
    data: Prisma.PodcasterProfileUpdateInput,
    createData: Prisma.PodcasterProfileUncheckedCreateInput,
  ) {
    return this.prisma.podcasterProfile.upsert({
      where: { userId },
      update: data,
      create: createData,
      include: { user: true },
    });
  }

  // ==============================================================================
  // User Skills & Taxonomy
  // ==============================================================================

  async findUserSkills(userId: string) {
    return this.prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    });
  }

  async replaceUserSkills(
    userId: string,
    skills: Array<{ id: string; skillId: string; proficiency: any }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.userSkill.deleteMany({ where: { userId } });
      if (skills.length > 0) {
        await tx.userSkill.createMany({
          data: skills.map((s) => ({
            id: s.id,
            userId,
            skillId: s.skillId,
            proficiency: s.proficiency,
          })),
        });
      }
      return tx.userSkill.findMany({
        where: { userId },
        include: { skill: true },
      });
    });
  }

  async findActiveCategoriesByIds(ids: string[]): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { id: { in: ids }, isActive: true },
    });
  }

  async findActiveSkillsByIds(ids: string[]): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      where: { id: { in: ids }, isActive: true },
    });
  }

  async findAllActiveCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllActiveSkills(): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}

export const profilesRepository = new ProfilesRepository();
