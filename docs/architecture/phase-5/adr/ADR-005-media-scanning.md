# ADR-005: Antivirus Media Scanning Gateway

## 1. Context & Problem Statement

Phase 4 introduced media upload pipelines with magic-byte checking via `file-type`, image dimension extraction via `sharp`, and PDF structure parsing via `pdf-lib`. However, Phase 5 enables peer-to-peer chat attachments and contractual document sharing. Magic-byte verification verifies MIME structure but cannot detect embedded malware, polymorphic scripts, Trojans, or weaponized PDFs.

An active malware scanning gateway is required before messaging attachments can be made servable.

## 2. Options Considered

- **Option 1**: Third-party cloud scanning API (e.g. VirusTotal API).
- **Option 2**: Host-installed binary `clamscan` executed via child process in Node.js worker.
- **Option 3**: **Dedicated Containerized ClamAV Daemon (`clamav/clamav:latest`) communicating with Worker over TCP port 3310 using streaming `zINSTREAM` protocol**.

## 3. Decision

**Adopt Option 3: Dedicated containerized ClamAV daemon (`clamav:latest`) listening on TCP port 3310, streamed to by the background worker using Node.js native `net` socket and `zINSTREAM` protocol.**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: VirusTotal API has strict rate limits, exposes confidential customer documents and contracts to external aggregators, and creates external SaaS dependency.
- _Option 2 Rejected_: Spawning `clamscan` child processes requires loading virus signature databases into memory on every scan, consuming 1–2GB of RAM and taking 5–10 seconds per scan.
- _Option 3 Selected_: The ClamAV daemon loads signatures into resident memory once on startup. Scanning via TCP streaming takes $<150\text{ms}$ for typical documents, does not require writing files to the worker container disk, and scales independently.

## 5. Consequences & Implications

- **Security**: Complete protection against malware and malicious attachments. Assets remain quarantined until verified clean.
- **Fail Closed**: If the ClamAV daemon is unreachable, the scan returns `ERROR`/`TIMEOUT`; the file remains quarantined and cannot be promoted to `ACTIVE`.
- **Infrastructure**: Adds `clamav` container to Docker Compose and Kubernetes deployments. Requires 1.5GB RAM allocated for signature databases.
