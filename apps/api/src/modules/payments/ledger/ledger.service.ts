import { getPrismaClient, Prisma } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  LedgerAccountType,
  LedgerEntryDirection,
  LedgerTransactionResponse,
  LedgerAccountResponse,
} from '@creatorconnect/contracts';
import {
  UnbalancedLedgerEntryError,
  InvalidLedgerAmountError,
  NotFoundError,
} from '../../../errors/app-error.js';

export interface PostLedgerEntryParam {
  accountCode: string;
  accountName?: string | undefined;
  accountType: LedgerAccountType;
  direction: LedgerEntryDirection;
  amount: number; // Integer minor units (paisa)
  currency?: string | undefined;
  userId?: string | undefined;
  projectId?: string | undefined;
}

export interface PostTransactionParams {
  paymentIntentId?: string | undefined;
  type: string;
  description?: string | undefined;
  entries: PostLedgerEntryParam[];
}

export class LedgerService {
  constructor(private prisma = getPrismaClient()) {}

  /**
   * Posts an immutable, balanced multi-entry ledger transaction.
   * Invariant 1: Total Debits == Total Credits.
   * Invariant 2: Each amount must be an integer > 0.
   * Invariant 3: Currency uniformity across all entries.
   */
  async postTransaction(
    params: PostTransactionParams,
    externalTx?: Prisma.TransactionClient,
  ): Promise<LedgerTransactionResponse> {
    if (!params.entries || params.entries.length < 2) {
      throw new UnbalancedLedgerEntryError(
        'A ledger transaction must contain at least two balanced entries (double-entry accounting).',
      );
    }

    let totalDebits = 0;
    let totalCredits = 0;
    const currency = params.entries[0]?.currency || 'INR';

    for (const entry of params.entries) {
      if (!Number.isInteger(entry.amount) || entry.amount <= 0) {
        throw new InvalidLedgerAmountError(
          `Entry amount ${entry.amount} is invalid. Amounts must be positive integer minor units.`,
        );
      }

      if (entry.currency && entry.currency !== currency) {
        throw new UnbalancedLedgerEntryError(
          `Cross-currency transactions are not supported within a single journal entry. Expected '${currency}', received '${entry.currency}'.`,
        );
      }

      if (entry.direction === 'DEBIT') {
        totalDebits += entry.amount;
      } else if (entry.direction === 'CREDIT') {
        totalCredits += entry.amount;
      } else {
        throw new UnbalancedLedgerEntryError(
          `Invalid entry direction '${(entry as any).direction}'.`,
        );
      }
    }

    if (totalDebits !== totalCredits) {
      throw new UnbalancedLedgerEntryError(
        `Ledger transaction is unbalanced: total debits (${totalDebits}) do not equal total credits (${totalCredits}). Net discrepancy: ${totalDebits - totalCredits}.`,
      );
    }

    const runInTx = async (tx: Prisma.TransactionClient) => {
      const transactionId = generateUuidV7();

      // Ensure all accounts exist, creating them if needed
      const accountMap = new Map<string, string>(); // code -> id

      for (const entry of params.entries) {
        let account = await tx.ledgerAccount.findUnique({
          where: { code: entry.accountCode },
        });

        if (!account) {
          const accountId = generateUuidV7();
          account = await tx.ledgerAccount.create({
            data: {
              id: accountId,
              code: entry.accountCode,
              name: entry.accountName || entry.accountCode,
              type: entry.accountType,
              currency,
              userId: entry.userId ?? null,
              projectId: entry.projectId ?? null,
              balance: BigInt(0),
              isActive: true,
            },
          });
        }

        accountMap.set(entry.accountCode, account.id);

        // Update account balance atomically:
        // Asset/Expense: Debit increases balance, Credit decreases balance.
        // Liability/Equity/Revenue: Credit increases balance, Debit decreases balance.
        const isNormalDebit = entry.accountType === 'ASSET' || entry.accountType === 'EXPENSE';
        const balanceDelta =
          (isNormalDebit && entry.direction === 'DEBIT') ||
          (!isNormalDebit && entry.direction === 'CREDIT')
            ? BigInt(entry.amount)
            : BigInt(-entry.amount);

        await tx.ledgerAccount.update({
          where: { id: account.id },
          data: {
            balance: { increment: balanceDelta },
          },
        });
      }

      // Create Ledger Transaction record
      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          id: transactionId,
          paymentIntentId: params.paymentIntentId ?? null,
          type: params.type,
          description: params.description ?? null,
          entries: {
            create: params.entries.map((e) => ({
              id: generateUuidV7(),
              accountId: accountMap.get(e.accountCode)!,
              direction: e.direction,
              amount: e.amount,
              currency,
            })),
          },
        },
        include: {
          entries: true,
        },
      });

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'ledger.transaction.posted.v1',
          aggregateType: 'LedgerTransaction',
          aggregateId: transactionId,
          payload: {
            transactionId,
            paymentIntentId: params.paymentIntentId ?? null,
            type: params.type,
            totalAmount: totalDebits,
            currency,
            entriesCount: params.entries.length,
            postedAt: ledgerTx.postedAt.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return this.mapTransaction(ledgerTx);
    };

    if (externalTx) {
      return runInTx(externalTx);
    } else {
      return this.prisma.$transaction(runInTx);
    }
  }

  async getAccount(code: string): Promise<LedgerAccountResponse> {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { code },
    });
    if (!account) {
      throw new NotFoundError(`Ledger account '${code}' not found.`);
    }
    return this.mapAccount(account);
  }

  async getProjectEscrowBalance(projectId: string): Promise<number> {
    const code = `LIABILITIES:ESCROW_HOLDING:${projectId}`;
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { code },
    });
    return account ? Number(account.balance) : 0;
  }

  async getCreatorPayableBalance(userId: string): Promise<number> {
    const code = `LIABILITIES:CREATOR_PAYABLE:${userId}`;
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { code },
    });
    return account ? Number(account.balance) : 0;
  }

  private mapTransaction(tx: any): LedgerTransactionResponse {
    return {
      id: tx.id,
      paymentIntentId: tx.paymentIntentId ?? null,
      type: tx.type,
      description: tx.description ?? null,
      postedAt: tx.postedAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      entries: (tx.entries || []).map((e: any) => ({
        id: e.id,
        transactionId: e.transactionId,
        accountId: e.accountId,
        direction: e.direction,
        amount: e.amount,
        currency: e.currency,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private mapAccount(a: any): LedgerAccountResponse {
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      currency: a.currency,
      userId: a.userId ?? null,
      projectId: a.projectId ?? null,
      balance: a.balance.toString(),
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}

export const ledgerService = new LedgerService();
