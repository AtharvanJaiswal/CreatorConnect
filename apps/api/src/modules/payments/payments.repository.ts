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
      orderBy: { createdAt: 'desc' },
    });
  }

  async listIntentsByClientId(clientId: string) {
    return this.prisma.paymentIntent.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const paymentsRepository = new PaymentsRepository();
