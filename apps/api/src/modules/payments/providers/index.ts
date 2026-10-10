import type { PaymentProvider } from '@creatorconnect/contracts';
import type { IPaymentProvider } from './payment-provider.interface.js';
import { MockPaymentProvider } from './mock-payment-provider.js';
import { RazorpayPaymentProvider } from './razorpay-payment-provider.js';

export * from './payment-provider.interface.js';
export * from './mock-payment-provider.js';
export * from './razorpay-payment-provider.js';

const mockProvider = new MockPaymentProvider();
const razorpayProvider = new RazorpayPaymentProvider();

export function getPaymentProvider(provider: PaymentProvider = 'SANDBOX_MOCK'): IPaymentProvider {
  switch (provider) {
    case 'RAZORPAY':
      return razorpayProvider;
    case 'STRIPE':
    case 'SANDBOX_MOCK':
    default:
      return mockProvider;
  }
}
