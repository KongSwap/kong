<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import { derived } from "svelte/store";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";

  export let row: any;

  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  $: isKongPool = row.address_0 === KONG_CANISTER_ID || row.address_1 === KONG_CANISTER_ID;
</script>

<div class="flex items-center gap-2">
  <TokenImages
    tokens={[
      $tokenMap.get(row.address_0),
      $tokenMap.get(row.address_1)
    ]}
    containerClass="self-center"
    size={24}
  />
  <span class="token-name">{row.symbol_0}/{row.symbol_1}</span>
</div>

<style lang="postcss">
  .token-name {
    @apply text-kong-text-primary font-medium truncate max-w-[120px] md:max-w-none;
  }
</style> 