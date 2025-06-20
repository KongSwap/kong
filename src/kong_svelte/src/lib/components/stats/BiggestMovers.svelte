<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { TrendingUp, TrendingDown } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import TopListTokenCard from "$lib/components/stats/TopListTokenCard.svelte";
  import { writable } from "svelte/store";

  // Props
  export let topGainers: Kong.Token[] = [];
  export let topLosers: Kong.Token[] = [];
  export let isLoading: boolean = false;
  export let panelRoundness: string = "";

  // Local state for active tab
  const activeTab = writable<"gainers" | "losers">("gainers");

  // Function to handle tab change
  function handleTabChange(tab: "gainers" | "losers") {
    activeTab.set(tab);
  }
</script>

<div class="w-full md:w-full">
  <Panel
    type="main"
    className="flex flex-col !bg-kong-bg-secondary !border-none !p-0 !shadow-none"
    height="100%"
  >
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between px-1">
        <h3 class="font-semibold text-kong-text-primary px-2 pt-2 flex items-center gap-2">
          {#if $activeTab === "gainers"}
            <TrendingUp size={18} class="text-kong-success" />
          {:else}
            <TrendingDown size={18} class="text-kong-error" />
          {/if}
          Top {$activeTab === "gainers" ? "Gainers" : "Losers"}
        </h3>
        <div class="flex items-center gap-1 pt-2">
          <button
            class="px-2 py-0.5 flex items-center gap-1 text-sm rounded-full transition-colors duration-200 {$activeTab ===
            'gainers'
              ? 'bg-kong-success text-kong-text-on-primary'
              : 'bg-kong-bg-primary/60 text-kong-text-secondary hover:text-kong-text-primary'}"
            onclick={() => handleTabChange("gainers")}
          >
            <TrendingUp size={16} />
          </button>
          <button
            class="px-2 py-0.5 flex items-center gap-1 text-sm rounded-full transition-colors duration-200 {$activeTab ===
            'losers'
              ? 'bg-kong-error text-kong-text-on-primary'
              : 'bg-kong-bg-primary/60 text-kong-text-secondary hover:text-kong-text-primary'}"
            onclick={() => handleTabChange("losers")}
          >
            <TrendingDown size={16} />
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        {#if isLoading}
          <div class="space-y-2 px-2 py-2">
            {#each Array(4) as _}
              <div
                class="h-8 bg-kong-bg-primary/20 {panelRoundness} animate-pulse"
              ></div>
            {/each}
          </div>
        {:else}
          <div
            class="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-col md:w-full md:max-w-[343px] px-1 pb-2"
          >
            {#each $activeTab === "gainers" ? topGainers : topLosers as token, i (token.address)}
              <button
                class="w-full"
                onclick={() => goto(`/stats/${token.address}`)}
              >
                <TopListTokenCard
                  {token}
                  displayType={$activeTab === "gainers" ? "gainer" : "loser"}
                />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </Panel>
</div> 