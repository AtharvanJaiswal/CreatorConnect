import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  UpdateCreatorProfileInput,
  CreatorProfileResponse,
  UpdateProfessionalProfileInput,
  ProfessionalProfileResponse,
  UpdateBrandProfileInput,
  BrandProfileResponse,
  UpdatePodcasterProfileInput,
  PodcasterProfileResponse,
  UpdateUserSkillsInput,
  UserSkillResponse,
  CategoryResponse,
  SkillResponse,
} from '@creatorconnect/contracts';
import { profilesRepository, ProfilesRepository } from './profiles.repository.js';
import {
  NotFoundError,
  ForbiddenError,
  AuthInsufficientRoleError,
  InactiveTaxonomyError,
} from '../../errors/app-error.js';

export class ProfilesService {
  constructor(private repo: ProfilesRepository = profilesRepository) {}

  // ==============================================================================
  // Creator Profile
  // ==============================================================================

  async getCreatorProfile(
    idOrUserId: string,
    callerId?: string,
    isAdmin = false,
  ): Promise<CreatorProfileResponse> {
    let profile = await this.repo.findCreatorProfileById(idOrUserId);
    if (!profile) {
      profile = await this.repo.findCreatorProfileByUserId(idOrUserId);
    }

    if (!profile || profile.deletedAt || profile.user.status !== 'ACTIVE') {
      throw new NotFoundError('Creator profile not found.');
    }

    if (profile.visibility === 'PRIVATE' && profile.userId !== callerId && !isAdmin) {
      throw new ForbiddenError('This creator profile is private.');
    }

    return this.mapCreatorProfile(profile);
  }

  async updateCreatorProfile(
    userId: string,
    roles: string[],
    input: UpdateCreatorProfileInput,
  ): Promise<CreatorProfileResponse> {
    if (!roles.includes('CREATOR')) {
      throw new AuthInsufficientRoleError('User does not have CREATOR role.');
    }

    if (input.categoryIds && input.categoryIds.length > 0) {
      const activeCategories = await this.repo.findActiveCategoriesByIds(input.categoryIds);
      if (activeCategories.length !== input.categoryIds.length) {
        throw new InactiveTaxonomyError('One or more selected categories are inactive or invalid.');
      }
    }

    let completionScore = 0;
    if (input.tagline) completionScore += 20;
    if (input.bio) completionScore += 20;
    if (input.locationCountry && input.locationCity) completionScore += 20;
    if (input.startingRate !== undefined && input.startingRate !== null) completionScore += 20;
    if (input.categoryIds && input.categoryIds.length > 0) completionScore += 20;

    const id = generateUuidV7();
    const updated = await this.repo.upsertCreatorProfile(
      userId,
      {
        tagline: input.tagline ?? null,
        bio: input.bio ?? null,
        locationCountry: input.locationCountry ?? null,
        locationCity: input.locationCity ?? null,
        isRemote: input.isRemote ?? true,
        startingRate: input.startingRate ?? null,
        currency: input.currency || 'INR',
        visibility: input.visibility || 'PUBLIC',
        socialLinks: input.socialLinks ? JSON.parse(JSON.stringify(input.socialLinks)) : undefined,
        completionScore,
      },
      {
        id,
        userId,
        tagline: input.tagline ?? null,
        bio: input.bio ?? null,
        locationCountry: input.locationCountry ?? null,
        locationCity: input.locationCity ?? null,
        isRemote: input.isRemote ?? true,
        startingRate: input.startingRate ?? null,
        currency: input.currency || 'INR',
        visibility: input.visibility || 'PUBLIC',
        socialLinks: input.socialLinks ? JSON.parse(JSON.stringify(input.socialLinks)) : undefined,
        completionScore,
      },
      input.categoryIds,
    );

    return this.mapCreatorProfile(updated!);
  }

  // ==============================================================================
  // Professional Profile
  // ==============================================================================

  async getProfessionalProfile(
    idOrUserId: string,
    callerId?: string,
    isAdmin = false,
  ): Promise<ProfessionalProfileResponse> {
    let profile = await this.repo.findProfessionalProfileById(idOrUserId);
    if (!profile) {
      profile = await this.repo.findProfessionalProfileByUserId(idOrUserId);
    }

    if (!profile || profile.deletedAt || profile.user.status !== 'ACTIVE') {
      throw new NotFoundError('Professional profile not found.');
    }

    if (profile.visibility === 'PRIVATE' && profile.userId !== callerId && !isAdmin) {
      throw new ForbiddenError('This professional profile is private.');
    }

    return this.mapProfessionalProfile(profile);
  }

  async updateProfessionalProfile(
    userId: string,
    roles: string[],
    input: UpdateProfessionalProfileInput,
  ): Promise<ProfessionalProfileResponse> {
    if (!roles.includes('PROFESSIONAL')) {
      throw new AuthInsufficientRoleError('User does not have PROFESSIONAL role.');
    }

    const id = generateUuidV7();
    const updated = await this.repo.upsertProfessionalProfile(
      userId,
      {
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        yearsExperience: input.yearsExperience ?? null,
        dayRate: input.dayRate ?? null,
        currency: input.currency || 'INR',
        isAvailable: input.isAvailable ?? true,
        visibility: input.visibility || 'PUBLIC',
        locationCountry: input.locationCountry ?? null,
        locationCity: input.locationCity ?? null,
        equipmentList: input.equipmentList || [],
      },
      {
        id,
        userId,
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        yearsExperience: input.yearsExperience ?? null,
        dayRate: input.dayRate ?? null,
        currency: input.currency || 'INR',
        isAvailable: input.isAvailable ?? true,
        visibility: input.visibility || 'PUBLIC',
        locationCountry: input.locationCountry ?? null,
        locationCity: input.locationCity ?? null,
        equipmentList: input.equipmentList || [],
      },
    );

    return this.mapProfessionalProfile(updated);
  }

  // ==============================================================================
  // Brand Profile
  // ==============================================================================

  async getBrandProfile(
    idOrUserId: string,
    callerId?: string,
    isAdmin = false,
  ): Promise<BrandProfileResponse> {
    let profile = await this.repo.findBrandProfileById(idOrUserId);
    if (!profile) {
      profile = await this.repo.findBrandProfileByUserId(idOrUserId);
    }

    if (!profile || profile.deletedAt || profile.user.status !== 'ACTIVE') {
      throw new NotFoundError('Brand profile not found.');
    }

    if (profile.visibility === 'PRIVATE' && profile.userId !== callerId && !isAdmin) {
      throw new ForbiddenError('This brand profile is private.');
    }

    return this.mapBrandProfile(profile);
  }

  async updateBrandProfile(
    userId: string,
    roles: string[],
    input: UpdateBrandProfileInput,
  ): Promise<BrandProfileResponse> {
    if (!roles.includes('BRAND')) {
      throw new AuthInsufficientRoleError('User does not have BRAND role.');
    }

    const id = generateUuidV7();
    const updated = await this.repo.upsertBrandProfile(
      userId,
      {
        companyName: input.companyName,
        industry: input.industry ?? null,
        websiteUrl: input.websiteUrl ?? null,
        companySize: input.companySize ?? null,
        bio: input.bio ?? null,
        visibility: input.visibility || 'PUBLIC',
      },
      {
        id,
        userId,
        companyName: input.companyName,
        industry: input.industry ?? null,
        websiteUrl: input.websiteUrl ?? null,
        companySize: input.companySize ?? null,
        bio: input.bio ?? null,
        visibility: input.visibility || 'PUBLIC',
      },
    );

    return this.mapBrandProfile(updated);
  }

  // ==============================================================================
  // Podcaster Profile
  // ==============================================================================

  async getPodcasterProfile(
    idOrUserId: string,
    callerId?: string,
    isAdmin = false,
  ): Promise<PodcasterProfileResponse> {
    let profile = await this.repo.findPodcasterProfileById(idOrUserId);
    if (!profile) {
      profile = await this.repo.findPodcasterProfileByUserId(idOrUserId);
    }

    if (!profile || profile.deletedAt || profile.user.status !== 'ACTIVE') {
      throw new NotFoundError('Podcaster profile not found.');
    }

    if (profile.visibility === 'PRIVATE' && profile.userId !== callerId && !isAdmin) {
      throw new ForbiddenError('This podcaster profile is private.');
    }

    return this.mapPodcasterProfile(profile);
  }

  async updatePodcasterProfile(
    userId: string,
    roles: string[],
    input: UpdatePodcasterProfileInput,
  ): Promise<PodcasterProfileResponse> {
    if (!roles.includes('PODCASTER')) {
      throw new AuthInsufficientRoleError('User does not have PODCASTER role.');
    }

    const id = generateUuidV7();
    const updated = await this.repo.upsertPodcasterProfile(
      userId,
      {
        podcastName: input.podcastName,
        description: input.description ?? null,
        rssFeedUrl: input.rssFeedUrl ?? null,
        guestGuidelines: input.guestGuidelines ?? null,
        visibility: input.visibility || 'PUBLIC',
      },
      {
        id,
        userId,
        podcastName: input.podcastName,
        description: input.description ?? null,
        rssFeedUrl: input.rssFeedUrl ?? null,
        guestGuidelines: input.guestGuidelines ?? null,
        visibility: input.visibility || 'PUBLIC',
      },
    );

    return this.mapPodcasterProfile(updated);
  }

  // ==============================================================================
  // User Skills & Taxonomy
  // ==============================================================================

  async getUserSkills(userId: string): Promise<UserSkillResponse[]> {
    const userSkills = await this.repo.findUserSkills(userId);
    return userSkills.map((us) => ({
      id: us.id,
      skillId: us.skillId,
      name: us.skill.name,
      slug: us.skill.slug,
      proficiency: us.proficiency as any,
      createdAt: us.createdAt.toISOString(),
    }));
  }

  async updateUserSkills(
    userId: string,
    input: UpdateUserSkillsInput,
  ): Promise<UserSkillResponse[]> {
    if (input.skills.length > 0) {
      const skillIds = input.skills.map((s) => s.skillId);
      const activeSkills = await this.repo.findActiveSkillsByIds(skillIds);
      if (activeSkills.length !== skillIds.length) {
        throw new InactiveTaxonomyError('One or more selected skills are inactive or invalid.');
      }
    }

    const records = input.skills.map((s) => ({
      id: generateUuidV7(),
      skillId: s.skillId,
      proficiency: s.proficiency || 'INTERMEDIATE',
    }));

    const updated = await this.repo.replaceUserSkills(userId, records);
    return updated.map((us) => ({
      id: us.id,
      skillId: us.skillId,
      name: us.skill.name,
      slug: us.skill.slug,
      proficiency: us.proficiency as any,
      createdAt: us.createdAt.toISOString(),
    }));
  }

  async getActiveCategories(): Promise<CategoryResponse[]> {
    const categories = await this.repo.findAllActiveCategories();
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async getActiveSkills(): Promise<SkillResponse[]> {
    const skills = await this.repo.findAllActiveSkills();
    return skills.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  // ==============================================================================
  // Aggregated Me Profiles
  // ==============================================================================

  async getMeProfiles(userId: string) {
    const [creator, professional, brand, podcaster, skills] = await Promise.all([
      this.repo.findCreatorProfileByUserId(userId),
      this.repo.findProfessionalProfileByUserId(userId),
      this.repo.findBrandProfileByUserId(userId),
      this.repo.findPodcasterProfileByUserId(userId),
      this.getUserSkills(userId),
    ]);

    return {
      creator: creator && !creator.deletedAt ? this.mapCreatorProfile(creator) : null,
      professional:
        professional && !professional.deletedAt ? this.mapProfessionalProfile(professional) : null,
      brand: brand && !brand.deletedAt ? this.mapBrandProfile(brand) : null,
      podcaster: podcaster && !podcaster.deletedAt ? this.mapPodcasterProfile(podcaster) : null,
      skills,
    };
  }

  // ==============================================================================
  // Mappers
  // ==============================================================================

  private mapCreatorProfile(profile: any): CreatorProfileResponse {
    return {
      id: profile.id,
      userId: profile.userId,
      tagline: profile.tagline,
      bio: profile.bio,
      locationCountry: profile.locationCountry,
      locationCity: profile.locationCity,
      isRemote: profile.isRemote,
      startingRate: profile.startingRate,
      currency: profile.currency,
      visibility: profile.visibility,
      isVerified: profile.isVerified,
      socialLinks: profile.socialLinks,
      completionScore: profile.completionScore,
      categories: (profile.categories || []).map((c: any) => ({
        id: c.category?.id || c.categoryId,
        slug: c.category?.slug || '',
        name: c.category?.name || '',
      })),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapProfessionalProfile(profile: any): ProfessionalProfileResponse {
    return {
      id: profile.id,
      userId: profile.userId,
      headline: profile.headline,
      bio: profile.bio,
      yearsExperience: profile.yearsExperience,
      dayRate: profile.dayRate,
      currency: profile.currency,
      isAvailable: profile.isAvailable,
      visibility: profile.visibility,
      locationCountry: profile.locationCountry,
      locationCity: profile.locationCity,
      equipmentList: profile.equipmentList || [],
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapBrandProfile(profile: any): BrandProfileResponse {
    return {
      id: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
      industry: profile.industry,
      websiteUrl: profile.websiteUrl,
      companySize: profile.companySize,
      bio: profile.bio,
      isVerified: profile.isVerified,
      visibility: profile.visibility,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapPodcasterProfile(profile: any): PodcasterProfileResponse {
    return {
      id: profile.id,
      userId: profile.userId,
      podcastName: profile.podcastName,
      description: profile.description,
      rssFeedUrl: profile.rssFeedUrl,
      guestGuidelines: profile.guestGuidelines,
      visibility: profile.visibility,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}

export const profilesService = new ProfilesService();
