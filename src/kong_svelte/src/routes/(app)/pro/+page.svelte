<script lang="ts">
  import SwapPro from "$lib/components/swap/SwapPro.svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { ICP_CANISTER_ID, KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";

  let fromToken: Kong.Token | null = null;
  let toToken: Kong.Token | null = null;

  async function initializeTokens() {
    if(!browser) return;

    try {
      const fromCanisterId = page.url.searchParams.get("from") || ICP_CANISTER_ID;
      const toCanisterId = page.url.searchParams.get("to") || KONG_LEDGER_CANISTER_ID;
      
      const tokens = await fetchTokensByCanisterId([fromCanisterId, toCanisterId]);
      
      fromToken = tokens.find(t => t.address === fromCanisterId) || null;
      toToken = tokens.find(t => t.address === toCanisterId) || null;
    } catch (error) {
      console.error("Error initializing tokens:", error);
    }
  }

  $: if (browser) {
    initializeTokens();
  }
</script>

<svelte:head>
  <title>Pro Swap - KongSwap</title>
</svelte:head>


<SwapPro initialFromToken={fromToken} initialToToken={toToken} /> 