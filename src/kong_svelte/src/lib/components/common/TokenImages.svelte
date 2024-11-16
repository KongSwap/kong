<script lang="ts">
  import { tokenLogoStore } from '$lib/services/tokens/tokenLogos';

  export let tokens: FE.Token[] = [];
  export let size: number = 44; // default 44px (h-11 = 44px)
  export let overlap: number = 16; // default 16px of overlap
  export let containerClass: string = "";
</script>

<div 
  class="isolate flex overflow-hidden {containerClass}"
  style="width: {tokens.length * (size - overlap) + overlap}px"
>
  {#each tokens as token, i}
    <img
      class="relative inline-block rounded-full ring-0 ring-black bg-white object-cover"
      style="
        height: {size}px;
        width: {size}px;
        z-index: {30 - (i * 10)};
        margin-left: {i === 0 ? 0 : -overlap}px;
      "
      src={$tokenLogoStore[token.canister_id] ?? '/tokens/not_verified.webp'}
      alt={token?.symbol}
      loading="eager"
    />
  {/each}
</div> 