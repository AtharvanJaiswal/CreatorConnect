import { getPrismaClient, type Prisma } from '@creatorconnect/database';

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

  async reorderMedia(items: Array<{ id: string; displayOrder: number }>) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.portfolioMedia.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        });
      }
    });
  }
}

export const portfolioRepository = new PortfolioRepository();
