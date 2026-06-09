import type { AgentEvent } from './events';

export type AgentEventListener = (event: AgentEvent) => void;

export class EventBus {
  private listeners = new Set<AgentEventListener>();

  publish(event: AgentEvent) {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: AgentEventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
