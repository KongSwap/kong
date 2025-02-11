
type EventCallback = (...args: any[]) => void;

interface EventBus {
  on(event: string, callback: EventCallback): void;
  emit(event: string, ...args: any[]): void;
  off(event: string, callback: EventCallback): void;
  getListenerCounts(): { [key: string]: number };
  removeAllListeners(): void;
}

class EventBusImpl implements EventBus {
  private events: { [key: string]: EventCallback[] } = {};
  private listenerCounts: { [key: string]: number } = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
      this.listenerCounts[event] = 0;
    }
    this.events[event].push(callback);
    this.listenerCounts[event]++;

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  off(event: string, callback: EventCallback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
      this.listenerCounts[event]--;
      
      // Cleanup empty event arrays
      if (this.events[event].length === 0) {
        delete this.events[event];
        delete this.listenerCounts[event];
      }
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  // Debug method to check for potential memory leaks
  getListenerCounts() {
    return { ...this.listenerCounts };
  }

  // Remove all listeners for cleanup
  removeAllListeners() {
    this.events = {};
    this.listenerCounts = {};
  }
}

export const eventBus: EventBus = new EventBusImpl(); 