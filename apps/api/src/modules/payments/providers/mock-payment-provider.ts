import crypto from 'node:crypto';
import type {
  IPaymentProvider,
  CreateOrderParams,
  ProviderOrderResult,
  VerifyWebhookParams,
  NormalizedWebhookEvent,
} from './payment-provider.interface.js';

export class MockPaymentProvider implements IPaymentProvider {
  constructor(
    private webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret_dev_key',
  ) {}

  async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    const hash = crypto
      .createHash('sha256')
      .update(`${params.receipt}:${params.amount}:${params.currency}`)
      .digest('hex')
      .substring(0, 16);

    const providerOrderId = `mock_ord_${hash}`;
    const clientSecret = `mock_sec_${hash}_${Date.now()}`;

    return {
      providerOrderId,
      amount: params.amount,
      currency: params.currency,
      clientSecret,
    };
  }

  verifyWebhookSignature(params: VerifyWebhookParams): boolean {
    if (!params.signature || !params.rawBody) {
      return false;
    }

    const secret = params.secret || this.webhookSecret;
    const computedHmac = crypto.createHmac('sha256', secret).update(params.rawBody).digest('hex');

    try {
      const computedBuf = Buffer.from(computedHmac, 'utf-8');
      const signatureBuf = Buffer.from(params.signature, 'utf-8');

      if (computedBuf.length !== signatureBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(computedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string): NormalizedWebhookEvent {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error('Malformed webhook payload: not valid JSON.');
    }

    const eventId = payload.id || payload.eventId || `mock_evt_${Date.now()}`;
    const eventType = payload.event || payload.eventType || 'payment.captured';

    let status: 'succeeded' | 'failed' | 'processing' | 'refunded' = 'processing';
    if (
      eventType === 'payment.captured' ||
      eventType === 'order.paid' ||
      eventType === 'payment.succeeded'
    ) {
      status = 'succeeded';
    } else if (eventType === 'payment.failed') {
      status = 'failed';
    } else if (eventType === 'refund.processed') {
      status = 'refunded';
    }

    return {
      eventId,
      eventType,
      providerPaymentId: payload.payload?.payment?.id || payload.paymentId || undefined,
      providerOrderId: payload.payload?.order?.id || payload.orderId || undefined,
      status,
      amount: payload.payload?.payment?.amount || payload.amount || undefined,
      currency: payload.payload?.payment?.currency || payload.currency || 'INR',
      errorMessage: payload.payload?.payment?.error_description || payload.error || undefined,
      rawPayload: payload,
    };
  }
}
