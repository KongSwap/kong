type EventCallback = (...args: any[]) => void;

class EventEmitter {
  private events: { [key: string]: EventCallback[] } = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(...args));
  }
}

export const eventBus = new EventEmitter();

export const Events = {
  WALLET_CONNECTED: 'wallet-connected',
  WALLET_DISCONNECTED: 'wallet-disconnected',
  BALANCES_UPDATED: 'balances-updated',
  POOLS_UPDATED: 'pools-updated',
  TOKENS_UPDATED: 'tokens-updated'
} as const; 
