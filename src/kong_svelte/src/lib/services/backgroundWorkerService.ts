import { writable, get, type Writable } from 'svelte/store';

// Types
type WorkerId = string;
type TaskId = string;
type WorkerTask<T = any, R = any> = {
  id: TaskId;
  type: string;
  data: T;
  callback?: (result: R) => void;
  errorCallback?: (error: any) => void;
};

type WorkerState = {
  active: boolean;
  tasks: Map<TaskId, WorkerTask>;
  worker: Worker | null;
};

// Store to track all worker instances
const workers: Map<WorkerId, Writable<WorkerState>> = new Map();

/**
 * Create or get a background worker
 * @param id Unique identifier for the worker
 * @returns Worker store
 */
export function getWorker(id: WorkerId = 'default'): Writable<WorkerState> {
  if (!workers.has(id)) {
    const store = writable<WorkerState>({
      active: false,
      tasks: new Map(),
      worker: null
    });
    workers.set(id, store);
  }
  return workers.get(id)!;
}

/**
 * Initialize a worker with a specific script
 * @param workerId Worker identifier
 * @param scriptPath Path to the worker script
 * @returns Promise that resolves when worker is initialized
 */
export function initWorker(workerId: WorkerId = 'default', scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const workerStore = getWorker(workerId);
      const currentState = get(workerStore);
      
      // Don't reinitialize if already active
      if (currentState.active && currentState.worker) {
        resolve();
        return;
      }

      const worker = new Worker(scriptPath);
      
      worker.onmessage = (event) => {
        const { taskId, type, result, error } = event.data;
        
        if (type === 'init') {
          resolve();
          return;
        }
        
        workerStore.update(state => {
          const task = state.tasks.get(taskId);
          if (task) {
            if (error) {
              task.errorCallback?.(error);
            } else {
              task.callback?.(result);
            }
            state.tasks.delete(taskId);
          }
          return state;
        });
      };
      
      worker.onerror = (error) => {
        console.error('Worker error:', error);
        reject(error);
      };
      
      workerStore.update(state => ({
        ...state,
        active: true,
        worker
      }));
      
      // Send initialization message
      worker.postMessage({ type: 'init' });
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      reject(error);
    }
  });
}

/**
 * Run a task in the background worker
 * @param type Task type identifier
 * @param data Data to pass to the worker
 * @param workerId Worker identifier
 * @returns Promise that resolves with the task result
 */
export function runInBackground<T = any, R = any>(
  type: string,
  data: T,
  workerId: WorkerId = 'default'
): Promise<R> {
  return new Promise((resolve, reject) => {
    const workerStore = getWorker(workerId);
    const state = get(workerStore);
    
    if (!state.active || !state.worker) {
      reject(new Error('Worker not initialized'));
      return;
    }
    
    const taskId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: WorkerTask<T, R> = {
      id: taskId,
      type,
      data,
      callback: resolve,
      errorCallback: reject
    };
    
    workerStore.update(state => {
      state.tasks.set(taskId, task);
      return state;
    });
    
    state.worker.postMessage({
      taskId,
      type,
      data
    });
  });
}

/**
 * Terminate a worker
 * @param workerId Worker identifier
 */
export function terminateWorker(workerId: WorkerId = 'default'): void {
  const workerStore = getWorker(workerId);
  const state = get(workerStore);
  
  if (state.worker) {
    state.worker.terminate();
    workerStore.update(state => ({
      ...state,
      active: false,
      worker: null
    }));
  }
}

/**
 * Terminate all active workers
 */
export function terminateAllWorkers(): void {
  workers.forEach((_, workerId) => {
    terminateWorker(workerId);
  });
} 