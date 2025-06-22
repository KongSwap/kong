// src/kong_svelte/src/lib/actions/tooltip.ts

import { get } from 'svelte/store';
import { themeColors } from '../stores/derivedThemeStore';

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
    if (!options) return false;
    
    if (options.html) {
      return true;
    }
    if (options.text && options.text.trim() !== '') {
      return true;
    }
    return false;
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

    // Create tooltip container
    tooltipEl = document.createElement('div');
    tooltipEl.classList.add(
      'absolute',
      'z-10',
      'rounded',
      'shadow',
      'pointer-events-none',
      'border-kong-border',
      'border',
      'transition-opacity',
      'duration-200',
      'opacity-0',
      'text-kong-text-primary',
      'max-w-xs',
      options.textSize ? `text-${options.textSize}` : 'text-sm'
    );

    // Set background color
    if (options.background) {
      tooltipEl.classList.add(options.background);
    } else {
      tooltipEl.classList.add('bg-kong-bg-primary');
    }

    // Apply padding
    if (options.paddingClass) {
      tooltipEl.classList.add(options.paddingClass);
    } else {
      tooltipEl.classList.add('px-4', 'py-2');
    }

    // Add content
    const contentContainer = document.createElement('div');
    if (options.html) {
      contentContainer.appendChild(options.html);
    } else if (options.text) {
      contentContainer.textContent = options.text;
    }
    tooltipEl.appendChild(contentContainer);

    // Add the tooltip to the DOM first so we can get its computed style
    document.body.appendChild(tooltipEl);
    
    // Get the computed background color
    const tooltipBgColor = getComputedStyle(tooltipEl).backgroundColor;

    // Get the computed border color using themeStore
    const currentTheme = get(themeColors);
    const borderColor = currentTheme.border;

    // Create border arrow (slightly larger)
    const borderArrow = document.createElement('div');
    borderArrow.classList.add('absolute', 'w-0', 'h-0');
    // Create background arrow (slightly smaller)
    const bgArrow = document.createElement('div');
    bgArrow.classList.add('absolute', 'w-0', 'h-0');

    // Set arrow position and style based on direction
    const direction = options.direction || 'top';
    switch (direction) {
      case 'top':
        borderArrow.classList.add('bottom-[-9px]', 'left-1/2', '-translate-x-1/2');
        borderArrow.style.borderWidth = '9px 9px 0 9px';
        borderArrow.style.borderColor = `${borderColor} transparent transparent transparent`;
        bgArrow.classList.add('bottom-[-8px]', 'left-1/2', '-translate-x-1/2');
        bgArrow.style.borderWidth = '8px 8px 0 8px';
        bgArrow.style.borderColor = `${tooltipBgColor} transparent transparent transparent`;
        break;
      case 'bottom':
        borderArrow.classList.add('top-[-9px]', 'left-1/2', '-translate-x-1/2');
        borderArrow.style.borderWidth = '0 9px 9px 9px';
        borderArrow.style.borderColor = `transparent transparent ${borderColor} transparent`;
        bgArrow.classList.add('top-[-8px]', 'left-1/2', '-translate-x-1/2');
        bgArrow.style.borderWidth = '0 8px 8px 8px';
        bgArrow.style.borderColor = `transparent transparent ${tooltipBgColor} transparent`;
        break;
      case 'left':
        borderArrow.classList.add('right-[-9px]', 'top-1/2', '-translate-y-1/2');
        borderArrow.style.borderWidth = '9px 0 9px 9px';
        borderArrow.style.borderColor = `transparent transparent transparent ${borderColor}`;
        bgArrow.classList.add('right-[-8px]', 'top-1/2', '-translate-y-1/2');
        bgArrow.style.borderWidth = '8px 0 8px 8px';
        bgArrow.style.borderColor = `transparent transparent transparent ${tooltipBgColor}`;
        break;
      case 'right':
        borderArrow.classList.add('left-[-9px]', 'top-1/2', '-translate-y-1/2');
        borderArrow.style.borderWidth = '9px 9px 9px 0';
        borderArrow.style.borderColor = `transparent ${borderColor} transparent transparent`;
        bgArrow.classList.add('left-[-8px]', 'top-1/2', '-translate-y-1/2');
        bgArrow.style.borderWidth = '8px 8px 8px 0';
        bgArrow.style.borderColor = `transparent ${tooltipBgColor} transparent transparent`;
        break;
    }

    // Create shadow arrow (slightly larger and offset for shadow effect)
    const shadowArrow = document.createElement('div');
    shadowArrow.classList.add('absolute', 'w-0', 'h-0');

    // Set shadow arrow position and style based on direction
    switch (direction) {
      case 'top':
        shadowArrow.classList.add('bottom-[-10px]', 'left-1/2', '-translate-x-1/2');
        shadowArrow.style.borderWidth = '10px 10px 0 10px';
        shadowArrow.style.borderColor = `rgba(0, 0, 0, 0.1) transparent transparent transparent`;
        break;
      case 'bottom':
        shadowArrow.classList.add('top-[-10px]', 'left-1/2', '-translate-x-1/2');
        shadowArrow.style.borderWidth = '0 10px 10px 10px';
        shadowArrow.style.borderColor = `transparent transparent rgba(0, 0, 0, 0.1) transparent`;
        break;
      case 'left':
        shadowArrow.classList.add('right-[-10px]', 'top-1/2', '-translate-y-1/2');
        shadowArrow.style.borderWidth = '10px 0 10px 10px';
        shadowArrow.style.borderColor = `transparent transparent transparent rgba(0, 0, 0, 0.1)`;
        break;
      case 'right':
        shadowArrow.classList.add('left-[-10px]', 'top-1/2', '-translate-y-1/2');
        shadowArrow.style.borderWidth = '10px 10px 10px 0';
        shadowArrow.style.borderColor = `transparent rgba(0, 0, 0, 0.1) transparent transparent`;
        break;
    }

    // Append the shadow arrow before the border arrow
    tooltipEl.appendChild(shadowArrow);
    tooltipEl.appendChild(borderArrow);
    tooltipEl.appendChild(bgArrow);
    
    // Position tooltip
    positionTooltip();

    // Make tooltip visible after positioning
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
      
      // Remove the tooltip after fade out
      setTimeout(() => {
        if (tooltipEl && tooltipEl.parentNode) {
          tooltipEl.parentNode.removeChild(tooltipEl);
          tooltipEl = null;
        }
      }, 200); // Match the duration-200 class
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
        // Hide current tooltip and show a new one with updated options
        hideTooltip();
        setTimeout(() => {
          if (shouldShowTooltip()) {
            showTooltip();
          }
        }, 200); // Match the duration-200 class
      }
    }
  };
}