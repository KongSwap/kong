<script lang="ts">
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { ArrowRight } from "lucide-svelte";

  export let tokens = [];
  export let loading = false;

  function handleTokenClick(ledgerId) {
    if (ledgerId) {
      goto(`/token/${ledgerId}`);
    }
  }
</script>

<div class="grid gap-4">
  {#if loading}
    <Panel>
      <div class="flex flex-col gap-4 animate-pulse">
        <div class="w-1/4 h-6 rounded bg-kong-background-secondary"></div>
        <div class="w-1/2 h-4 rounded bg-kong-background-secondary"></div>
      </div>
    </Panel>
  {:else if tokens.length === 0}
    <Panel>
      <div class="py-8 text-center text-kong-text-primary/60">
        No tokens found
      </div>
    </Panel>
  {:else}
    {#each tokens as token}
      <Panel>
        <button
          class="w-full p-4 text-left transition-colors rounded-lg hover:bg-kong-background-secondary"
          on:click={() => handleTokenClick(token.ledger_id?.[0])}
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              {#if token.logo?.[0]}
                <img
                  src={token.logo[0]}
                  alt={token.name}
                  class="w-12 h-12 rounded-full"
                />
              {:else}
                <div class="flex items-center justify-center w-12 h-12 text-2xl font-bold rounded-full bg-kong-background-secondary">
                  {token.ticker[0]}
                </div>
              {/if}
              <div>
                <h3 class="text-lg font-semibold">{token.name}</h3>
                <p class="text-sm text-kong-text-primary/60">{token.ticker}</p>
              </div>
            </div>
            <div class="flex items-center gap-8">
              <div class="text-right">
                <p class="text-sm text-kong-text-primary/60">Total Supply</p>
                <p class="font-medium">
                  {formatBalance(token.total_supply, token.decimals)} {token.ticker}
                </p>
              </div>
              <ArrowRight size={20} class="text-kong-text-primary/40" />
            </div>
          </div>
        </button>
      </Panel>
    {/each}
  {/if}
</div>
