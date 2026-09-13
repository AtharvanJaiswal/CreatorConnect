# ADR-012: Multi-Channel Notification Engine with Firebase Cloud Messaging & Resend

## Status

Approved

## Context

Marketplace engagements require real-time alerts across channels: proposal submitted, contract offer received, milestone deliverable uploaded, payment released, and new chat message. Users expect timely notifications across Web browsers, iOS, Android, and Email without channel spam.

## Decision

Establish an **Asynchronous Multi-Channel Notification Engine** decoupled behind a **Notification Dispatcher Port**:

1. **Push Notifications (Web & Mobile)**: Standardize on **Firebase Cloud Messaging (FCM)** for cross-platform web push, Android push, and iOS APNs routing via the Firebase Admin SDK.
2. **Transactional Emails**: Standardize on **Resend** paired with **React Email** for type-safe, responsive, beautiful email templates.
3. **SMS / OTP**: Standardize behind an `SmsProvider` interface (Twilio / AWS SNS / Fast2SMS).
4. **Asynchronous Dispatch**: Notification triggers emit events to the Transactional Outbox; the BullMQ worker consumes them, applies user preference checks (quiet hours, channel opt-outs), deduplicates alerts, and dispatches asynchronously.

## Alternatives Evaluated

- **OneSignal**: Evaluated. Rejected due to high vendor lock-in, commercial cost at scale, and unnecessary external SDK overhead compared to native FCM.
- **Synchronous Notification in HTTP Handler**: Rejected because waiting for external FCM or SMTP network calls inside a Fastify project creation handler introduces 500ms-2000ms latency spikes and causes request timeouts.

## Consequences

- **Positive**: Zero latency impact on core marketplace APIs; unified push delivery for Web and Mobile; centralized preference enforcement.
- **Negative**: Requires managing FCM device registration token lifecycles (invalid token cleanup, token rotation).

## Security Impact

Device tokens are linked to `user_id` and revoked upon account suspension or logout. Notification payloads omit sensitive PII, delivering generic alert text with deep links.

## Performance Impact

Push notifications and emails dispatch in background queues with sub-second latency from event publication.

## Migration Implications

New channels (e.g., WhatsApp Business API or Slack notifications) can be added as new adapters to the notification dispatcher without touching business workflows.
