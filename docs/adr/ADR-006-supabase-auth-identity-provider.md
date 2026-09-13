# ADR-006: Supabase Auth for Managed Identity & Token Lifecycle

## Status

Approved

## Context

Building custom authentication (secure password hashing with Argon2/bcrypt, email verification, SMS OTP delivery, Google/Apple OAuth handshakes, multi-factor authentication, refresh token rotation, session revocation) from scratch is error-prone and distracts from core creator economy marketplace value.

## Decision

Adopt **Supabase Auth** exclusively as the managed Identity Provider (IdP):

1. **Supabase Auth Manages**: User registration, password resets, OAuth providers (Google, Apple, YouTube, Instagram), MFA, session cookies, and RS256 JWT issuance.
2. **Backend Decoupling**: The CreatorConnect backend verifies incoming JWTs using the Supabase JWKS (JSON Web Key Set) public key.
3. **Identity Mapping**: The backend links `supabase_auth_id` to the internal `users` table via UUIDv7.

## Alternatives Evaluated

- **Custom Auth (Passport.js / Jose / custom JWT tables)**: Rejected due to security vulnerability risks, session fixation risks, and high maintenance overhead.
- **Auth0 / Okta**: Evaluated. Rejected due to exorbitant per-MAU (Monthly Active User) pricing at marketplace scale and vendor lock-in.
- **Clerk**: Evaluated. Rejected due to high commercial cost and tight coupling to React frontend components.

## Consequences

- **Positive**: Hardened identity management; seamless OAuth with social networks; zero database load on password hashing; low operational cost.
- **Negative**: Reliance on external service availability for login (mitigated by long-lived access token caching and robust offline session handling).

## Security Impact

Leverages Supabase's hardened authentication infrastructure with automated brute-force protection and cryptographic token rotation.

## Performance Impact

Fastify caches Supabase JWKS public keys in memory for 24 hours, verifying JWT signatures locally in < 1ms with zero outbound network calls per authenticated request.

## Migration Implications

Because the backend maps users via `supabase_auth_id`, the system can migrate to any standard OpenID Connect (OIDC) provider in the future by simply pointing the JWKS verification URL to a new issuer.
