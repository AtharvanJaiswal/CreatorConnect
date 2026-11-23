import { describe, it, expect } from 'vitest';
import { MockStoragePurgeService } from './external-storage-purge.service.js';

describe('ExternalDataPurgeService — Object Storage Purge & Prefix Isolation', () => {
  it('purges original assets, thumbnail, and preview derivatives for a specific user', async () => {
    const storage = new MockStoragePurgeService();
    const userA = 'user-01a208d3-0001';
    const userB = 'user-01a208d3-0002';

    // Populate storage objects
    storage.storedObjects.set(`users/${userA}/avatar.png`, {
      buffer: Buffer.from('user-a-avatar'),
    });
    storage.storedObjects.set(`users/${userA}/kyc-document.pdf`, {
      buffer: Buffer.from('user-a-kyc'),
    });
    storage.storedObjects.set(`users/${userA}/portfolio-item-1.jpg`, {
      buffer: Buffer.from('user-a-portfolio'),
    });
    storage.storedObjects.set(`users/${userA}/portfolio-item-1.jpg.thumb`, {
      buffer: Buffer.from('user-a-thumb'),
    });

    // Another user's files
    storage.storedObjects.set(`users/${userB}/avatar.png`, {
      buffer: Buffer.from('user-b-avatar'),
    });
    storage.storedObjects.set(`users/${userB}/portfolio.jpg`, {
      buffer: Buffer.from('user-b-portfolio'),
    });

    // Multipart upload in progress
    storage.activeMultipartUploads.set(`users/${userA}/large-video.mp4`, 'upload-id-123');
    storage.activeMultipartUploads.set(`users/${userB}/large-video.mp4`, 'upload-id-456');

    // Execute purge for User A
    const result = await storage.purgeUserAssets(userA);

    expect(result.userId).toBe(userA);
    expect(result.purgedCount).toBe(4);
    expect(result.multipartUploadsAborted).toBe(1);

    // Verify User A files are gone
    expect(storage.storedObjects.has(`users/${userA}/avatar.png`)).toBe(false);
    expect(storage.storedObjects.has(`users/${userA}/kyc-document.pdf`)).toBe(false);
    expect(storage.storedObjects.has(`users/${userA}/portfolio-item-1.jpg`)).toBe(false);
    expect(storage.storedObjects.has(`users/${userA}/portfolio-item-1.jpg.thumb`)).toBe(false);
    expect(storage.activeMultipartUploads.has(`users/${userA}/large-video.mp4`)).toBe(false);

    // CRITICAL: Verify User B files are completely untouched (Prefix Isolation)
    expect(storage.storedObjects.has(`users/${userB}/avatar.png`)).toBe(true);
    expect(storage.storedObjects.has(`users/${userB}/portfolio.jpg`)).toBe(true);
    expect(storage.activeMultipartUploads.has(`users/${userB}/large-video.mp4`)).toBe(true);
  });

  it('is strictly idempotent on repeated executions', async () => {
    const storage = new MockStoragePurgeService();
    const userId = 'user-01a208d3-idempotent';

    storage.storedObjects.set(`users/${userId}/doc.pdf`, {
      buffer: Buffer.from('test-doc'),
    });

    // Run 1
    const run1 = await storage.purgeUserAssets(userId);
    expect(run1.purgedCount).toBe(1);

    // Run 2 (no objects remain)
    const run2 = await storage.purgeUserAssets(userId);
    expect(run2.purgedCount).toBe(0);
    expect(run2.multipartUploadsAborted).toBe(0);
  });
});
