/**
 * Utility functions for managing body scroll behavior
 * Useful for modals, overlays, and other components that need to prevent background scrolling
 */

interface ScrollState {
  scrollY: number;
  isDisabled: boolean;
}

let scrollState: ScrollState = {
  scrollY: 0,
  isDisabled: false
};

/**
 * Disables body scrolling and saves the current scroll position
 * This prevents the background from scrolling when modals or overlays are open
 */
export function disableBodyScroll(): void {
  // Avoid multiple calls
  if (scrollState.isDisabled) {
    return;
  }

  const body = document.body;
  scrollState.scrollY = window.scrollY;
  scrollState.isDisabled = true;

  // Apply styles to prevent scrolling
  body.style.position = 'fixed';
  body.style.top = `-${scrollState.scrollY}px`;
  body.style.width = '100%';
  body.style.overflow = 'hidden';
}

/**
 * Enables body scrolling and restores the previous scroll position
 * This restores normal scrolling behavior when modals or overlays are closed
 */
export function enableBodyScroll(): void {
  // Avoid multiple calls or calls when not disabled
  if (!scrollState.isDisabled) {
    return;
  }

  const body = document.body;
  const savedScrollY = scrollState.scrollY;

  // Restore original styles
  body.style.position = '';
  body.style.top = '';
  body.style.width = '';
  body.style.overflow = '';

  // Restore scroll position
  window.scrollTo(0, savedScrollY);

  // Reset state
  scrollState.isDisabled = false;
  scrollState.scrollY = 0;
}

/**
 * Creates a scroll manager that automatically handles cleanup
 * Returns a cleanup function that should be called when the component is unmounted
 * 
 * @returns cleanup function
 */
export function createScrollManager(): () => void {
  disableBodyScroll();
  
  return () => {
    enableBodyScroll();
  };
}

/**
 * Custom hook-like function for Svelte components
 * Automatically disables scroll on creation and provides cleanup
 * 
 * Usage in onMount:
 * const cleanupScroll = useScrollLock();
 * 
 * Usage in onDestroy:
 * cleanupScroll();
 */
export function useScrollLock(): () => void {
  return createScrollManager();
}

/**
 * Checks if body scrolling is currently disabled
 */
export function isBodyScrollDisabled(): boolean {
  return scrollState.isDisabled;
} 