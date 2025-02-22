<script lang="ts">
  export let text: string;
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let delay = 200;

  let showTooltip = false;
  let tooltipTimeout: number;

  function handleMouseEnter() {
    tooltipTimeout = setTimeout(() => {
      showTooltip = true;
    }, delay) as unknown as number;
  }

  function handleMouseLeave() {
    clearTimeout(tooltipTimeout);
    showTooltip = false;
  }
</script>

<!-- <div 
  class="relative inline-block"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <slot />
  {#if showTooltip}
    <div 
      class="absolute z-50 px-2 py-1 text-sm text-white whitespace-nowrap rounded-lg bg-kong-surface-dark shadow-lg {
        position === 'top' ? '-top-8 left-1/2 -translate-x-1/2' :
        position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' :
        position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2' :
        'left-full top-1/2 -translate-y-1/2 ml-2'
      }"
    >
      {text}
      <div 
        class="absolute w-2 h-2 bg-kong-surface-dark transform rotate-45 {
          position === 'top' ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' :
          position === 'bottom' ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' :
          position === 'left' ? 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2' :
          'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2'
        }"
      ></div>
    </div>
  {/if}
</div>  -->
