import { Redis } from 'ioredis';
import { Emitter } from '@socket.io/redis-emitter';
import type { Logger } from 'pino';
import { RedisBlockEvictionService } from './redis-block-eviction.service.js';
import type { PrismaClient } from '@creatorconnect/database';

export interface RealtimeBridgeOptions {
  redisUrl: string;
  logger?: Logger | undefined;
  keyPrefix?: string | undefined;
  prisma?: PrismaClient | undefined;
}

export interface RealtimeBridgeHealth {
  status: 'connected' | 'connecting' | 'disconnected';
  redisStatus: string;
  clusterReady: boolean;
  timestamp: string;
}

export interface IRealtimeBridge {
  readonly emitter: Emitter;
  readonly evictionService: RedisBlockEvictionService;
  connect(): Promise<void>;
  getHealth(): RealtimeBridgeHealth;
  close(): Promise<void>;
}

/**
 * Worker-to-Realtime Redis Bridge.
 * Establishes an authenticated connection to the shared Redis cluster using ioredis,
 * initializes @socket.io/redis-emitter for cross-node event broadcasting and room control,
 * and exposes lifecycle and diagnostic health state.
 */
export class RealtimeBridge implements IRealtimeBridge {
  private readonly redisClient: Redis;
  private readonly _emitter: Emitter;
  private readonly _evictionService: RedisBlockEvictionService;
  private readonly logger?: Logger | undefined;
  private isClosed = false;

  constructor(options: RealtimeBridgeOptions) {
    this.logger = options.logger;

    this.redisClient = new Redis(options.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.redisClient.on('error', (err) => {
      this.logger?.warn({ err: err?.message }, 'Realtime bridge Redis connection warning');
    });

    this.redisClient.on('connect', () => {
      this.logger?.info('Realtime bridge Redis client connected');
    });

    this.redisClient.on('ready', () => {
      this.logger?.info('Realtime bridge Redis client ready for cluster pub/sub operations');
    });

    this._emitter = new Emitter(this.redisClient, {
      key: options.keyPrefix || 'socket.io',
    });

    this._evictionService = new RedisBlockEvictionService({
      emitter: this._emitter,
      prisma: options.prisma,
      logger: this.logger,
    });
  }

  get emitter(): Emitter {
    return this._emitter;
  }

  get evictionService(): RedisBlockEvictionService {
    return this._evictionService;
  }

  async connect(): Promise<void> {
    if (this.redisClient.status === 'ready' || this.redisClient.status === 'connecting') {
      return;
    }
    await this.redisClient.connect();
  }

  getHealth(): RealtimeBridgeHealth {
    const status = this.isClosed ? 'end' : this.redisClient.status;
    const isReady = !this.isClosed && status === 'ready';
    return {
      status: isReady
        ? 'connected'
        : status === 'connecting' || status === 'reconnecting'
          ? 'connecting'
          : 'disconnected',
      redisStatus: status,
      clusterReady: isReady,
      timestamp: new Date().toISOString(),
    };
  }

  async close(): Promise<void> {
    this.isClosed = true;
    try {
      if (this.redisClient.status !== 'end') {
        await this.redisClient.quit();
      }
    } catch {
      this.redisClient.disconnect();
    }
    this.logger?.info('Realtime bridge closed cleanly');
  }
}
