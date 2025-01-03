import { loadTokens } from '$lib/services/tokens';
import * as Comlink from 'comlink';

export interface StateWorkerApi {
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
}

class StateWorkerImpl implements StateWorkerApi {
  private tokenInterval: number | null = null;
  private poolInterval: number | null = null;
  protected isPaused = false;
  
  // ----------------------------------------------------
  // 1) Lower intervals to allow more frequent updates
  // ----------------------------------------------------
  private readonly ACTIVE_TOKEN_INTERVAL = 5000;          // 5 seconds when active
  private readonly BACKGROUND_TOKEN_INTERVAL = 10000;     // 10 seconds when in background
  private readonly ACTIVE_POOL_INTERVAL = 5000;          // 5 seconds when active
  private readonly BACKGROUND_POOL_INTERVAL = 10000;      // 10 seconds when in background

  // ----------------------------------------------------
  // 2) Throttle settings to prevent duplicate requests
  // ----------------------------------------------------
  private readonly TOKEN_UPDATE_THROTTLE = 4000; // Don't post token updates more often than every 4s
  private readonly POOL_UPDATE_THROTTLE  = 4000; // Don't post pool updates more often than every 4s

  // ----------------------------------------------------
  // 3) Track whether an update is already in progress
  //    and store the time of the last update
  // ----------------------------------------------------
  private tokenUpdateInProgress = false;
  private poolUpdateInProgress  = false;
  private lastTokenUpdate       = 0;
  private lastPoolUpdate        = 0;

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
    if (this.poolInterval)  clearInterval(this.poolInterval);
    this.tokenInterval = null;
    this.poolInterval  = null;
  }

  // -------------------------------------------------------------------
  // Schedules recurring token updates based on whether we're paused
  // -------------------------------------------------------------------
  private scheduleTokenUpdates(): void {
    if (this.tokenInterval) {
      clearInterval(this.tokenInterval);
    }

    const interval = this.isPaused
      ? this.BACKGROUND_TOKEN_INTERVAL
      : this.ACTIVE_TOKEN_INTERVAL;

    this.tokenInterval = self.setInterval(() => {
      if (!this.isPaused) {
        this.postTokenUpdate();
      }
    }, interval);
  }

  // -------------------------------------------------------------------
  // Schedules recurring pool updates based on whether we're paused
  // -------------------------------------------------------------------
  private schedulePoolUpdates(): void {
    if (this.poolInterval) {
      clearInterval(this.poolInterval);
    }

    const interval = this.isPaused
      ? this.BACKGROUND_POOL_INTERVAL
      : this.ACTIVE_POOL_INTERVAL;

    this.poolInterval = self.setInterval(() => {
      if (!this.isPaused) {
        this.postPoolUpdate();
      }
    }, interval);
  }

  // -------------------------------------------------------------------
  // Throttled + “in-progress” check for token updates
  // -------------------------------------------------------------------
  private postTokenUpdate() {
    console.log("postTokenUpdate");
    // If we're already updating tokens, skip
    if (this.tokenUpdateInProgress) {
      console.warn("Skipping token update – already in progress.");
      return;
    }
    // If we updated tokens recently, skip
    const now = Date.now();
    if (now - this.lastTokenUpdate < this.TOKEN_UPDATE_THROTTLE) {
      console.warn("Skipping token update – too soon since last update.");
      return;
    }

    this.tokenUpdateInProgress = true;
    try {
      // Load tokens first to ensure we have fresh data
      loadTokens(true).catch(error => {
        console.error("Error loading tokens:", error);
      });
      
      // Post message to main thread to trigger balance updates
      self.postMessage({ type: 'token_update', timestamp: now });
      console.log("Token update message posted");
    } catch (error) {
      console.error("Error in postTokenUpdate:", error);
    } finally {
      // Mark completion
      this.lastTokenUpdate = now;
      this.tokenUpdateInProgress = false;
    }
  }

  // -------------------------------------------------------------------
  // Throttled + “in-progress” check for pool updates
  // -------------------------------------------------------------------
  private postPoolUpdate() {
    if (this.poolUpdateInProgress) {
      console.warn("Skipping pool update – already in progress.");
      return;
    }
    const now = Date.now();
    if (now - this.lastPoolUpdate < this.POOL_UPDATE_THROTTLE) {
      console.warn("Skipping pool update – too soon since last update.");
      return;
    }

    this.poolUpdateInProgress = true;
    // As with tokens, here we just post a message to the main thread:
    self.postMessage({ type: 'pool_update' });

    this.lastPoolUpdate = Date.now();
    this.poolUpdateInProgress = false;
  }

  // -------------------------------------------------------------------
  // Pause & resume simply clear or restore intervals
  // -------------------------------------------------------------------
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

// Listen for pause/resume from the main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'pause') {
    workerInstance.pause();
  } else if (event.data.type === 'resume') {
    workerInstance.resume();
  }
});

// Expose the instance via Comlink
Comlink.expose(workerInstance); 