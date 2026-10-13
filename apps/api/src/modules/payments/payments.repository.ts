import { getPrismaClient } from '@creatorconnect/database';
import type { PaymentProvider } from '@creatorconnect/contracts';

export class PaymentsRepository {
  constructor(private prisma = getPrismaClient()) {}

  async findIntentById(id: string) {
    return this.prisma.paymentIntent.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            clientId: true,
            talentId: true,
            title: true,
            status: true,
          },
        },
        deliverable: {
          select: {
            id: true,
            title: true,
            status: true,
            amount: true,
          },
        },
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findIntentByProviderOrderId(provider: PaymentProvider, providerOrderId: string) {
    return this.prisma.paymentIntent.findFirst({
      where: {
        provider,
        providerOrderId,
      },
      include: {
        project: true,
        deliverable: true,
        refunds: true,
      },
    });
  }

  async findIntentByProviderPaymentId(provider: PaymentProvider, providerPaymentId: string) {
    return this.prisma.paymentIntent.findFirst({
      where: {
        provider,
        providerPaymentId,
      },
      include: {
        project: true,
        deliverable: true,
        refunds: true,
      },
    });
  }

  async findWebhookEvent(provider: PaymentProvider, eventId: string) {
    return this.prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });
  }

  async listIntentsByProjectId(projectId: string) {
    return this.prisma.paymentIntent.findMany({
      where: { projectId },
      include: { refunds: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listIntentsByClientId(clientId: string) {
    return this.prisma.paymentIntent.findMany({
      where: { clientId },
      include: { refunds: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRefundById(id: string) {
    return this.prisma.refund.findUnique({
      where: { id },
      include: {
        paymentIntent: true,
        project: true,
        refundedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findRefundByProviderRefundId(provider: PaymentProvider, providerRefundId: string) {
    return this.prisma.refund.findFirst({
      where: {
        provider,
        providerRefundId,
      },
      include: {
        paymentIntent: true,
        project: true,
      },
    });
  }

  async listRefundsByPaymentIntentId(paymentIntentId: string) {
    return this.prisma.refund.findMany({
      where: { paymentIntentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRefundsByProjectId(projectId: string) {
    return this.prisma.refund.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sumRefundedAmountForIntent(paymentIntentId: string): Promise<number> {
    const aggregate = await this.prisma.refund.aggregate({
      where: {
        paymentIntentId,
        status: { in: ['SUCCEEDED', 'PROCESSING'] },
      },
      _sum: {
        amount: true,
      },
    });
    return aggregate._sum.amount ?? 0;
  }
}

export const paymentsRepository = new PaymentsRepository();
