// Polyfills for browser compatibility
// Only run in browser environment
if (typeof window !== 'undefined' && !window.Buffer) {
  // Use dynamic import to avoid SSR issues
  import('buffer').then(({ Buffer }) => {
    window.Buffer = Buffer;
    (window as any).global = window;
    (globalThis as any).Buffer = Buffer;
  });
}