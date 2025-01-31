// src/kong_svelte/src/lib/actions/tooltip.ts

export interface TooltipOptions {
  text?: string;
  html?: HTMLElement;
  paddingClass?: string;
  background?: string;
  direction?: 'top' | 'bottom' | 'left' | 'right';
  textSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
}

/**
 * Tooltip Action
 * Displays a tooltip with the provided text or HTML content.
 * If both text and HTML are empty/null, the tooltip will not be shown.
 *
 * @param node - The HTML element to attach the tooltip to.
 * @param options - Configuration options for the tooltip.
 */
export function tooltip(node: HTMLElement, options: TooltipOptions = { direction: 'top' }) {
  let tooltipEl: HTMLElement | null = null;

  /**
   * Determines whether the tooltip should be shown based on provided options.
   * @returns {boolean} - True if tooltip should be shown, false otherwise.
   */
  const shouldShowTooltip = (): boolean => {
    if (options.html) {
      return true;
    }
    if (options.text && options.text.trim() !== '') {
      return true;
    }
    return false;
  };

  /**
   * Creates an arrow element with the correct direction
   */
  const createArrow = (direction: 'top' | 'bottom' | 'left' | 'right' = 'top') => {
    const arrow = document.createElement('div');
    arrow.classList.add(
      'absolute',
      'w-0',
      'h-0',
      'border-solid'
    );

    // Set arrow position and border based on direction
    switch (direction) {
      case 'bottom':
        arrow.classList.add('-top-2', 'left-1/2', '-translate-x-1/2');
        arrow.style.borderWidth = '0 8px 8px 8px';
        arrow.style.borderColor = 'transparent transparent var(--tooltip-bg) transparent';
        break;
      case 'top':
        arrow.classList.add('-bottom-2', 'left-1/2', '-translate-x-1/2');
        arrow.style.borderWidth = '8px 8px 0 8px';
        arrow.style.borderColor = 'var(--tooltip-bg) transparent transparent transparent';
        break;
      case 'left':
        arrow.classList.add('-right-2', 'top-1/2', '-translate-y-1/2');
        arrow.style.borderWidth = '8px 0 8px 8px';
        arrow.style.borderColor = 'transparent transparent transparent var(--tooltip-bg)';
        break;
      case 'right':
        arrow.classList.add('-left-2', 'top-1/2', '-translate-y-1/2');
        arrow.style.borderWidth = '8px 8px 8px 0';
        arrow.style.borderColor = 'transparent var(--tooltip-bg) transparent transparent';
        break;
    }

    return arrow;
  };

  /**
   * Positions the tooltip based on direction
   */
  const positionTooltip = () => {
    if (!tooltipEl) return;
    const rect = node.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const direction = options.direction || 'top';
    const spacing = 12; // Space between tooltip and element

    let top = 0;
    let left = 0;

    switch (direction) {
      case 'top':
        top = rect.top - tooltipRect.height - spacing;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = rect.bottom + spacing;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + spacing;
        break;
    }

    // Boundary checking
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }

    tooltipEl.style.top = `${top + window.scrollY}px`;
    tooltipEl.style.left = `${left + window.scrollX}px`;
  };

  /**
   * Creates and displays the tooltip.
   */
  const showTooltip = () => {
    if (tooltipEl || !shouldShowTooltip()) return;

    tooltipEl = document.createElement('div');
    tooltipEl.classList.add(
      'absolute',
      'z-50',
      'rounded',
      'shadow-lg',
      'pointer-events-none',
      'transition-opacity',
      'duration-200',
      'opacity-0',
      'text-white',
      'max-w-xs',
      options.textSize ? `text-${options.textSize}` : 'text-sm'
    );

    // Set tooltip background color as CSS variable for arrow
    const bgColor = options.background ? 
      getComputedStyle(document.documentElement).getPropertyValue(`--${options.background.replace('bg-', '')}`) :
      'rgba(0, 0, 0, 0.75)';
    tooltipEl.style.setProperty('--tooltip-bg', bgColor);

    // Apply background
    if (options.background) {
      tooltipEl.classList.add(options.background);
    } else {
      tooltipEl.classList.add('bg-black', 'bg-opacity-75');
    }

    // Apply padding
    if (options.paddingClass) {
      tooltipEl.classList.add(options.paddingClass);
    } else {
      tooltipEl.classList.add('p-2');
    }

    // Add content
    if (options.html) {
      tooltipEl.appendChild(options.html);
    } else if (options.text) {
      tooltipEl.textContent = options.text;
    }

    // Add directional arrow
    const arrow = createArrow(options.direction);
    tooltipEl.appendChild(arrow);

    document.body.appendChild(tooltipEl);
    positionTooltip();

    requestAnimationFrame(() => {
      tooltipEl?.classList.remove('opacity-0');
      tooltipEl?.classList.add('opacity-100');
    });
  };

  /**
   * Hides and removes the tooltip from the DOM.
   */
  const hideTooltip = () => {
    if (tooltipEl) {
      tooltipEl.classList.remove('opacity-100');
      tooltipEl.classList.add('opacity-0');
      
      // Remove immediately if component is being destroyed
      if (tooltipEl && tooltipEl.parentNode) {
        tooltipEl.parentNode.removeChild(tooltipEl);
        tooltipEl = null;
      }
    }
  };

  // Event listeners
  node.addEventListener('mouseenter', showTooltip);
  node.addEventListener('mouseleave', hideTooltip);
  node.addEventListener('focusin', showTooltip);
  node.addEventListener('focusout', hideTooltip);
  window.addEventListener('scroll', positionTooltip);
  window.addEventListener('resize', positionTooltip);

  // Return destroy function directly instead of using onDestroy
  return {
    destroy() {
      hideTooltip();
      node.removeEventListener('mouseenter', showTooltip);
      node.removeEventListener('mouseleave', hideTooltip);
      node.removeEventListener('focusin', showTooltip);
      node.removeEventListener('focusout', hideTooltip);
      window.removeEventListener('scroll', positionTooltip);
      window.removeEventListener('resize', positionTooltip);
    },
    update(newOptions: TooltipOptions) {
      options = newOptions;
      if (tooltipEl) {
        // Update content
        tooltipEl.innerHTML = ''; // Clear existing content

        // Reapply background and padding classes
        tooltipEl.className = ''; // Reset classes
        tooltipEl.classList.add(
          'absolute',
          'z-50',
          'rounded',
          'shadow-lg',
          'pointer-events-none',
          'transition-opacity',
          'duration-200',
          'opacity-0',
          'text-white',
          'max-w-xs',
          options.textSize ? `text-${options.textSize}` : 'text-sm'
        );

        if (options.background) {
          tooltipEl.classList.add(options.background);
        } else {
          tooltipEl.classList.add('bg-black', 'bg-opacity-75');
        }

        if (options.paddingClass) {
          tooltipEl.classList.add(options.paddingClass);
        } else {
          tooltipEl.classList.add('p-2');
        }

        // Update content
        if (options.html) {
          tooltipEl.appendChild(options.html);
        } else if (options.text) {
          tooltipEl.textContent = options.text;
        }

        // Recreate arrow
        const arrow = createArrow(options.direction);
        tooltipEl.appendChild(arrow);
        positionTooltip();
      }
    }
  };
}