<!-- src/kong_svelte/src/lib/components/common/Tooltip.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let text: string;

  let tooltipVisible = false;
  let tooltipEl: HTMLElement;
  let slotEl: HTMLElement;
  let tooltipContainer: HTMLElement;

  function showTooltip() {
    console.log('showing tooltip'); // Debug
    tooltipVisible = true;
    // Wait for DOM update before positioning
    setTimeout(positionTooltip, 0);
  }

  function hideTooltip() {
    console.log('hiding tooltip'); // Debug
    tooltipVisible = false;
  }

  function positionTooltip() {
    if (!tooltipEl || !slotEl) return;
    
    const slotRect = slotEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    let left = slotRect.left + (slotRect.width / 2) - (tooltipRect.width / 2);
    let top = slotRect.top - tooltipRect.height - 8;

    // Prevent tooltip from going off-screen
    if (left < 0) left = 8;
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    // If tooltip goes off-screen at the top, display it below the element
    if (top < 0) {
      top = slotRect.bottom + 8;
      tooltipEl.classList.add('arrow-up');
    } else {
      tooltipEl.classList.remove('arrow-up');
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  onMount(() => {
    window.addEventListener('scroll', positionTooltip);
    window.addEventListener('resize', positionTooltip);
  });

  onDestroy(() => {
    window.removeEventListener('scroll', positionTooltip);
    window.removeEventListener('resize', positionTooltip);
  });
</script>

<div 
  class="tooltip-wrapper"
  bind:this={tooltipContainer}
>
  <div
    class="tooltip-trigger"
    bind:this={slotEl}
    on:mouseenter={showTooltip}
    on:mouseleave={hideTooltip}
    on:focusin={showTooltip}
    on:focusout={hideTooltip}
  >
    <slot />
  </div>

  {#if tooltipVisible}
    <div 
      class="tooltip-content"
      bind:this={tooltipEl}
    >
      {text}
      <div class="tooltip-arrow" />
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
    line-height: normal;
  }

  .tooltip-trigger {
    display: inline-flex;
    line-height: normal;
  }

  .tooltip-content {
    position: fixed;
    z-index: 9999;
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    white-space: nowrap;
    pointer-events: none;
    filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.05));
  }

  .tooltip-arrow {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid rgba(0, 0, 0, 0.75);
  }

  .tooltip-content.arrow-up .tooltip-arrow {
    bottom: auto;
    top: -4px;
    transform: translateX(-50%) rotate(180deg);
  }
</style>