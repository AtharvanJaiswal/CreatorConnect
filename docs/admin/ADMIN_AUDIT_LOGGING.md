# CreatorConnect: Admin Audit Logging Architecture & Forensics

Comprehensive operational and security standard for audit logging across the CreatorConnect administration plane.

---

## 1. Compliance & Security Principles

Administrative operations have elevated privileges that can alter platform configuration, suspend accounts, and move funds. To satisfy regulatory obligations (SOC 2 Type II, ISO 27001, GDPR, and Indian IT Act 2000), the CreatorConnect administrative audit subsystem enforces:

1. **Transactional Immutability**: Every mutation endpoint writes to the `audit_logs` table within the same PostgreSQL ACID transaction as the business operation. If the audit write fails, the entire business operation rolls back.
2. **Append-Only Storage**: The `audit_logs` table grants no `UPDATE` or `DELETE` permissions to application connection pools. Rows can only be created.
3. **Structured Non-Repudiation**: Every record captures the authoritative actor (`userId`), action identifier, target entity type, target entity ID, UTC timestamp, and a structured `metadata` JSON payload containing before/after states, rationale, and environmental indicators.
4. **Deny-by-Default Redaction**: Sensitive attributes such as credentials, raw JWTs, customer banking PANs, and unmasked credit card numbers are strictly prevented from entering `metadata`.

---

## 2. Event Catalog & Action Taxonomy

| Module          | Action Name                       | Entity Type            | Trigger Event                            | Mandatory Metadata                                                   |
| :-------------- | :-------------------------------- | :--------------------- | :--------------------------------------- | :------------------------------------------------------------------- |
| **RBAC**        | `ADMIN_ROLE_CREATED`              | `AdminRole`            | Custom role created                      | `roleName`, `permissions`                                            |
| **RBAC**        | `ADMIN_ROLE_UPDATED`              | `AdminRole`            | Custom role permissions altered          | `roleName`, `previousPermissions`, `newPermissions`                  |
| **RBAC**        | `ADMIN_ROLE_DELETED`              | `AdminRole`            | Custom role deleted                      | `roleName`, `previousPermissions`                                    |
| **RBAC**        | `ADMIN_ROLE_ASSIGNED`             | `User`                 | Role assigned to administrator           | `targetUserId`, `roleId`, `roleName`                                 |
| **RBAC**        | `ADMIN_ROLE_REVOKED`              | `User`                 | Role removed from administrator          | `targetUserId`, `roleId`, `roleName`                                 |
| **Users**       | `USER_SUSPENDED`                  | `User`                 | Account suspended by staff               | `targetUserId`, `reason`                                             |
| **Users**       | `USER_REACTIVATED`                | `User`                 | Suspended account reactivated            | `targetUserId`, `reason`                                             |
| **Marketplace** | `CREATOR_VERIFIED`                | `CreatorProfile`       | Verification badge granted               | `userId`, `reason`                                                   |
| **Marketplace** | `CREATOR_UNVERIFIED`              | `CreatorProfile`       | Verification badge revoked               | `userId`, `reason`                                                   |
| **Marketplace** | `CLIENT_VERIFIED`                 | `BrandProfile`         | Brand client verified                    | `userId`, `reason`                                                   |
| **Marketplace** | `PROJECT_MODERATED`               | `Project`              | Project suspended or flagged             | `action`, `previousStatus`, `newStatus`, `reason`                    |
| **Finance**     | `REFUND_REQUESTED`                | `Refund`               | Refund initiated requiring dual approval | `approvalId`, `amountMinor`, `reason`, `notes`                       |
| **Finance**     | `REFUND_PROCESSED`                | `Refund`               | Auto-approved refund completed           | `amountMinor`, `reason`, `notes`                                     |
| **Finance**     | `REFUND_APPROVED`                 | `Refund`               | Dual approval granted by 2nd admin       | `approvalId`, `requestedById`, `decidedById`, `reason`               |
| **Finance**     | `REFUND_REJECTED`                 | `Refund`               | Dual approval denied by 2nd admin        | `approvalId`, `requestedById`, `decidedById`, `reason`               |
| **Finance**     | `RECONCILIATION_AUDIT_PERFORMED`  | `LedgerAccount`        | Balance integrity audited                | `status`, `totalDebitsMinor`, `totalCreditsMinor`, `unbalancedCount` |
| **Moderation**  | `REPORT_RESOLVED`                 | `Report`               | Incident report resolved                 | `action`, `notes`, `targetUserId`, `targetType`                      |
| **Moderation**  | `REPORT_DISMISSED`                | `Report`               | Incident report dismissed                | `reason`, `targetType`, `targetId`                                   |
| **Moderation**  | `REVIEW_MODERATED`                | `Review`               | Review hidden, flagged or restored       | `action`, `fromStatus`, `toStatus`, `reason`, `internalNotes`        |
| **Settings**    | `PLATFORM_SETTING_UPDATED`        | `PlatformSetting`      | Configuration switch modified            | `key`, `previousValue`, `newValue`, `version`, `reason`              |
| **Broadcast**   | `NOTIFICATION_CAMPAIGN_CREATED`   | `NotificationCampaign` | Campaign staged                          | `title`, `targetType`, `estimatedRecipients`                         |
| **Broadcast**   | `NOTIFICATION_CAMPAIGN_SENT`      | `NotificationCampaign` | Broadcast sent                           | `sentCount`, `targetType`                                            |
| **Broadcast**   | `NOTIFICATION_CAMPAIGN_CANCELLED` | `NotificationCampaign` | Campaign cancelled                       | `campaignId`                                                         |
| **Jobs**        | `QUEUE_FAILED_JOBS_RETRIED`       | `JobQueue`             | Dead-letter queue re-queued              | `queueName`                                                          |

---

## 3. Forensic Query Patterns

### 3.1 Investigating All Actions by an Administrator

```sql
SELECT
    created_at,
    action,
    entity,
    entity_id,
    metadata
FROM "audit_logs"
WHERE "user_id" = '01948320-...'
ORDER BY "created_at" DESC;
```

### 3.2 Full Audit Trail for a Specific Entity (e.g. Project or Refund)

```sql
SELECT
    a.created_at,
    u.email AS actor_email,
    a.action,
    a.metadata
FROM "audit_logs" a
JOIN "users" u ON a.user_id = u.id
WHERE a.entity_id = '01948320-...'
ORDER BY a.created_at ASC;
```

### 3.3 Verifying Dual-Approval Compliance on High-Value Refunds

```sql
SELECT
    a.entity_id AS refund_id,
    a.metadata->>'requestedById' AS requested_by,
    a.metadata->>'decidedById' AS decided_by,
    a.metadata->>'amountMinor' AS amount_minor,
    a.metadata->>'reason' AS decision_reason,
    a.created_at AS decision_time
FROM "audit_logs" a
WHERE a.action = 'REFUND_APPROVED'
  AND (a.metadata->>'requestedById') = (a.metadata->>'decidedById');
-- Result must ALWAYS be 0 rows (anti-self-approval invariant).
```
