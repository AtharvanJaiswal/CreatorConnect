import type { ClaimedOutboxEvent } from '@creatorconnect/database';
import type { IEventDispatcher, DispatchResult } from './event-dispatcher.js';

/**
 * Dispatches an outbox event to multiple event dispatchers / handlers sequentially.
 * If any dispatcher fails, execution halts and returns the failure to trigger outbox retry or DLQ.
 */
export class CompositeEventDispatcher implements IEventDispatcher {
  private readonly dispatchers: IEventDispatcher[];

  constructor(dispatchers: IEventDispatcher[]) {
    this.dispatchers = dispatchers;
  }

  async dispatch(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    for (const dispatcher of this.dispatchers) {
      const result = await dispatcher.dispatch(event);
      if (!result.success) {
        return result;
      }
    }
    return { success: true };
  }
}
