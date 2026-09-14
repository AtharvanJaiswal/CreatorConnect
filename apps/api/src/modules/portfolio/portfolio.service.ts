import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  CreatePortfolioItemInput,
  UpdatePortfolioItemInput,
  AttachPortfolioMediaInput,
  ReorderPortfolioMediaInput,
  PortfolioItemResponse,
  PortfolioMediaResponse,
} from '@creatorconnect/contracts';
import { portfolioRepository, PortfolioRepository } from './portfolio.repository.js';
import { mediaRepository, MediaRepository } from '../media/media.repository.js';
import { mediaService, MediaService } from '../media/media.service.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AuthInsufficientRoleError,
  InvalidMediaStateError,
} from '../../errors/app-error.js';

export class PortfolioService {
  constructor(
    private repo: PortfolioRepository = portfolioRepository,
    private mediaRepo: MediaRepository = mediaRepository,
    private mediaSvc: MediaService = mediaService,
  ) {}

  async createItem(
    userId: string,
    roles: string[],
    input: CreatePortfolioItemInput,
  ): Promise<PortfolioItemResponse> {
    if (!roles.includes('CREATOR') && !roles.includes('PROFESSIONAL')) {
      throw new AuthInsufficientRoleError(
        'User must have CREATOR or PROFESSIONAL role to manage portfolio.',
      );
    }

    const id = generateUuidV7();
    const item = await this.repo.createItem({
      id,
      userId,
      title: input.title,
      description: input.description ?? null,
      externalUrl: input.externalUrl ?? null,
      displayOrder: input.displayOrder ?? 0,
      visibility: input.visibility || 'PUBLIC',
      tags: input.tags || [],
    });

    return this.mapPortfolioItem(item);
  }

  async getItem(id: string, callerId?: string, isAdmin = false): Promise<PortfolioItemResponse> {
    const item = await this.repo.findItemById(id);
    if (!item || item.deletedAt) {
      throw new NotFoundError('Portfolio item not found.');
    }

    if (item.visibility === 'PRIVATE' && item.userId !== callerId && !isAdmin) {
      throw new ForbiddenError('This portfolio item is private.');
    }

    return this.mapPortfolioItem(item);
  }

  async getUserItems(
    userId: string,
    callerId?: string,
    isAdmin = false,
  ): Promise<PortfolioItemResponse[]> {
    const items = await this.repo.findItemsByUserId(userId);
    const visible = items.filter((item) => {
      if (item.visibility === 'PUBLIC' || item.visibility === 'UNLISTED') return true;
      return item.userId === callerId || isAdmin;
    });

    return Promise.all(visible.map((item) => this.mapPortfolioItem(item)));
  }

  async updateItem(
    userId: string,
    id: string,
    input: UpdatePortfolioItemInput,
  ): Promise<PortfolioItemResponse> {
    const item = await this.repo.findItemById(id);
    if (!item || item.deletedAt) {
      throw new NotFoundError('Portfolio item not found.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenError('You do not own this portfolio item.');
    }

    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.externalUrl !== undefined) data.externalUrl = input.externalUrl ?? null;
    if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.tags !== undefined) data.tags = input.tags;

    const updated = await this.repo.updateItem(id, data);
    return this.mapPortfolioItem(updated);
  }

  async deleteItem(userId: string, id: string): Promise<void> {
    const item = await this.repo.findItemById(id);
    if (!item || item.deletedAt) {
      throw new NotFoundError('Portfolio item not found.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenError('You do not own this portfolio item.');
    }

    await this.repo.softDeleteItem(id);
  }

  async attachMedia(
    userId: string,
    portfolioItemId: string,
    input: AttachPortfolioMediaInput,
  ): Promise<PortfolioMediaResponse> {
    const item = await this.repo.findItemById(portfolioItemId);
    if (!item || item.deletedAt) {
      throw new NotFoundError('Portfolio item not found.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenError('You do not own this portfolio item.');
    }

    const mediaAsset = await this.mediaRepo.findById(input.mediaAssetId);
    if (!mediaAsset) {
      throw new NotFoundError('Media asset not found.');
    }

    if (mediaAsset.userId !== userId) {
      throw new ForbiddenError('You do not own this media asset.');
    }

    if (mediaAsset.status !== 'ACTIVE') {
      throw new InvalidMediaStateError(
        `Only ACTIVE media assets can be attached to portfolio items (current status: ${mediaAsset.status}).`,
      );
    }

    try {
      const pmId = generateUuidV7();
      const attached = await this.repo.attachMedia({
        id: pmId,
        portfolioItemId,
        mediaAssetId: input.mediaAssetId,
        displayOrder: input.displayOrder ?? 0,
        caption: input.caption ?? null,
      });

      const assetResponse = await this.mediaSvc.mapToResponse(attached.mediaAsset);
      return {
        id: attached.id,
        mediaAssetId: attached.mediaAssetId,
        displayOrder: attached.displayOrder,
        caption: attached.caption,
        mediaAsset: assetResponse,
        createdAt: attached.createdAt.toISOString(),
      };
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictError('This media asset is already attached to the portfolio item.');
      }
      throw err;
    }
  }

  async reorderMedia(
    userId: string,
    portfolioItemId: string,
    input: ReorderPortfolioMediaInput,
  ): Promise<void> {
    const item = await this.repo.findItemById(portfolioItemId);
    if (!item || item.deletedAt) {
      throw new NotFoundError('Portfolio item not found.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenError('You do not own this portfolio item.');
    }

    await this.repo.reorderMedia(input.items);
  }

  private async mapPortfolioItem(item: any): Promise<PortfolioItemResponse> {
    const mediaResponses: PortfolioMediaResponse[] = await Promise.all(
      (item.media || []).map(async (pm: any) => ({
        id: pm.id,
        mediaAssetId: pm.mediaAssetId,
        displayOrder: pm.displayOrder,
        caption: pm.caption,
        mediaAsset: await this.mediaSvc.mapToResponse(pm.mediaAsset),
        createdAt: pm.createdAt.toISOString(),
      })),
    );

    return {
      id: item.id,
      userId: item.userId,
      title: item.title,
      description: item.description,
      externalUrl: item.externalUrl,
      displayOrder: item.displayOrder,
      visibility: item.visibility,
      tags: item.tags || [],
      media: mediaResponses,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export const portfolioService = new PortfolioService();
