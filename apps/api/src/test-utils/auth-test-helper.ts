import * as jose from 'jose';

export interface TestAuthKeys {
  publicKey: jose.KeyLike;
  privateKey: jose.KeyLike;
  kid: string;
}

let cachedKeys: TestAuthKeys | null = null;

export async function getOrCreateTestAuthKeys(): Promise<TestAuthKeys> {
  if (!cachedKeys) {
    const kid = 'test-key-01';
    const { publicKey, privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
    cachedKeys = { publicKey, privateKey, kid };
  }
  return cachedKeys;
}

export async function createTestJwt(
  payload: {
    sub: string;
    email?: string;
    aud?: string;
    iss?: string;
    exp?: number;
    [key: string]: unknown;
  },
  options: {
    alg?: string;
    kid?: string | null;
    expiresIn?: string;
    overridePrivateKey?: jose.KeyLike;
  } = {},
): Promise<string> {
  const { privateKey, kid } = await getOrCreateTestAuthKeys();
  const alg = options.alg || 'ES256';
  const signingKey = options.overridePrivateKey || privateKey;

  const { exp, aud, iss, sub, ...restPayload } = payload;

  const jwt = new jose.SignJWT({
    email: payload.email || 'user@example.com',
    ...restPayload,
  })

    .setProtectedHeader({
      alg,
      ...(options.kid !== null ? { kid: options.kid || kid } : {}),
    })
    .setSubject(payload.sub)
    .setAudience(payload.aud || 'authenticated')
    .setIssuer(payload.iss || 'https://localhost.supabase.co/auth/v1')
    .setIssuedAt();

  if (typeof payload.exp === 'number') {
    jwt.setExpirationTime(payload.exp);
  } else {
    jwt.setExpirationTime(options.expiresIn || '1h');
  }

  return await jwt.sign(signingKey);
}

export async function createTestKeySet(): Promise<jose.JWTVerifyGetKey> {
  const { publicKey, kid } = await getOrCreateTestAuthKeys();
  return async (protectedHeader) => {
    if (protectedHeader.kid === kid) {
      return publicKey;
    }
    throw new Error(`Unknown test kid: ${protectedHeader.kid}`);
  };
}
