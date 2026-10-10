import crypto from 'node:crypto';
import type {
  IPaymentProvider,
  CreateOrderParams,
  ProviderOrderResult,
  VerifyWebhookParams,
  NormalizedWebhookEvent,
} from './payment-provider.interface.js';

/**
 * Razorpay Payment Provider Adapter for Indian-Market Workflows.
 *
 * REGULATORY & COMPLIANCE ASSESSMENT (Reserve Bank of India - RBI Regulations):
 * -------------------------------------------------------------------------
 * Under the RBI "Guidelines on Regulation of Payment Aggregators and Payment Gateways"
 * (DPSS.CO.PD.No.1810/02.14.008/2019-20) and Section 25 of the PSS Act, 2007:
 * 1. Marketplace platforms that are not licensed as Payment Aggregators (PAs) CANNOT
 *    receive funds directly into their own current account for subsequent settlement to creators.
 *    Doing so constitutes illegal custody of third-party funds.
 * 2. True marketplace fund flow must be structured using:
 *    a) Razorpay Route / Razorpay Smart Collect (or equivalent nodal accounts):
 *       Customer funds flow directly into the RBI-authorized Nodal/Escrow account of the PA.
 *       The platform initiates split instructions (e.g. 90% creator transfer, 10% platform commission)
 *       which the PA settles directly from the nodal account to the creator's verified bank account (T+2 / T+1).
 *    b) Dedicated SEBI/RBI-registered Escrow Trustee Account (Tripartite agreement).
 * 3. Therefore, CreatorConnect implements an authoritative internal double-entry ledger to model
 *    escrow commitments, while external payments and fund flows are delegated strictly through
 *    the Payment Aggregator's sandbox/APIs without platform custody of funds.
 */
export class RazorpayPaymentProvider implements IPaymentProvider {
  constructor(
    private keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key',
    private keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret',
    private webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_dev',
  ) {}

  async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    // In live production, this performs HTTP Basic Auth POST to https://api.razorpay.com/v1/orders
    // In sandbox / mock mode, or when credentials are test placeholders, returns a deterministic sandbox order.
    if (this.keyId === 'rzp_test_placeholder_key') {
      const hash = crypto
        .createHash('sha256')
        .update(`${params.receipt}:${params.amount}`)
        .digest('hex')
        .substring(0, 14);

      return {
        providerOrderId: `order_${hash}`,
        amount: params.amount,
        currency: params.currency,
        clientSecret: `rzp_sec_${hash}`,
      };
    }

    // Production / live integration with Razorpay Orders API
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: params.amount, // in paisa
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Razorpay order creation failed (${response.status}): ${errBody}`);
    }

    const data = (await response.json()) as any;
    return {
      providerOrderId: data.id,
      amount: data.amount,
      currency: data.currency,
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
      throw new Error('Malformed Razorpay webhook payload: invalid JSON.');
    }

    const eventId = payload.entity?.id || payload.id || `rzp_evt_${Date.now()}`;
    const eventType = payload.event || 'payment.captured';

    let status: 'succeeded' | 'failed' | 'processing' | 'refunded' = 'processing';
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      status = 'succeeded';
    } else if (eventType === 'payment.failed') {
      status = 'failed';
    } else if (eventType === 'refund.processed') {
      status = 'refunded';
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;

    return {
      eventId,
      eventType,
      providerPaymentId: paymentEntity?.id || undefined,
      providerOrderId: paymentEntity?.order_id || orderEntity?.id || undefined,
      status,
      amount: paymentEntity?.amount || orderEntity?.amount || undefined,
      currency: paymentEntity?.currency || orderEntity?.currency || 'INR',
      errorMessage: paymentEntity?.error_description || undefined,
      rawPayload: payload,
    };
  }
}
