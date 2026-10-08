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

    const existing = await this.repo.findCreatorProfileByUserId(userId);

    // Compute completion score based on merged fields (PATCH semantics)
    const mergedTagline = input.tagline !== undefined ? input.tagline : existing?.tagline;
    const mergedBio = input.bio !== undefined ? input.bio : existing?.bio;
    const mergedCountry =
      input.locationCountry !== undefined ? input.locationCountry : existing?.locationCountry;
    const mergedCity =
      input.locationCity !== undefined ? input.locationCity : existing?.locationCity;
    const mergedStartingRate =
      input.startingRate !== undefined ? input.startingRate : existing?.startingRate;
    const hasCategories =
      input.categoryIds !== undefined
        ? input.categoryIds.length > 0
        : (existing?.categories?.length ?? 0) > 0;

    let completionScore = 0;
    if (mergedTagline) completionScore += 20;
    if (mergedBio) completionScore += 20;
    if (mergedCountry && mergedCity) completionScore += 20;
    if (mergedStartingRate !== undefined && mergedStartingRate !== null) completionScore += 20;
    if (hasCategories) completionScore += 20;

    // PATCH semantics: only update fields explicitly passed in the request
    const updateData: any = { completionScore };
    if (input.tagline !== undefined) updateData.tagline = input.tagline;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.locationCountry !== undefined) updateData.locationCountry = input.locationCountry;
    if (input.locationCity !== undefined) updateData.locationCity = input.locationCity;
    if (input.isRemote !== undefined) updateData.isRemote = input.isRemote;
    if (input.startingRate !== undefined) updateData.startingRate = input.startingRate;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.socialLinks !== undefined) {
      updateData.socialLinks = input.socialLinks
        ? JSON.parse(JSON.stringify(input.socialLinks))
        : null;
    }

    const id = generateUuidV7();
    const createData = {
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
    };

    const updated = await this.repo.upsertCreatorProfile(
      userId,
      updateData,
      createData,
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

    // PATCH semantics: only update fields explicitly passed in the request
    const updateData: any = {};
    if (input.headline !== undefined) updateData.headline = input.headline;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.yearsExperience !== undefined) updateData.yearsExperience = input.yearsExperience;
    if (input.dayRate !== undefined) updateData.dayRate = input.dayRate;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.isAvailable !== undefined) updateData.isAvailable = input.isAvailable;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.locationCountry !== undefined) updateData.locationCountry = input.locationCountry;
    if (input.locationCity !== undefined) updateData.locationCity = input.locationCity;
    if (input.equipmentList !== undefined) updateData.equipmentList = input.equipmentList;

    const id = generateUuidV7();
    const createData = {
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
    };

    const updated = await this.repo.upsertProfessionalProfile(userId, updateData, createData);

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

    // PATCH semantics: only update fields explicitly passed in the request
    const updateData: any = {};
    if (input.companyName !== undefined) updateData.companyName = input.companyName;
    if (input.industry !== undefined) updateData.industry = input.industry;
    if (input.websiteUrl !== undefined) updateData.websiteUrl = input.websiteUrl;
    if (input.companySize !== undefined) updateData.companySize = input.companySize;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;

    const id = generateUuidV7();
    const createData = {
      id,
      userId,
      companyName: input.companyName,
      industry: input.industry ?? null,
      websiteUrl: input.websiteUrl ?? null,
      companySize: input.companySize ?? null,
      bio: input.bio ?? null,
      visibility: input.visibility || 'PUBLIC',
    };

    const updated = await this.repo.upsertBrandProfile(userId, updateData, createData);

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

    // PATCH semantics: only update fields explicitly passed in the request
    const updateData: any = {};
    if (input.podcastName !== undefined) updateData.podcastName = input.podcastName;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.rssFeedUrl !== undefined) updateData.rssFeedUrl = input.rssFeedUrl;
    if (input.guestGuidelines !== undefined) updateData.guestGuidelines = input.guestGuidelines;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;

    const id = generateUuidV7();
    const createData = {
      id,
      userId,
      podcastName: input.podcastName,
      description: input.description ?? null,
      rssFeedUrl: input.rssFeedUrl ?? null,
      guestGuidelines: input.guestGuidelines ?? null,
      visibility: input.visibility || 'PUBLIC',
    };

    const updated = await this.repo.upsertPodcasterProfile(userId, updateData, createData);

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
