import type { ClaimedOutboxEvent } from '@creatorconnect/database';

export interface DispatchResult {
  success: boolean;
  error?: string;
  isTransient?: boolean;
}

export interface IEventDispatcher {
  dispatch(event: ClaimedOutboxEvent): Promise<DispatchResult>;
}

export class NoOpEventDispatcher implements IEventDispatcher {
  public dispatchedEvents: ClaimedOutboxEvent[] = [];

  async dispatch(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    this.dispatchedEvents.push(event);
    return { success: true };
  }
}

export * from './socket-io-dispatcher.js';
export * from './composite-event-dispatcher.js';
export * from './block-eviction-dispatcher.js';
export * from './redis-block-eviction.service.js';
export * from './realtime-bridge.js';
