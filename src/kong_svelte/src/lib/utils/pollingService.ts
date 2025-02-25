export type PollingTask = {
  callback: () => Promise<void> | void;
  interval: number;
  immediate?: boolean;
  timerId?: ReturnType<typeof setInterval>;
};

const tasks: Record<string, PollingTask> = {};

export function startPolling(
  key: string,
  callback: () => Promise<void> | void,
  interval: number,
  immediate = true
): void {
  // If a task with this key already exists, clear it first
  if (tasks[key]?.timerId) {
    clearInterval(tasks[key].timerId);
  }
  
  tasks[key] = { callback, interval, immediate };

  if (immediate) {
    callback();
  }
  
  tasks[key].timerId = setInterval(callback, interval);
}

export function stopPolling(key: string): void {
  if (tasks[key]?.timerId) {
    clearInterval(tasks[key].timerId);
    delete tasks[key];
  }
}

export function stopAllPolling(): void {
  Object.keys(tasks).forEach((key) => {
    if (tasks[key]?.timerId) {
      clearInterval(tasks[key].timerId);
    }
    delete tasks[key];
  });
} 