# CreatorConnect Frontend API Integration Guide

## 1. Overview & Architecture

The CreatorConnect web shell communicates directly with the Fastify API backend (`apps/api`). The backend acts as the single source of truth for all business logic, validation, data retention, and authorization rules.

All API communication is centralized within `apps/web-shell/src/lib/api-client.ts`.

---

## 2. API Client Capabilities

The `apiClient` singleton provides a typed, promise-based HTTP client built on native `fetch`:

```typescript
import { apiClient, ApiError } from '@/lib/api-client';

// Standard GET with query parameter serialization
const users = await apiClient.get<UserListResponse>('/api/v1/admin/users', {
  params: { page: 1, limit: 20, role: 'CREATOR' },
});

// Authenticated POST with bearer token
const response = await apiClient.post<SuspendResponse>(
  `/api/v1/admin/users/${userId}/suspend`,
  { reason: 'Fraudulent portfolio submission', durationDays: 14 },
  { token: session.accessToken },
);
```

### 2.1 Key Features

- **Automatic Parameter Serialization**: Automatically converts objects into URL query parameters, gracefully omitting `undefined` and `null` values.
- **Bearer Token Injection**: Automatically sets the `Authorization: Bearer <token>` header when a token is provided in request options.
- **Empty Body Handling**: Fully handles `204 No Content` responses by returning `null` without attempting invalid JSON parsing.
- **RFC 7807 Problem Details Parsing**: All `4xx` and `5xx` responses are parsed into standard `ProblemDetails` models and thrown as typed `ApiError` instances.

---

## 3. RFC 7807 Problem Details Standard

The CreatorConnect backend formats all operational and validation errors according to the RFC 7807 Problem Details standard:

```json
{
  "type": "https://creatorconnect.in/errors/forbidden",
  "title": "Insufficient Permissions",
  "status": 403,
  "detail": "You do not have users.suspend administrative capability.",
  "instance": "/api/v1/admin/users/usr_01J8F/suspend",
  "code": "PERMISSION_DENIED"
}
```

When an error occurs, `apiClient` throws an `ApiError`:

```typescript
try {
  await apiClient.post('/api/v1/admin/refunds/ref_101/approve', {});
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error [${error.status}]: ${error.problem?.detail || error.message}`);
    // Display error.problem?.detail in an accessible banner or modal
  }
}
```

---

## 4. Authentication & Bearer Tokens

The Admin Console obtains asymmetric JWT bearer tokens via Supabase Auth in `useAuth()` (`apps/web-shell/src/providers/auth-provider.tsx`).

1. The client signs in via `/admin/login` using email and password.
2. The returned session contains an access token signed with an asymmetric private key.
3. The Fastify API validates the JWT against the Supabase JWKS endpoint.
4. If valid, the API unpacks the user ID, resolves administrative roles in `AdminUserRole`, and evaluates CASL permissions.

---

## 5. Domain Endpoint Reference

| Domain            | Method | Route                                       | Permission Required          |
| :---------------- | :----- | :------------------------------------------ | :--------------------------- |
| **Dashboard**     | `GET`  | `/api/v1/admin/dashboard/stats`             | `dashboard.view`             |
| **Users**         | `GET`  | `/api/v1/admin/users`                       | `users.view`                 |
| **Users**         | `POST` | `/api/v1/admin/users/:id/suspend`           | `users.suspend`              |
| **Verification**  | `GET`  | `/api/v1/admin/verification`                | `verification.review`        |
| **Assignments**   | `GET`  | `/api/v1/admin/marketplace/assignments`     | `marketplace.assignments`    |
| **Moderation**    | `GET`  | `/api/v1/admin/moderation/reports`          | `moderation.queue`           |
| **Reviews**       | `GET`  | `/api/v1/admin/reviews`                     | `reviews.manage`             |
| **Payments**      | `GET`  | `/api/v1/admin/finance/escrow`              | `finance.view`               |
| **Refunds**       | `POST` | `/api/v1/admin/finance/refunds/:id/approve` | `finance.refund` (Anti-self) |
| **Reconcile**     | `GET`  | `/api/v1/admin/finance/reconciliation`      | `finance.view`               |
| **Notifications** | `POST` | `/api/v1/admin/notifications/broadcast`     | `notifications.broadcast`    |
| **Disputes**      | `POST` | `/api/v1/admin/disputes/:id/resolve`        | `disputes.resolve`           |
| **Jobs**          | `GET`  | `/api/v1/admin/jobs/metrics`                | `jobs.view`                  |
| **Config**        | `GET`  | `/api/v1/admin/config`                      | `config.view`                |
| **Staff/RBAC**    | `GET`  | `/api/v1/admin/rbac/staff`                  | `rbac.manage`                |
| **Audit**         | `GET`  | `/api/v1/admin/audit`                       | `audit.view`                 |
| **Lifecycle**     | `GET`  | `/api/v1/admin/lifecycle/holds`             | `lifecycle.view`             |
