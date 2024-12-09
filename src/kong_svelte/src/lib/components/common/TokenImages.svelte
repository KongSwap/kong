<script lang="ts">
  export let tokens: FE.Token[] = [];
  export let size: number = 44;
  export let overlap: number = 12; 
  export let containerClass: string = "";

  $: validTokens = tokens.filter((token): token is FE.Token => {
    if (!token) return false;
    if (!token?.logo_url) {
      console.warn('Token missing logo_url:', token);
    }
    return token !== undefined && token !== null;
  });
</script>

<div 
  class="isolate flex overflow-hidden {containerClass}"
  style="width: {validTokens.length * (size - overlap) + overlap}px"
>
  {#each validTokens as token, i}
    <div 
      class="relative inline-block rounded-full bg-slate-800"
      style="
        height: {size}px;
        width: {size}px;
        z-index: 1;
        margin-left: {i === 0 ? 0 : -overlap}px;
      "
    >
      <img
        class="w-full h-full rounded-full object-contain"
        style="object-fit: contain;"
        src={token?.logo_url ? token.logo_url : '/tokens/not_verified.webp'}
        alt={token?.symbol ?? 'Unknown Token'}
        loading="eager"
      />
    </div>
  {/each}
</div>
