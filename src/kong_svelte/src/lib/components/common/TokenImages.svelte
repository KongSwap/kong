<script lang="ts">
  // Type safety for event handling
  import type { HTMLImgAttributes } from 'svelte/elements';

  export let tokens: FE.Token[] = [];
  export let size: number = 48;
  export let containerClass: string = "";

  const DEFAULT_IMAGE = '/tokens/not_verified.webp';

  // Filter out invalid tokens and memoize result
  $: validTokens = tokens.filter((token): token is FE.Token => {
    return token && typeof token === 'object' && !!(token.symbol || token.name);
  });

  // Handle image error with proper typing
  function handleImageError(e: Event & { currentTarget: EventTarget & HTMLImageElement }) {
    e.currentTarget.src = DEFAULT_IMAGE;
  }

  // Helper to get token alt text
  function getTokenAlt(token: FE.Token): string {
    return token.symbol ?? token.name ?? 'Unknown Token';
  }
</script>

<div class="flex {containerClass}">
  {#each validTokens as token}
    <div 
      style="height: {size}px; width: {size}px;"
      class="inline-block"
    >
      <img
        class="w-full h-full rounded"
        src={token.logo_url || DEFAULT_IMAGE}
        alt={getTokenAlt(token)}
        loading="eager"
        on:error={handleImageError}
      />
    </div>
  {/each}
</div>
