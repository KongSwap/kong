import type { Action } from 'svelte/action';

interface AutoFitTextOptions {
  minFontSize?: number;
  maxFontSize?: number;
  baseSizes?: {
    default: string;
    sm?: string;
    md?: string;
    lg?: string;
  };
  debug?: boolean;
  debounceMs?: number;
}

// Shared canvas for text measurement to avoid creating new ones
let measurementCanvas: HTMLCanvasElement | null = null;
let measurementContext: CanvasRenderingContext2D | null = null;

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
    measurementContext = measurementCanvas.getContext('2d');
  }
  return measurementContext;
}

export const autoFitText: Action<HTMLInputElement, AutoFitTextOptions> = (
  node,
  options = {}
) => {
  const {
    minFontSize = 12,
    maxFontSize = 48,
    baseSizes = {
      default: '1.25rem', // text-xl
      sm: '1.5rem',       // sm:text-2xl
      md: '1.875rem',     // md:text-3xl
    },
    debug = false,
    debounceMs = 50
  } = options;

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let animationFrame: number | null = null;
  let isAdjusting = false;
  let lastValue = '';
  let lastContainerWidth = 0;
  let overflowCheckTimer: ReturnType<typeof setTimeout> | null = null;

  const measureTextWidth = (text: string, font: string): number => {
    const context = getMeasurementContext();
    if (!context) return 0;
    
    context.font = font;
    const metrics = context.measureText(text);
    return metrics.width;
  };

  const getResponsiveFontSize = (): number => {
    const width = window.innerWidth;
    
    if (width >= 768) { // md breakpoint
      return parseFloat(baseSizes.md || baseSizes.default);
    } else if (width >= 640) { // sm breakpoint
      return parseFloat(baseSizes.sm || baseSizes.default);
    }
    
    return parseFloat(baseSizes.default);
  };

  const performAdjustment = () => {
    // Prevent concurrent adjustments
    if (isAdjusting) return;
    isAdjusting = true;

    try {
      const parentContainer = node.parentElement;
      if (!parentContainer) {
        isAdjusting = false;
        return;
      }
      
      const containerWidth = parentContainer.offsetWidth;
      const value = node.value || node.placeholder || '';
      
      // Skip if nothing changed
      if (value === lastValue && containerWidth === lastContainerWidth) {
        isAdjusting = false;
        return;
      }
      
      lastValue = value;
      lastContainerWidth = containerWidth;
      
      if (debug) {
        console.log('AutoFitText Debug:', {
          value,
          containerWidth,
          inputWidth: node.offsetWidth,
          clientWidth: node.clientWidth,
          parentWidth: parentContainer.offsetWidth,
          scrollWidth: node.scrollWidth
        });
      }
      
      if (!value || containerWidth === 0) {
        node.style.fontSize = '';
        isAdjusting = false;
        return;
      }

      const computedStyle = window.getComputedStyle(node);
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
      const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
      const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
      
      // Use parent container width and leave some margin for safety
      const availableWidth = containerWidth - paddingLeft - paddingRight - borderLeft - borderRight - 8; // -8 for safety margin

      const baseFontSize = getResponsiveFontSize();
      let fontSize = baseFontSize * 16; // Convert rem to px
      fontSize = Math.min(fontSize, maxFontSize);

      const fontFamily = computedStyle.fontFamily;
      const fontWeight = computedStyle.fontWeight;

      // Binary search for optimal font size
      let low = minFontSize;
      let high = fontSize;
      let optimal = fontSize;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const font = `${fontWeight} ${mid}px ${fontFamily}`;
        const textWidth = measureTextWidth(value, font);

        if (textWidth <= availableWidth) {
          optimal = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (debug) {
        console.log('Font size calculation:', {
          availableWidth,
          baseFontSize: fontSize,
          optimal,
          textWidth: measureTextWidth(value, `${fontWeight} ${optimal}px ${fontFamily}`)
        });
      }

      // Apply font size without transition to prevent visual glitches
      node.style.fontSize = `${optimal}px`;
      
      // Schedule a single overflow check
      if (overflowCheckTimer) {
        clearTimeout(overflowCheckTimer);
      }
      
      overflowCheckTimer = setTimeout(() => {
        if (node.scrollWidth > node.clientWidth + 2) { // +2 for rounding errors
          if (debug) {
            console.log('Overflow detected, reducing font size', {
              scrollWidth: node.scrollWidth,
              clientWidth: node.clientWidth
            });
          }
          // Reduce font size by 1px if overflow detected
          const currentSize = parseFloat(node.style.fontSize);
          if (currentSize > minFontSize) {
            node.style.fontSize = `${currentSize - 1}px`;
          }
        }
        overflowCheckTimer = null;
      }, 50);
      
    } finally {
      isAdjusting = false;
    }
  };

  const scheduleAdjustment = () => {
    // Clear any pending timers
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    // Schedule new adjustment
    debounceTimer = setTimeout(() => {
      animationFrame = requestAnimationFrame(performAdjustment);
    }, debounceMs);
  };

  // Set up event listeners
  const handleInput = () => scheduleAdjustment();
  const handleResize = () => scheduleAdjustment();

  node.addEventListener('input', handleInput);
  window.addEventListener('resize', handleResize);

  // Observe container size changes
  resizeObserver = new ResizeObserver(() => scheduleAdjustment());
  if (node.parentElement) {
    resizeObserver.observe(node.parentElement);
  }

  // Observe value changes for readonly inputs
  mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
        scheduleAdjustment();
      }
    }
  });
  
  mutationObserver.observe(node, {
    attributes: true,
    attributeFilter: ['value']
  });

  // Watch for programmatic value changes
  const originalValueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (originalValueDescriptor) {
    Object.defineProperty(node, 'value', {
      get() {
        return originalValueDescriptor.get?.call(this);
      },
      set(newValue) {
        originalValueDescriptor.set?.call(this, newValue);
        scheduleAdjustment();
      },
      configurable: true
    });
  }

  // Initial adjustment
  scheduleAdjustment();

  return {
    update(newOptions: AutoFitTextOptions = {}) {
      Object.assign(options, newOptions);
      scheduleAdjustment();
    },
    destroy() {
      // Clear all timers
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (overflowCheckTimer) {
        clearTimeout(overflowCheckTimer);
      }
      
      // Disconnect observers
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      
      // Remove event listeners
      node.removeEventListener('input', handleInput);
      window.removeEventListener('resize', handleResize);
      
      // Clear styles
      node.style.fontSize = '';
      
      // Restore original value descriptor
      if (originalValueDescriptor) {
        Object.defineProperty(node, 'value', originalValueDescriptor);
      }
    }
  };
};