import { Type, FormatRegistry } from '@sinclair/typebox';

if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (value) => !Number.isNaN(Date.parse(value)));
}

if (!FormatRegistry.Has('uri')) {
  FormatRegistry.Set('uri', (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  });
}

if (!FormatRegistry.Has('uuid')) {
  FormatRegistry.Set('uuid', (value) =>
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value),
  );
}

if (!FormatRegistry.Has('https-url')) {
  FormatRegistry.Set('https-url', (value) => {
    try {
      if (typeof value !== 'string') return false;
      if (!value.startsWith('https://')) return false;
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:') return false;
      if (parsed.username || parsed.password) return false;
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Common TypeBox format definitions and string patterns.
 */

export const UuidSchema = Type.String({
  format: 'uuid',
  pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  description: 'Canonical UUID (v4 or v7)',
});

export const IsoDateTimeSchema = Type.String({
  format: 'date-time',
  description: 'ISO 8601 UTC timestamp',
});

export const CurrencyCodeSchema = Type.String({
  minLength: 3,
  maxLength: 3,
  pattern: '^[A-Z]{3}$',
  default: 'INR',
  description: 'ISO 4217 3-letter uppercase currency code',
});

export const MinorUnitsSchema = Type.Integer({
  minimum: 0,
  description: 'Monetary amount in lowest currency denomination (e.g. cents, paise)',
});

export const HttpsUrlSchema = Type.String({
  format: 'https-url',
  maxLength: 512,
  description: 'Strict HTTPS URL without embedded credentials',
});
