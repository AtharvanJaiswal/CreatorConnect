import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
  AssignmentResponse,
} from '@creatorconnect/contracts';
import { assignmentsRepository, AssignmentsRepository } from './assignments.repository.js';
import { profilesRepository, ProfilesRepository } from '../profiles/profiles.repository.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  OptimisticLockConflictError,
  AuthInsufficientRoleError,
  InactiveTaxonomyError,
} from '../../errors/app-error.js';

export class AssignmentsService {
  constructor(
    private repo: AssignmentsRepository = assignmentsRepository,
    private profilesRepo: ProfilesRepository = profilesRepository,
  ) {}

  async createAssignment(
    userId: string,
    roles: string[],
    input: CreateAssignmentInput,
  ): Promise<AssignmentResponse> {
    if (!roles.includes('BRAND')) {
      throw new AuthInsufficientRoleError('Only users with the BRAND role can create assignments.');
    }

    const brandProfile = await this.profilesRepo.findBrandProfileByUserId(userId);
    if (!brandProfile) {
      throw new ForbiddenError('You must set up a Brand Profile before creating assignments.');
    }

    if (input.budgetMax < input.budgetMin) {
      throw new BadRequestError('Maximum budget cannot be less than minimum budget.');
    }

    const deadlineDate = new Date(input.deadline);
    if (deadlineDate <= new Date()) {
      throw new BadRequestError('Assignment deadline must be in the future.');
    }

    if (input.categoryId) {
      const categories = await this.profilesRepo.findActiveCategoriesByIds([input.categoryId]);
      if (categories.length === 0) {
        throw new InactiveTaxonomyError('The selected assignment category is inactive or invalid.');
      }
    }

    const id = generateUuidV7();
    const requirements = (input.requirements || []).map((r) => ({
      id: generateUuidV7(),
      title: r.title,
      isMandatory: r.isMandatory ?? true,
    }));

    const assignment = await this.repo.create(
      {
        id,
        brandId: brandProfile.id,
        categoryId: input.categoryId ?? null,
        title: input.title,
        description: input.description,
        budgetType: input.budgetType || 'FIXED',
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        currency: input.currency || 'INR',
        deadline: deadlineDate,
        isRemote: input.isRemote ?? true,
        location: input.location ?? null,
        status: 'PUBLISHED',
      },
      requirements,
    );

    return this.mapAssignment(assignment);
  }

  async getAssignment(id: string, callerId?: string, isAdmin = false): Promise<AssignmentResponse> {
    const assignment = await this.repo.findById(id);
    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.status === 'DRAFT' && assignment.brand.userId !== callerId && !isAdmin) {
      throw new NotFoundError('Assignment not found.');
    }

    return this.mapAssignment(assignment);
  }

  async getBrandAssignments(userId: string): Promise<AssignmentResponse[]> {
    const brandProfile = await this.profilesRepo.findBrandProfileByUserId(userId);
    if (!brandProfile) {
      return [];
    }

    const assignments = await this.repo.findByBrandId(brandProfile.id);
    return assignments.map((a) => this.mapAssignment(a));
  }

  async updateAssignment(
    userId: string,
    id: string,
    input: UpdateAssignmentInput,
  ): Promise<AssignmentResponse> {
    const assignment = await this.repo.findById(id);
    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.brand.userId !== userId) {
      throw new ForbiddenError('You do not own this assignment.');
    }

    if (input.budgetMin !== undefined && input.budgetMax !== undefined) {
      if (input.budgetMax < input.budgetMin) {
        throw new BadRequestError('Maximum budget cannot be less than minimum budget.');
      }
    } else if (input.budgetMin !== undefined && input.budgetMin > assignment.budgetMax) {
      throw new BadRequestError('Minimum budget cannot exceed existing maximum budget.');
    } else if (input.budgetMax !== undefined && input.budgetMax < assignment.budgetMin) {
      throw new BadRequestError('Maximum budget cannot be less than existing minimum budget.');
    }

    if (input.deadline) {
      const deadlineDate = new Date(input.deadline);
      if (deadlineDate <= new Date()) {
        throw new BadRequestError('Assignment deadline must be in the future.');
      }
    }

    if (input.categoryId) {
      const categories = await this.profilesRepo.findActiveCategoriesByIds([input.categoryId]);
      if (categories.length === 0) {
        throw new InactiveTaxonomyError('The selected category is inactive or invalid.');
      }
    }

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId ?? null;
    if (input.budgetType !== undefined) updateData.budgetType = input.budgetType;
    if (input.budgetMin !== undefined) updateData.budgetMin = input.budgetMin;
    if (input.budgetMax !== undefined) updateData.budgetMax = input.budgetMax;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.deadline !== undefined) updateData.deadline = new Date(input.deadline);
    if (input.isRemote !== undefined) updateData.isRemote = input.isRemote;
    if (input.location !== undefined) updateData.location = input.location ?? null;

    const count = await this.repo.updateOptimistic(id, input.version, updateData);

    if (count === 0) {
      throw new OptimisticLockConflictError(
        'Assignment was modified concurrently. Please reload the latest version and retry.',
      );
    }

    const updated = (await this.repo.findById(id))!;
    return this.mapAssignment(updated);
  }

  async publishAssignment(
    userId: string,
    id: string,
    version: number,
  ): Promise<AssignmentResponse> {
    const assignment = await this.repo.findById(id);
    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.brand.userId !== userId) {
      throw new ForbiddenError('You do not own this assignment.');
    }

    const count = await this.repo.updateStatusOptimistic(id, version, 'PUBLISHED');
    if (count === 0) {
      throw new OptimisticLockConflictError(
        'Assignment was modified concurrently. Please reload and retry.',
      );
    }

    const updated = (await this.repo.findById(id))!;
    return this.mapAssignment(updated);
  }

  async closeAssignment(userId: string, id: string, version: number): Promise<AssignmentResponse> {
    const assignment = await this.repo.findById(id);
    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.brand.userId !== userId) {
      throw new ForbiddenError('You do not own this assignment.');
    }

    const count = await this.repo.updateStatusOptimistic(id, version, 'CLOSED');
    if (count === 0) {
      throw new OptimisticLockConflictError(
        'Assignment was modified concurrently. Please reload and retry.',
      );
    }

    const updated = (await this.repo.findById(id))!;
    return this.mapAssignment(updated);
  }

  async deleteAssignment(userId: string, id: string): Promise<void> {
    const assignment = await this.repo.findById(id);
    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.brand.userId !== userId) {
      throw new ForbiddenError('You do not own this assignment.');
    }

    await this.repo.softDelete(id);
  }

  mapAssignment(a: any): AssignmentResponse {
    const createdAt = a.createdAt || a.created_at;
    const updatedAt = a.updatedAt || a.updated_at;
    const deadline = a.deadline;

    return {
      id: a.id,
      brandId: a.brandId || a.brand_id,
      categoryId: a.categoryId ?? a.category_id ?? null,
      title: a.title,
      description: a.description,
      budgetType: a.budgetType || a.budget_type,
      budgetMin: a.budgetMin ?? a.budget_min,
      budgetMax: a.budgetMax ?? a.budget_max,
      currency: a.currency,
      deadline:
        deadline instanceof Date ? deadline.toISOString() : new Date(deadline).toISOString(),
      isRemote: a.isRemote ?? a.is_remote ?? true,
      location: a.location ?? null,
      status: a.status,
      version: a.version,
      requirements: (a.requirements || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        isMandatory: r.isMandatory ?? r.is_mandatory ?? true,
        createdAt:
          (r.createdAt || r.created_at) instanceof Date
            ? (r.createdAt || r.created_at).toISOString()
            : new Date(r.createdAt || r.created_at).toISOString(),
      })),
      createdAt:
        createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString(),
      updatedAt:
        updatedAt instanceof Date ? updatedAt.toISOString() : new Date(updatedAt).toISOString(),
    };
  }
}

export const assignmentsService = new AssignmentsService();
