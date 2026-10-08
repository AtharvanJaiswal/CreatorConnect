import { getPrismaClient, type Prisma } from '@creatorconnect/database';
import { ForbiddenError } from '../../errors/app-error.js';

export class PortfolioRepository {
  constructor(private prisma = getPrismaClient()) {}

  async createItem(data: Prisma.PortfolioItemUncheckedCreateInput) {
    return this.prisma.portfolioItem.create({
      data,
      include: {
        media: {
          include: { mediaAsset: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async findItemById(id: string) {
    return this.prisma.portfolioItem.findUnique({
      where: { id },
      include: {
        media: {
          include: { mediaAsset: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async findItemsByUserId(userId: string) {
    return this.prisma.portfolioItem.findMany({
      where: { userId, deletedAt: null },
      include: {
        media: {
          include: { mediaAsset: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async updateItem(id: string, data: Prisma.PortfolioItemUpdateInput) {
    return this.prisma.portfolioItem.update({
      where: { id },
      data,
      include: {
        media: {
          include: { mediaAsset: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async softDeleteItem(id: string) {
    return this.prisma.portfolioItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async attachMedia(data: Prisma.PortfolioMediaUncheckedCreateInput) {
    return this.prisma.portfolioMedia.create({
      data,
      include: { mediaAsset: true },
    });
  }

  async detachMedia(portfolioItemId: string, mediaAssetId: string) {
    return this.prisma.portfolioMedia.delete({
      where: {
        portfolioItemId_mediaAssetId: {
          portfolioItemId,
          mediaAssetId,
        },
      },
    });
  }

  async reorderMedia(portfolioItemId: string, items: Array<{ id: string; displayOrder: number }>) {
    return this.prisma.$transaction(async (tx) => {
      if (items.length === 0) return;

      // 1. Strict ownership verification: all submitted IDs must belong to portfolioItemId
      const itemIds = items.map((i) => i.id);
      const ownedLinks = await tx.portfolioMedia.findMany({
        where: {
          id: { in: itemIds },
          portfolioItemId,
        },
        select: { id: true },
      });

      if (ownedLinks.length !== items.length) {
        throw new ForbiddenError(
          'One or more media items do not belong to the authorized portfolio item.',
        );
      }

      // 2. Perform scoped conditional updates where portfolioItemId is enforced in DB predicate
      for (const item of items) {
        const updateRes = await tx.portfolioMedia.updateMany({
          where: {
            id: item.id,
            portfolioItemId,
          },
          data: { displayOrder: item.displayOrder },
        });

        if (updateRes.count !== 1) {
          throw new ForbiddenError(
            'Failed to update media item order: item not found or does not belong to this portfolio.',
          );
        }
      }
    });
  }
}

export const portfolioRepository = new PortfolioRepository();
