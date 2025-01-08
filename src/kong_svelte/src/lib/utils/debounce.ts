export function debounce<T>(fn: (val?: T) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (val?: T) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(val), delay);
  };
} 