<script lang="ts">
  export let tokens: FE.Token[] = [];
  export let size: number = 48;
  export let containerClass: string = "";
  export let imageWrapperClass: string = "";
  export let overlap: boolean = false;

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

<div class="flex items-center {containerClass} p-0 m-0" style="margin-right: {overlap ? '10px' : '0'}">
  {#each validTokens as token, index}
    <div 
      style="height: {size}px; width: {size}px; z-index: {validTokens.length - index};"
      class="flex items-center rounded-full {imageWrapperClass} {overlap ? 'mr-[-10px]' : ''} relative"
    >
      <img
        class="w-full h-full rounded-full bg-transparent"
        src={token.logo_url || DEFAULT_IMAGE}
        alt={getTokenAlt(token)}
        loading="eager"
        on:error={handleImageError}
      />
    </div>
  {/each}
</div>
