<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { TriangleRight } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import TokenCardMobile from "$lib/components/stats/TokenCardMobile.svelte";

  // Props
  export let topVolumeTokens: Kong.Token[] = [];
  export let isLoading: boolean = false;
  export let panelRoundness: string = "";

  // Helper function to get trend class
  function getTrendClass(token: Kong.Token): string {
    const change = token?.metrics?.price_change_24h;
    if (!change) return "";
    return Number(change) > 0
      ? "text-kong-text-accent-green"
      : Number(change) < 0
        ? "text-kong-accent-red"
        : "";
  }
</script>

<div class="w-full">
  <Panel
    type="main"
    className="flex flex-col !bg-kong-bg-light !shadow-none !border-none !p-0"
    height="100%"
  >
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 px-2 pt-2">
        <TriangleRight size={18} class="text-orange-400" fill="currentColor" />
        <h3 class=" font-semibold text-kong-text-primary">
          Top Volume
        </h3>
      </div>
      <div class="flex flex-col gap-1">
        {#if isLoading}
          <div class="space-y-2 px-2 py-2">
            {#each Array(4) as _}
              <div
                class="h-8 bg-kong-bg-dark/20 {panelRoundness} animate-pulse"
              ></div>
            {/each}
          </div>
        {:else}
          <div
            class="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-col gap-1"
          >
            {#each topVolumeTokens as token, i (token.address)}
              <button
                class="w-full"
                on:click={() => goto(`/stats/${token.address}`)}
              >
                <TokenCardMobile
                  {token}
                  section="top-volume"
                  trendClass={getTrendClass(token)}
                  showAdvancedStats={false}
                  showIcons={false}
                  paddingClass="px-3 py-1.5"
                  showIndex={i}
                />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </Panel>
</div> 