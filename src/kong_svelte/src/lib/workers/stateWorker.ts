import * as Comlink from 'comlink';

export interface StateWorkerApi {
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
}

class StateWorkerImpl implements StateWorkerApi {
  private tokenInterval: number | null = null;
  private poolInterval: number | null = null;
  protected isPaused = false;
  
  // Adjust intervals based on visibility
  private readonly ACTIVE_TOKEN_INTERVAL = 15000;    // 15 seconds when active
  private readonly BACKGROUND_TOKEN_INTERVAL = 60000; // 60 seconds when in background
  private readonly ACTIVE_POOL_INTERVAL = 20000;     // 15 seconds when active
  private readonly BACKGROUND_POOL_INTERVAL = 60000;  // 60 seconds when in background

  async startUpdates(): Promise<void> {
    this.scheduleTokenUpdates();
    this.schedulePoolUpdates();
    // Trigger immediate updates if not paused
    if (!this.isPaused) {
      this.postTokenUpdate();
      this.postPoolUpdate();
    }
  }

  async stopUpdates(): Promise<void> {
    if (this.tokenInterval) clearInterval(this.tokenInterval);
    if (this.poolInterval) clearInterval(this.poolInterval);
    this.tokenInterval = null;
    this.poolInterval = null;
  }

  private scheduleTokenUpdates(): void {
    if (this.tokenInterval) {
      clearInterval(this.tokenInterval);
    }
    
    const interval = this.isPaused ? 
      this.BACKGROUND_TOKEN_INTERVAL : 
      this.ACTIVE_TOKEN_INTERVAL;

    this.tokenInterval = self.setInterval(() => {
      if (!this.isPaused) {
        this.postTokenUpdate();
      }
    }, interval);
  }

  private schedulePoolUpdates(): void {
    if (this.poolInterval) {
      clearInterval(this.poolInterval);
    }
    
    const interval = this.isPaused ? 
      this.BACKGROUND_POOL_INTERVAL : 
      this.ACTIVE_POOL_INTERVAL;

    this.poolInterval = self.setInterval(() => {
      if (!this.isPaused) {
        this.postPoolUpdate();
      }
    }, interval);
  }

  private postTokenUpdate() {
    self.postMessage({ type: 'token_update' });
  }

  private postPoolUpdate() {
    self.postMessage({ type: 'pool_update' });
  }

  public pause(): void {
    this.isPaused = true;
    this.tokenInterval && clearInterval(this.tokenInterval);
    this.poolInterval && clearInterval(this.poolInterval);
  }

  public resume(): void {
    this.isPaused = false;
    this.scheduleTokenUpdates();
    this.schedulePoolUpdates();
  }
}

// Create a single instance
const workerInstance = new StateWorkerImpl();

// Update message handler to use instance methods
self.addEventListener('message', (event) => {
  if (event.data.type === 'pause') {
    workerInstance.pause();
  } else if (event.data.type === 'resume') {
    workerInstance.resume();
  }
});

// Expose the instance instead of creating a new one
Comlink.expose(workerInstance); 