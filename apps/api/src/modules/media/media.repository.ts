import {
  getPrismaClient,
  type MediaAsset,
  type MediaAssetStatus,
  type Prisma,
} from '@creatorconnect/database';

export class MediaRepository {
  constructor(private prisma = getPrismaClient()) {}

  async create(data: Prisma.MediaAssetUncheckedCreateInput): Promise<MediaAsset> {
    return this.prisma.mediaAsset.create({ data });
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({ where: { id } });
  }

  async findByIdWithParents(id: string) {
    return this.prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            creatorProfile: { select: { deletedAt: true } },
          },
        },
        portfolioMedia: {
          include: {
            portfolioItem: {
              select: {
                id: true,
                userId: true,
                visibility: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async findByStorageKey(storageKey: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({ where: { storageKey } });
  }

  async updateStatusCAS(
    id: string,
    fromStatus: MediaAssetStatus,
    toStatus: MediaAssetStatus,
  ): Promise<number> {
    const res = await this.prisma.mediaAsset.updateMany({
      where: { id, status: fromStatus },
      data: { status: toStatus },
    });
    return res.count;
  }

  async update(id: string, data: Prisma.MediaAssetUpdateInput): Promise<MediaAsset> {
    return this.prisma.mediaAsset.update({ where: { id }, data });
  }

  async findExpiredQuarantined(now: Date, limit = 100): Promise<MediaAsset[]> {
    return this.prisma.mediaAsset.findMany({
      where: {
        status: 'QUARANTINED',
        expiresAt: { lt: now },
      },
      take: limit,
    });
  }
}

export const mediaRepository = new MediaRepository();
