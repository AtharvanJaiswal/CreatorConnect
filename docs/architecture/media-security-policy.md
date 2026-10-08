# CreatorConnect — Media Security Architecture & Policy Specification (Phase J)

## 1. Executive Summary & Principles

CreatorConnect operates on zero-trust media asset lifecycle governance. User-submitted assets represent potential vector surfaces for malware propagation, SSRF, remote execution, and unauthorized exposure.

**Core Invariants:**

1. **Zero Access for Non-Active Assets**: Any media asset not in state `ACTIVE` strictly receives `null` for public/download URLs.
2. **Contextual & Inherited Visibility**: Media visibility directly inherits the parent profile or portfolio visibility.
3. **Strict Ownership Verification**: All mutating and read requests for quarantined assets must cryptographically match the authenticated `userId`.
4. **Short-Lived Signed URLs**: Pre-signed upload and download URLs enforce time-bound expirations (upload: 15 minutes, download: 1 hour) and are **never** logged to server stdout/telemetry.
5. **Magic-Byte Validation != Antivirus**: Magic-byte signature checking guarantees MIME integrity only, not cleanliness. True malware scanning is a mandatory architectural pipeline stage.

---

## 2. Profile & Media Visibility Semantics

### UNLISTED Profile Semantics

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

---

## 3. Malware Scanning & Ingestion Pipeline Architecture

Before Phase 5 introduces attachments across messaging, proposals, and contracts, the media ingestion pipeline follows this strictly staged state machine:

```
+---------------+
|  QUARANTINED  |  (Upload to isolated quarantine bucket via presigned PUT)
+-------+-------+
        |  Confirm Upload (Byte-size & HeadObject validation)
        v
+---------------+
| PENDING_SCAN  |  (Enqueued to specialist worker queue)
+-------+-------+
        |  Stage 1: MIME & Magic-Byte Header Verification
        v
+---------------+
|  SCANNING     |  (Stage 2: Antivirus & Content Disarm: ClamAV / VirusTotal / Sandbox)
+-------+-------+
     /     \
    /       \ (Malware detected) -> [ REJECTED_MALWARE ] (Automated purge & security alert)
   v
+---------------+
|  PROCESSING   |  (Stage 3: Sharp image resize / Transcoding / EXIF strip)
+-------+-------+
        |  Atomic S3 Copy to public media bucket & DB status transition
        v
+---------------+
|    ACTIVE     |  (Available for portfolio linking & presigned delivery)
+---------------+
```

### Pre-Phase-5 Prerequisite Declaration

- **Current Remediation State**: Byte-size verification (`HeadObject`) and magic-byte inspection (`file-type`) are operational in `apps/api` and `apps/worker`.
- **Phase 5 Blocker**: Direct attachments in real-time chat or contracts require the integration of a sandboxed ClamAV / containerized scanner runtime before attachment delivery is exposed to peers.
