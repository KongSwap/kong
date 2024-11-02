// src/kong_svelte/src/lib/actions/tooltip.ts

import { onDestroy } from 'svelte';

interface TooltipOptions {
  text?: string;
  html?: HTMLElement;
  paddingClass?: string;
  background?: string;
}

/**
 * Tooltip Action
 * Displays a tooltip with the provided text or HTML content.
 * If both text and HTML are empty/null, the tooltip will not be shown.
 *
 * @param node - The HTML element to attach the tooltip to.
 * @param options - Configuration options for the tooltip.
 */
export function tooltip(node: HTMLElement, options: TooltipOptions) {
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
   * Creates and displays the tooltip.
   */
  const showTooltip = () => {
    if (tooltipEl || !shouldShowTooltip()) return; // Tooltip already exists or should not show

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
      'max-w-xs' // Limit the maximum width
    );

    // Apply background class or default
    if (options.background) {
      tooltipEl.classList.add(options.background);
    } else {
      tooltipEl.classList.add('bg-black', 'bg-opacity-75');
    }

    // Apply padding class or default
    if (options.paddingClass) {
      tooltipEl.classList.add(options.paddingClass);
    } else {
      tooltipEl.classList.add('p-2');
    }

    // Populate content
    if (options.html) {
      tooltipEl.appendChild(options.html);
    } else if (options.text) {
      tooltipEl.textContent = options.text;
    }

    // Create arrow element
    const arrow = document.createElement('div');
    arrow.classList.add(
      'absolute',
      'w-2',
      'h-2',
      'bg-transparent',
      'border-solid',
      'transform',
      '-mt-1'
    );

    if (options.background) {
      const bgColor = options.background.replace('bg-', '');
      arrow.style.borderTopColor = getComputedStyle(document.documentElement).getPropertyValue(`--${bgColor}`);
    } else {
      arrow.classList.add('border-t-4', 'border-t-black');
    }

    tooltipEl.appendChild(arrow);

    document.body.appendChild(tooltipEl);
    positionTooltip();

    // Fade in
    requestAnimationFrame(() => {
      tooltipEl!.classList.remove('opacity-0');
      tooltipEl!.classList.add('opacity-100');
    });
  };

  /**
   * Hides and removes the tooltip from the DOM.
   */
  const hideTooltip = () => {
    if (tooltipEl) {
      tooltipEl.classList.remove('opacity-100');
      tooltipEl.classList.add('opacity-0');
      // Remove after transition
      setTimeout(() => {
        if (tooltipEl && tooltipEl.parentNode) {
          tooltipEl.parentNode.removeChild(tooltipEl);
          tooltipEl = null;
        }
      }, 200);
    }
  };

  /**
   * Positions the tooltip relative to the target element.
   */
  const positionTooltip = () => {
    if (!tooltipEl) return;
    const rect = node.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    // Default position: above the element
    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

    // Adjust if tooltip goes off-screen
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }
    if (top < 8) {
      // Position below the element if not enough space above
      top = rect.bottom + 8;
      // Adjust arrow direction
      const arrow = tooltipEl.querySelector('.border-t-4, .border-b-4') as HTMLElement;
      if (arrow) {
        if (arrow.classList.contains('border-t-4')) {
          arrow.classList.remove('border-t-4', 'border-t-black');
          arrow.classList.add('border-b-4', 'border-b-black', 'top-auto', 'bottom-full', 'mt-[-4px]');
        } else if (arrow.classList.contains('border-b-4')) {
          // Reverse back if needed
          arrow.classList.remove('border-b-4', 'border-b-black', 'top-auto', 'bottom-full', 'mt-[-4px]');
          arrow.classList.add('border-t-4', 'border-t-black');
        }
      }
    }

    tooltipEl.style.top = `${top + window.scrollY}px`;
    tooltipEl.style.left = `${left + window.scrollX}px`;
  };

  // Event listeners
  node.addEventListener('mouseenter', showTooltip);
  node.addEventListener('mouseleave', hideTooltip);
  node.addEventListener('focusin', showTooltip);
  node.addEventListener('focusout', hideTooltip);
  window.addEventListener('scroll', positionTooltip);
  window.addEventListener('resize', positionTooltip);

  // Cleanup on destroy
  onDestroy(() => {
    hideTooltip();
    node.removeEventListener('mouseenter', showTooltip);
    node.removeEventListener('mouseleave', hideTooltip);
    node.removeEventListener('focusin', showTooltip);
    node.removeEventListener('focusout', hideTooltip);
    window.removeEventListener('scroll', positionTooltip);
    window.removeEventListener('resize', positionTooltip);
  });

  // Optional: Return an object with update method to handle dynamic options
  return {
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
          'max-w-xs'
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
        const arrow = document.createElement('div');
        arrow.classList.add(
          'absolute',
          'w-2',
          'h-2',
          'bg-transparent',
          'border-solid',
          'transform',
          '-mt-1'
        );

        if (options.background) {
          const bgColor = options.background.replace('bg-', '');
          arrow.style.borderTopColor = getComputedStyle(document.documentElement).getPropertyValue(`--${bgColor}`);
        } else {
          arrow.classList.add('border-t-4', 'border-t-black');
        }

        tooltipEl.appendChild(arrow);
        positionTooltip();
      }
    }
  };
}