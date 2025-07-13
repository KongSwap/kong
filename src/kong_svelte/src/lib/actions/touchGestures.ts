/**
 * Touch Gesture Handler
 * Extracted from Navbar.svelte for better separation of concerns
 */

export interface TouchGestureOptions {
  swipeThreshold: number;
  edgeSwipeZone: number;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  enabled?: boolean;
}

export interface TouchGestureState {
  startX: number;
  startY: number;
  startTime: number;
  isTracking: boolean;
}

export function touchGestures(node: HTMLElement, options: TouchGestureOptions) {
  let state: TouchGestureState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    isTracking: false
  };

  const {
    swipeThreshold = 75,
    edgeSwipeZone = 50,
    onSwipeRight,
    onSwipeLeft,
    enabled = true
  } = options;

  function handleTouchStart(event: TouchEvent): void {
    if (!enabled || event.touches.length !== 1) return;

    const touch = event.touches[0];
    state = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isTracking: true
    };
  }

  function handleTouchMove(event: TouchEvent): void {
    if (!enabled || !state.isTracking || event.touches.length !== 1) return;

    // Optional: Add move tracking for more complex gestures
    // For now, we just track the start position
  }

  function handleTouchEnd(event: TouchEvent): void {
    if (!enabled || !state.isTracking || event.changedTouches.length !== 1) {
      state.isTracking = false;
      return;
    }

    const touch = event.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const deltaX = endX - state.startX;
    const deltaY = endY - state.startY;
    const deltaTime = Date.now() - state.startTime;

    // Reset tracking state
    state.isTracking = false;

    // Ignore if gesture took too long (> 500ms) or moved too much vertically
    if (deltaTime > 500 || Math.abs(deltaY) > 100) return;

    // Check for horizontal swipe
    if (Math.abs(deltaX) >= swipeThreshold) {
      if (deltaX > 0) {
        // Swipe right - only trigger if started from edge
        if (state.startX <= edgeSwipeZone && onSwipeRight) {
          onSwipeRight();
        }
      } else {
        // Swipe left
        if (onSwipeLeft) {
          onSwipeLeft();
        }
      }
    }
  }

  function handleTouchCancel(): void {
    state.isTracking = false;
  }

  // Add event listeners with passive flag for better performance
  node.addEventListener("touchstart", handleTouchStart, { passive: true });
  node.addEventListener("touchmove", handleTouchMove, { passive: true });
  node.addEventListener("touchend", handleTouchEnd, { passive: true });
  node.addEventListener("touchcancel", handleTouchCancel, { passive: true });

  return {
    update(newOptions: TouchGestureOptions) {
      // Update options - the handlers will use the new values
      Object.assign(options, newOptions);
    },
    
    destroy() {
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("touchcancel", handleTouchCancel);
    }
  };
}

// Helper to create gesture options from navigation config
export function createNavigationGestureOptions(
  onOpenMobileMenu: () => void,
  onCloseMobileMenu: () => void,
  mobileMenuOpen: boolean,
  swipeConfig: { threshold: number; edgeZone: number }
): TouchGestureOptions {
  return {
    swipeThreshold: swipeConfig.threshold,
    edgeSwipeZone: swipeConfig.edgeZone,
    onSwipeRight: mobileMenuOpen ? undefined : onOpenMobileMenu,
    onSwipeLeft: mobileMenuOpen ? onCloseMobileMenu : undefined,
    enabled: true
  };
}