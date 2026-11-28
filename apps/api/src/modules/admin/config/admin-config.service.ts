import { type PrismaClient, getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  PlatformSettingResponse,
  UpdatePlatformSettingRequest,
  PlatformSettingAuditResponse,
  RollbackPlatformSettingRequest,
} from '@creatorconnect/contracts';
import { NotFoundError, BadRequestError } from '../../../errors/app-error.js';

export class AdminConfigService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public async listSettings(): Promise<PlatformSettingResponse[]> {
    const settings = await this.prisma.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      id: s.id,
      key: s.key,
      value: s.value,
      description: s.description,
      isEncrypted: s.isEncrypted,
      isSystem: s.isSystem,
      version: s.version,
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  public async getSetting(key: string): Promise<PlatformSettingResponse> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundError(`Platform setting not found: ${key}`);
    }

    return {
      id: setting.id,
      key: setting.key,
      value: setting.value,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
      isSystem: setting.isSystem,
      version: setting.version,
      updatedAt: setting.updatedAt.toISOString(),
    };
  }

  public async updateSetting(
    key: string,
    input: UpdatePlatformSettingRequest,
    adminUserId: string,
  ): Promise<PlatformSettingResponse> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundError(`Platform setting not found: ${key}`);
    }

    const nextVersion = setting.version + 1;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Audit previous value
      await tx.platformSettingAudit.create({
        data: {
          id: generateUuidV7(),
          settingId: setting.id,
          key: setting.key,
          previousValue: setting.value as any,
          newValue: input.value as any,
          version: nextVersion,
          changedById: adminUserId,
          reason: input.reason,
        },
      });

      // 2. Update setting
      const updated = await tx.platformSetting.update({
        where: { key },
        data: {
          value: input.value,
          version: nextVersion,
          updatedById: adminUserId,
        },
      });

      // 3. Immutable audit log
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: adminUserId,
          action: 'PLATFORM_SETTING_UPDATED',
          entity: 'PlatformSetting',
          entityId: setting.id,
          metadata: {
            key,
            previousValue: setting.value,
            newValue: input.value,
            version: nextVersion,
            reason: input.reason,
          },
        },
      });

      return {
        id: updated.id,
        key: updated.key,
        value: updated.value,
        description: updated.description,
        isEncrypted: updated.isEncrypted,
        isSystem: updated.isSystem,
        version: updated.version,
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  public async getSettingHistory(key: string): Promise<PlatformSettingAuditResponse[]> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundError(`Platform setting not found: ${key}`);
    }

    const audits = await this.prisma.platformSettingAudit.findMany({
      where: { settingId: setting.id },
      orderBy: { createdAt: 'desc' },
    });

    return audits.map((a) => ({
      id: a.id,
      key: a.key,
      previousValue: a.previousValue,
      newValue: a.newValue,
      version: a.version,
      changedById: a.changedById,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  public async rollbackSetting(
    key: string,
    input: RollbackPlatformSettingRequest,
    adminUserId: string,
  ): Promise<PlatformSettingResponse> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundError(`Platform setting not found: ${key}`);
    }

    // Find the historical value for the target version
    let targetValue: any = null;

    if (input.targetVersion === setting.version) {
      throw new BadRequestError(`Setting is already at version ${setting.version}.`);
    }

    const auditRecord = await this.prisma.platformSettingAudit.findFirst({
      where: {
        settingId: setting.id,
        version: input.targetVersion,
      },
    });

    if (auditRecord) {
      targetValue = auditRecord.newValue;
    } else {
      // Look for the audit record where previousValue was from targetVersion
      const laterAudit = await this.prisma.platformSettingAudit.findFirst({
        where: {
          settingId: setting.id,
          version: input.targetVersion + 1,
        },
      });
      if (laterAudit) {
        targetValue = laterAudit.previousValue;
      } else {
        throw new NotFoundError(
          `Historical value for setting ${key} at version ${input.targetVersion} not found.`,
        );
      }
    }

    const rollbackReason = `[Rollback to v${input.targetVersion}]: ${input.reason}`;
    return await this.updateSetting(
      key,
      { value: targetValue, reason: rollbackReason },
      adminUserId,
    );
  }
}

export const adminConfigService = new AdminConfigService();
