export interface CreateOrderParams {
  amount: number; // Integer minor units (e.g. paisa for INR)
  currency: string; // ISO 3-letter currency code (e.g. 'INR')
  receipt: string;
  notes?: Record<string, string> | undefined;
}

export interface ProviderOrderResult {
  providerOrderId: string;
  amount: number;
  currency: string;
  clientSecret?: string | undefined;
}

export interface VerifyWebhookParams {
  rawBody: string;
  signature: string;
  secret: string;
}

export interface NormalizedWebhookEvent {
  eventId: string;
  eventType: string;
  providerPaymentId?: string | undefined;
  providerOrderId?: string | undefined;
  status: 'succeeded' | 'failed' | 'processing' | 'refunded';
  amount?: number | undefined;
  currency?: string | undefined;
  errorMessage?: string | undefined;
  rawPayload: unknown;
}

export interface IPaymentProvider {
  createOrder(params: CreateOrderParams): Promise<ProviderOrderResult>;
  verifyWebhookSignature(params: VerifyWebhookParams): boolean;
  parseWebhookEvent(rawBody: string, signature?: string): NormalizedWebhookEvent;
}
