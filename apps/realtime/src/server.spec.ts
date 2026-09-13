import { describe, it, expect, afterAll } from 'vitest';
import { createRealtimeServer } from './server.js';

describe('Realtime Service', () => {
  let instance: Awaited<ReturnType<typeof createRealtimeServer>>;

  afterAll(async () => {
    if (instance) {
      await instance.close();
    }
  });

  it('initializes and responds to /health probe', async () => {
    instance = await createRealtimeServer();
    const response = await instance.app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe('ok');
    expect(data.connections).toBe(0);
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });
});
