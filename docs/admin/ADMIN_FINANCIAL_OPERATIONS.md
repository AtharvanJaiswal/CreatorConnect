# CreatorConnect: Admin Financial & Escrow Operations Guide

## 1. Executive Summary & Principles

The CreatorConnect Administrative Financial Platform is engineered around four immutable financial pillars:

1. **Absolute Double-Entry Integrity**: Every money movement within the platform is recorded across dual balanced ledger accounts ($\sum \text{Debits} \equiv \sum \text{Credits}$).
2. **Zero Floating-Point Arithmetic**: All monetary values are represented as minor units (paisa for INR, cents for USD) using 64-bit integers (`Int` or `BigInt`). Floating-point arithmetic (`float`, `double`) is strictly banned in backend business logic to eliminate rounding errors.
3. **Dual-Approval Gating & Anti-Conflict-of-Interest**: Administrative refunds exceeding ₹50,000 (5,000,000 paisa) or requested by administrators without approving authority are quarantined into a `PENDING` state. Self-approval is cryptographically and logically prohibited: an administrator can never approve or reject a transaction they requested.
4. **Immutable Audit Trails**: Every financial inspection, refund request, dual-approval resolution, and ledger audit emits an un-tamperable record into the `audit_logs` table.

---

## 2. Escrow & Payment Lifecycle

```
[Client Funds Escrow] ────────► [PaymentIntent SUCCEEDED]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
      [Project Successfully Done]                   [Dispute / Cancellation]
                   │                                           │
                   ▼                                           ▼
      [Talent Payout Released]                       [Administrative Refund]
                                                               │
                              ┌────────────────────────────────┴────────────────────────────────┐
                              ▼                                                                 ▼
               [Amount < ₹50,000 & Approver]                                       [Amount >= ₹50,000 OR Requester]
                              │                                                                 │
                              ▼                                                                 ▼
                     [Status: SUCCEEDED]                                            [Status: REQUESTED (PENDING)]
                     [Audit: REFUND_PROCESSED]                                      [AdminActionApproval PENDING]
                                                                                                │
                                                                   ┌────────────────────────────┴────────────────────────────┐
                                                                   ▼                                                         ▼
                                                       [Admin 2: APPROVE]                                        [Admin 2: REJECT]
                                                       (decidedById !== requestedById)                           (decidedById !== requestedById)
                                                                   │                                                         │
                                                                   ▼                                                         ▼
                                                       [Status: SUCCEEDED]                                       [Status: FAILED]
                                                       [Audit: REFUND_APPROVED]                                  [Audit: REFUND_REJECTED]
```

---

## 3. Dual-Approval Threshold & Conflict-of-Interest Enforcement

### 3.1 Threshold Specification

The global threshold for dual administrative authorization is defined in `apps/api/src/modules/admin/finance/admin-finance.service.ts`:

```typescript
export const HIGH_VALUE_REFUND_THRESHOLD_PAISA = 5_000_000; // ₹50,000.00 INR
```

### 3.2 Authorization Matrix

| User Role / Permissions                               | Refund Amount | Dual Approval Required? | Initial Refund Status |
| :---------------------------------------------------- | :------------ | :---------------------- | :-------------------- |
| `FINANCE_ADMIN` (with `payments.refund.request` only) | Any amount    | **Yes**                 | `REQUESTED`           |
| `FINANCE_ADMIN` (with `payments.refund.approve`)      | < ₹50,000     | **No** (Auto-executed)  | `SUCCEEDED`           |
| `FINANCE_ADMIN` (with `payments.refund.approve`)      | $\ge$ ₹50,000 | **Yes**                 | `REQUESTED`           |
| `SUPER_ADMIN` (with `*`)                              | < ₹50,000     | **No** (Auto-executed)  | `SUCCEEDED`           |
| `SUPER_ADMIN` (with `*`)                              | $\ge$ ₹50,000 | **Yes**                 | `REQUESTED`           |

### 3.3 Anti-Self-Approval Code Enforcement

In `adminFinanceService.decideRefund`:

```typescript
if (approval.requestedById === decidingAdminId) {
  throw new ConflictOfInterestError(
    'Anti-conflict-of-interest violation: Administrators cannot approve or reject their own refund requests.',
  );
}
```

Attempting to approve or reject a self-initiated refund returns HTTP 403 Forbidden with standard RFC 7807 problem details:

```json
{
  "code": "CONFLICT_OF_INTEREST",
  "title": "Conflict Of Interest Violation",
  "status": 403,
  "detail": "Anti-conflict-of-interest violation: Administrators cannot approve or reject their own refund requests."
}
```

---

## 4. Ledger Reconciliation Engine

The reconciliation audit endpoint `GET /api/v1/admin/reconciliation` performs real-time verification of the platform general ledger:

1. **Sum of Debits vs Credits**:
   $$\sum_{e \in \text{LedgerEntries}} \text{Debit}(e) - \sum_{e \in \text{LedgerEntries}} \text{Credit}(e) \equiv 0$$
2. **Account Balances vs Entry Summations**:
   - For **Asset** and **Expense** accounts:
     $$\text{Balance} = \sum \text{Debits} - \sum \text{Credits}$$
   - For **Liability**, **Equity**, and **Revenue** accounts:
     $$\text{Balance} = \sum \text{Credits} - \sum \text{Debits}$$

If any account exhibits a non-zero discrepancy, the endpoint marks the system as `UNBALANCED` and returns a detailed discrepancy ledger itemizing the error for forensic accounting.

---

## 5. API Reference Summary

| Method | Path                                | Permission Required       | Description                                                   |
| :----- | :---------------------------------- | :------------------------ | :------------------------------------------------------------ |
| `GET`  | `/api/v1/admin/payments`            | `payments.read`           | Search payments and escrow orders with volume metrics.        |
| `GET`  | `/api/v1/admin/payments/:id`        | `payments.read`           | Complete payment intent with ledger entries and refund trace. |
| `GET`  | `/api/v1/admin/refunds`             | `payments.read`           | List refunds with approval state and project links.           |
| `POST` | `/api/v1/admin/refunds`             | `payments.refund.request` | Initiate refund; routes to dual-approval if $\ge$ ₹50,000.    |
| `POST` | `/api/v1/admin/refunds/:id/approve` | `payments.refund.approve` | Approve pending refund with anti-self-approval guard.         |
| `POST` | `/api/v1/admin/refunds/:id/reject`  | `payments.refund.approve` | Reject pending refund with anti-self-approval guard.          |
| `GET`  | `/api/v1/admin/reconciliation`      | `payments.reconcile`      | Audit double-entry ledger balance integrity.                  |
