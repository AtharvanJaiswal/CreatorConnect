# ADR-010: Cloudflare R2 for Object Storage with Presigned Direct Uploads

## Status

Approved

## Context

A creator economy platform processes immense volumes of media: 4K video reels, high-resolution graphic design files, audio podcasts, project raw deliverables, and creator portfolios. Traditional object storage providers (e.g., AWS S3) levy heavy data egress charges, which would severely degrade marketplace unit economics as media consumption scales. Furthermore, proxying large file uploads through backend HTTP servers exhausts server memory and network bandwidth.

## Decision

Adopt **Cloudflare R2** as the unified object storage engine using standard **AWS S3-compatible SDKs** (`@aws-sdk/client-s3`) and a **Presigned Direct Upload Architecture**:

1. **Zero Egress Fees**: Cloudflare R2 charges $0 for data egress, drastically reducing bandwidth overhead.
2. **Presigned Upload URLs**: Clients request short-lived (15-minute) presigned `PUT` URLs from Fastify, uploading large binaries directly to R2 without touching backend API memory.
3. **Private Buckets & CDN Distribution**:
   - Public assets (creator avatars, public portfolio thumbnails) served through Cloudflare CDN with edge caching.
   - Private assets (raw project deliverables, contract attachments, identity documents) kept in strictly private buckets accessible only via authenticated, short-lived presigned download URLs.

## Alternatives Evaluated

- **AWS S3**: Rejected due to unpredictable, punishing egress pricing ($0.09/GB egress vs. $0.00/GB on R2).
- **Direct Multi-Part Upload to Backend Server**: Rejected because streaming 500MB+ video files through Node.js Fastify instances causes thread blocking, memory bloat, and socket timeouts.

## Consequences

- **Positive**: Virtually zero egress cost; massive scalability; standard S3 SDK compatibility ensures zero vendor lock-in.
- **Negative**: Requires client-side upload orchestration (upload progress bars, presigned URL acquisition, and confirmation webhooks).

## Security Impact

Enforces strict MIME-type and Content-Length constraints in the presigned URL signature. Uploaded assets are initially quarantined until scanned by background ClamAV workers.

## Performance Impact

Frees 100% of backend API network bandwidth for transactional JSON traffic, eliminating upload bottlenecks.

## Migration Implications

Because R2 implements the standard S3 API, migrating back to AWS S3, MinIO (local dev), or Google Cloud Storage requires only updating environment variables without changing a single line of application code.
