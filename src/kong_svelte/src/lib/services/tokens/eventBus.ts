import { writable } from 'svelte/store';

type EventCallback = (...args: any[]) => void;

interface EventBus {
  on(event: string, callback: EventCallback): void;
  emit(event: string, ...args: any[]): void;
}

class EventBusImpl implements EventBus {
  private events: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => callback(...args));
    }
  }
}

export const eventBus: EventBus = new EventBusImpl(); 