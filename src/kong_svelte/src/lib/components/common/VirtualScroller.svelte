<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let items: any[] = [];
  export let itemHeight: number;
  export let overscan: number = 5; // Buffer size
  
  let container: HTMLElement;
  let viewportHeight = 0;
  let scrollY = 0;
  
  // Use RAF for smooth updates
  let rafId: number;
  let pendingUpdate = false;
  
  // Memoized calculations
  $: totalHeight = items.length * itemHeight;
  $: visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
  $: startIndex = Math.max(0, Math.floor(scrollY / itemHeight) - overscan);
  $: endIndex = Math.min(items.length, startIndex + visibleCount);
  $: visibleItems = items.slice(startIndex, endIndex);
  $: translateY = startIndex * itemHeight;
  
  // Intersection Observer setup
  let observer: IntersectionObserver;
  let sentinel: HTMLElement;
  let lastScrollY = 0;
  
  function setupObserver() {
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // Only update if we've scrolled significantly
          const newScrollY = container.scrollTop;
          if (Math.abs(newScrollY - lastScrollY) > (itemHeight / 2)) {
            lastScrollY = newScrollY;
            queueUpdate(newScrollY);
          }
        }
      },
      {
        root: container,
        threshold: 0
      }
    );
    
    observer.observe(sentinel);
  }
  
  // Queue updates to prevent too frequent rerenders
  function queueUpdate(newScrollY: number) {
    scrollY = newScrollY;
    if (!pendingUpdate) {
      pendingUpdate = true;
      rafId = requestAnimationFrame(() => {
        pendingUpdate = false;
      });
    }
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    const threshold = 100; // pixels from bottom
    const bottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    
    if (bottom) {
      dispatch('nearBottom');
    }
  }
  
  // Lifecycle
  onMount(() => {
    setupObserver();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(rafId);
    };
  });
</script>

<div
  bind:this={container}
  bind:clientHeight={viewportHeight}
  class="overflow-auto relative"
  style="contain: strict; height: 100%;"
  on:scroll={handleScroll}
>
  <!-- Sentinel element for intersection observer -->
  <div
    bind:this={sentinel}
    class="absolute w-full h-px"
    style="transform: translateY({scrollY}px);"
  />
  
  <!-- Spacer for scroll area -->
  <div style="height: {totalHeight}px;">
    <!-- Container for visible items -->
    <div
      class="absolute w-full"
      style="transform: translateY({translateY}px); will-change: transform;"
    >
      {#each visibleItems as item, i (i)}
        <div style="height: {itemHeight}px;">
          <slot {item} index={startIndex + i} />
        </div>
      {/each}
    </div>
  </div>
</div> 