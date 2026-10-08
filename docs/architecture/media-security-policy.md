# CreatorConnect — Media Security Architecture & Policy Specification (Phase 4.5 Hardening F-10/F-22/F-25)

## 1. Executive Summary & Principles

CreatorConnect operates on zero-trust media asset lifecycle governance. User-submitted assets represent potential vector surfaces for malware propagation, SSRF, remote execution, and unauthorized exposure.

**Core Invariants:**

1. **Zero Access for Non-Active Assets**: Any media asset not in state `ACTIVE` strictly receives `null` for public/download URLs.
2. **Contextual & Inherited Visibility**: Media visibility directly inherits the parent profile or portfolio visibility.
3. **Strict Ownership Verification**: All mutating and read requests for quarantined assets must cryptographically match the authenticated `userId`.
4. **Short-Lived Signed URLs**: Pre-signed upload and download URLs enforce time-bound expirations (upload: 15 minutes, download: 15 minutes for private assets, 1 hour for public) and are **never** logged to server stdout/telemetry.
5. **Magic-Byte Validation != Antivirus (F-10 / F-22 Hardening)**: Format validation via magic-byte signature inspection (`file-type`) guarantees MIME integrity only. It detects byte header mismatches (e.g. an ELF binary renamed to `.jpg`), but does **NOT** detect viruses, trojans, PDF exploit scripts, or embedded steganographic payloads. True malware detection is an independent, mandatory architectural pipeline stage.

---

## 2. Profile & Media Visibility Semantics (F-25 Policy)

### UNLISTED Profile & Media Semantics

- **Discovery & Search**: An `UNLISTED` profile is explicitly filtered out of public discovery queries, search indexes, category directories, and algorithmic recommendations (`WHERE visibility = 'PUBLIC' AND status = 'ACTIVE'`).
- **Direct Access**: Users with the direct canonical URL (`/profiles/{id}`) may resolve the profile provided they possess platform access.
- **Media Inheritance**: Media assets attached to an `UNLISTED` profile are accessible only via direct link or when embedded in the unlisted portfolio. They never appear in global public galleries or discovery media feeds.

### ACTIVE Media Visibility Semantics

| Asset State        | Download / Public URL Available? | Accessible by Owner       | Accessible by Non-Owner                    | CDN Caching Allowed |
| :----------------- | :------------------------------- | :------------------------ | :----------------------------------------- | :------------------ |
| `QUARANTINED`      | **NO** (`null`)                  | Yes (metadata only)       | **NO** (403 Forbidden)                     | Prohibited          |
| `PENDING_SCAN`     | **NO** (`null`)                  | Yes (metadata only)       | **NO** (403 Forbidden)                     | Prohibited          |
| `PROCESSING`       | **NO** (`null`)                  | Yes (metadata only)       | **NO** (403 Forbidden)                     | Prohibited          |
| `REJECTED_INVALID` | **NO** (`null`)                  | Yes (metadata with error) | **NO** (404/403)                           | Prohibited          |
| `REJECTED_MALWARE` | **NO** (`null`)                  | Notification only         | **NO** (403)                               | Prohibited          |
| `ACTIVE`           | **YES** (presigned or CDN)       | Yes (full)                | Permitted if parent is `PUBLIC`/`UNLISTED` | Permitted           |

### Parent Object Inheritance Rules (API Authorization Before URL Issuance)

1. **PUBLIC Parent**: An asset attached to an active `PUBLIC` portfolio item is eligible for public CDN URL delivery.
2. **PRIVATE Parent**: An asset attached exclusively to `PRIVATE` portfolio item(s) is accessible **ONLY** by the authenticated asset owner or platform administrator. It is **never** issued a public CDN URL; it receives only short-lived (15-minute) authenticated signed URLs.
3. **UNLISTED Parent**: Accessible to direct callers holding the asset reference; excluded from search/discovery indexes.
4. **DELETED Parent**: If all parent portfolio items have `deletedAt != null`, non-owners receive `403 Forbidden`.
5. **SUSPENDED / DEACTIVATED Owner**: If the owner user account is `SUSPENDED` or `DEACTIVATED`, or `creatorProfile.deletedAt != null`, **ALL** access to the media asset is immediately rejected with `403 Forbidden`. No download URL is ever generated.
6. **Unattached Active Media**: An asset in state `ACTIVE` that has not yet been linked to a portfolio item is private by default. Only the asset owner can view or obtain a short-lived download URL. Unrelated users receive `403 Forbidden`.

---

## 3. Malware Scanning & Ingestion Pipeline Architecture (F-10 / F-22)

### State Machine Lifecycle

```
+---------------+
|  QUARANTINED  |  (Upload to isolated quarantine bucket via presigned PUT)
+-------+-------+
        |  Confirm Upload (Byte-size & HeadObject validation)
        v
+---------------+
| PENDING_SCAN  |  (Enqueued to specialist worker queue)
+-------+-------+
        |  Stage 1: FORMAT VALIDATION (MIME & Magic-Byte Header Verification)
        v
+---------------+
|  SCANNING     |  (Stage 2: MALWARE DETECTION: Sandboxed Scanner Container)
+-------+-------+
     /     \
    /       \ (Malware detected) -> [ REJECTED_MALWARE ] (Automated purge & security alert)
   v
+---------------+
|  CLEAN        |  (Clean verdict certified and cryptographically bound)
+-------+-------+
        |  Stage 3: DERIVATIVE PROCESSING (Sharp resize / Transcode / EXIF strip)
        v
+---------------+
|    ACTIVE     |  (Promoted to public bucket with immutable key; presigned delivery)
+---------------+
```

### TOCTOU Overwrite Prevention & Immutable Keys

- **No Mutable In-Place Scanning**: Quarantined objects are never scanned or mutated in place.
- **Immutable Object Keys**: Each asset upload generates a UUIDv7-based storage key (`quarantine/{userId}/{assetId}.{ext}`). Upon clean certification, derivatives and clean copies are written to an immutable destination (`public-assets/{userId}/{assetId}.{ext}`).
- **Scan Verdict Binding**: The malware scan verdict is strictly bound to the triple:
  ```
  (assetId, storageKey, objectVersion/etag/sha256)
  ```
  Any modification or re-upload invalidates the verdict and resets status to `QUARANTINED`.
- **Scanner Failure**: If the antivirus scanner fails, times out, or errors, the asset **remains pending** (`PENDING_SCAN`). It is **never** promoted to `ACTIVE` on error. Zero signed download URLs are issued before a clean verdict.

### ClamAV / Isolated Scanner Runtime Specifications

When deploying the containerized malware scanning engine:

1. **Isolated Runtime**: Runs in an unprivileged, dedicated container (`clamav:latest` or custom security appliance).
2. **Non-Root Execution**: Runs strictly as an unprivileged user (`clamav` or `uid:1000`).
3. **Resource Bounds**: Strict cgroup memory (2GB) and CPU limits (1.0 core) to neutralize decompression bombs (zip/gzip/pdf archive bombs).
4. **Restricted Network**: Zero internet egress; only internal bridge access to object storage and worker broker.
5. **Least Privilege Storage Access**: Read-only credentials to the `quarantine` bucket; write-only access to the `clean` bucket.

### Phase 5 Blocker & Threat Model Decision

> [!CAUTION]
> **Phase 5 Attachment Invariant**: Direct user-to-user messaging attachments, contract document uploads, and invoice attachments in Phase 5 are strictly **prohibited** from bypassing malware scanning or relying on unverified files. Magic-byte verification is NOT a substitute for antivirus scanning.
