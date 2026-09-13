# CreatorConnect — Mobile Client Integration Manual (Android & iOS)

## 1. Architectural Role: Mobile as a Pure API Consumer

This manual is the primary engineering specification for **Android** and **iOS** developers building native or React Native mobile applications for CreatorConnect.

> **CRITICAL RULE**:  
> The mobile client application **MUST NOT** implement marketplace business logic, escrow state calculations, pricing formulas, or milestone transition rules independently. The CreatorConnect Backend is the sole authority for data, security, validation, and contract workflows.

---

## 2. Core Mobile Integration Checklist (20 Technical Dimensions)

### 2.1 Authentication
- **Identity Provider**: Authentication is handled via Supabase Auth (Email/Password, Google OAuth, Apple Sign-In).
- **Token Storage**: Store the Supabase `access_token` and `refresh_token` securely using platform keystores:
  - **iOS**: Keychain Services.
  - **Android**: Android Keystore / EncryptedSharedPreferences.
- **Never Store Secrets**: Mobile apps must NEVER bundle or store backend service-role keys, database credentials, or payment secret keys.

### 2.2 Base URLs & Endpoints
All mobile HTTP calls target the versioned API:
- **Local Emulator**:
  - Android Emulator: `http://10.0.2.2:3000/api/v1`
  - iOS Simulator: `http://localhost:3000/api/v1`
- **Development**: `https://dev-api.creatorconnect.com/api/v1`
- **Staging**: `https://staging-api.creatorconnect.com/api/v1`
- **Production**: `https://api.creatorconnect.com/api/v1`

### 2.3 Required HTTP Headers
Every request emitted by the mobile client must provide:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
x-request-id: <client-generated-uuidv7>
x-client-platform: android | ios
x-client-version: 1.0.0
```

### 2.4 Token Refresh Lifecycle
- Access tokens expire every **15 minutes**.
- Mobile HTTP interceptors (e.g., Axios / OkHttp Interceptor / URLSession delegate) must catch `401 Unauthorized` responses, trigger a background token refresh with Supabase Auth, and replay the original request with the fresh token.
- If refresh fails, purge local tokens and transition user to the login screen.

### 2.5 API Versioning & Deprecation
- Endpoints follow `/api/v1/...`.
- If the backend returns `Deprecation` and `Sunset` headers, log an analytics warning.
- An in-app minimum version check endpoint (`GET /api/v1/system/app-version`) alerts users when a mandatory app store update is required.

### 2.6 Error Envelope Handling (RFC 7807)
All 4xx and 5xx responses emit RFC 7807 Problem Details:
```json
{
  "type": "https://errors.creatorconnect.com/errors/VALIDATION_ERROR",
  "title": "Invalid Request Payload",
  "status": 400,
  "detail": "Field 'budget_min' cannot exceed 'budget_max'.",
  "code": "BUDGET_BOUND_INVALID",
  "requestId": "req_01j7q9k...",
  "errors": [{ "field": "budget_min", "message": "Too large" }]
}
```
Mobile UI layers should map `code` and `errors` directly to input fields and banner alerts.

### 2.7 Pagination Strategy
- All lists (campaigns, talent discovery, chat history) use **cursor pagination**.
- Request: `GET /api/v1/campaigns?limit=20&cursor=ZXlKaGJHY2...`
- Response: Check `pagination.hasMore`. When scrolling to bottom of list, use `pagination.nextCursor` as the query param for the next page.
- Do not use numeric page offsets.

### 2.8 File Upload Architecture (Cloudflare R2 Direct Upload)
Never upload large binary media files through the backend API.
1. Mobile app calls `POST /api/v1/media/upload-session` with `{ filename, mime_type, file_size }`.
2. Backend returns `{ presignedUrl, uploadSessionId }`.
3. Mobile app executes a binary `HTTP PUT` directly to `presignedUrl` (monitoring upload progress bytes).
4. Upon HTTP 200 from R2, mobile app calls `POST /api/v1/media/upload-confirm` with `{ uploadSessionId }`.

### 2.9 WebSockets & Realtime Chat
- Connect to `wss://realtime.creatorconnect.com` using the official **Socket.IO Mobile Client** (available for Swift, Kotlin, and React Native).
- Pass token in handshake: `{ auth: { token: '<access_token>' } }`.
- Support background app states: disconnect cleanly when app goes into background; reconnect and synchronize unread messages upon returning to foreground.

### 2.10 Push Notifications (FCM & APNs)
- Register device token on app launch via Firebase Cloud Messaging SDK.
- Call `POST /api/v1/users/device-token` with `{ token, platform: 'android' | 'ios' }`.
- Re-register token whenever FCM triggers onNewToken.

### 2.11 Deep Linking Standards
The app must support universal links / app links:
- `creatorconnect://campaigns/{id}` → Opens campaign brief.
- `creatorconnect://projects/{id}/milestones/{milestoneId}` → Opens milestone review.
- `creatorconnect://conversations/{id}` → Opens direct chat thread.

### 2.12 Payment Flow (Razorpay Mobile SDK)
1. Mobile app requests order creation: `POST /api/v1/payments/create-order`.
2. Backend returns `{ orderId, amount, currency, key_id }`.
3. Mobile app launches native Razorpay Checkout SDK.
4. When Razorpay SDK returns payment success callback, display a "Payment Processing" spinner.
5. **DO NOT treat payment as confirmed**. Poll `GET /api/v1/projects/{id}` or listen for the WebSocket `payment:success` event triggered when backend webhook verification completes.

### 2.13 Mobile Retry & Network Flakiness Behavior
- Mobile networks drop unexpectedly.
- For idempotent write requests (`POST /api/v1/campaigns`, `POST /api/v1/payments/*`), always send the `Idempotency-Key: <unique-uuidv7>` header.
- Safe retries with exponential backoff: retry on network timeouts and `503 Service Unavailable`; NEVER retry automatically on `4xx` client errors.

### 2.14 Idempotency Keys
Generate an `Idempotency-Key` (UUIDv7) for any operation where a duplicate execution would cause financial or transactional harm (e.g. submitting an application, releasing milestone escrow, placing an order).

### 2.15 Offline Considerations & Caching
- Cache read-only profile summaries and catalog taxonomies locally (e.g., Room on Android, CoreData/SwiftData on iOS).
- Do not cache financial ledger data or contract deliverable statuses offline.
- When device is offline, display an unambiguous offline banner and disable transactional submit buttons.

### 2.16 Date & Time Standards
- All timestamps emitted by backend are UTC ISO 8601 strings (e.g., `2026-09-13T21:45:00.000Z`).
- Mobile app parses UTC and formats to user's local device timezone using `date-fns` or native java.time / Foundation formatters.

### 2.17 Currency & Minor Monetary Units
- All monetary amounts are integers representing the lowest currency denomination (e.g., `50000` = ₹500.00 or $500.00).
- Mobile apps must format currency using standard locale formatters:
  ```typescript
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);
  ```

### 2.18 Media URLs & CDN Optimization
- Public profile pictures and thumbnails are delivered via Cloudflare CDN.
- Mobile clients should append size query params where supported (e.g., `?w=400&q=80`) to save user cellular data.

### 2.19 Account States & Suspensions
- If user account status becomes `SUSPENDED` or `BANNED`, backend returns `403 Forbidden` with code `ACCOUNT_SUSPENDED`.
- Mobile client must immediately clear cached sessions and route the user to an Account Suspension Support view.

### 2.20 User Role Switching
A user may hold both `CREATOR` and `BRAND` roles. The active mode is a client UI preference; the backend validates permissions based on the requested resource and user active roles.
