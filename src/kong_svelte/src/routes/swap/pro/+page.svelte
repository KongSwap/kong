<script lang="ts">
  import SwapPro from "$lib/components/swap/SwapPro.svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { ICP_CANISTER_ID, KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;

  async function initializeTokens() {
    if(!browser) return;

    try {
      const fromCanisterId = $page.url.searchParams.get("from") || ICP_CANISTER_ID;
      const toCanisterId = $page.url.searchParams.get("to") || KONG_LEDGER_CANISTER_ID;
      
      const tokens = await fetchTokensByCanisterId([fromCanisterId, toCanisterId]);
      
      fromToken = tokens.find(t => t.canister_id === fromCanisterId) || null;
      toToken = tokens.find(t => t.canister_id === toCanisterId) || null;
    } catch (error) {
      console.error("Error initializing tokens:", error);
    }
  }

  $: if (browser) {
    initializeTokens();
  }
</script>

<SwapPro initialFromToken={fromToken} initialToToken={toToken} currentMode="pro" /> 