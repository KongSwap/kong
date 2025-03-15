<script lang="ts">
  import { CircleHelp } from "lucide-svelte";

  export let market: any;
  export let isMarketResolved: boolean;
  export let isPendingResolution: boolean;
</script>

<div class="!rounded animate-fadeIn mb-2">
  <div class="flex items-center gap-2 sm:gap-3">
    <div
      class="p-2 sm:p-2 bg-kong-accent-green/10 rounded flex items-center justify-center"
    >
      <CircleHelp
        size={20}
        class="text-kong-text-accent-green sm:w-6 sm:h-6"
      />
    </div>
    <div class="flex-1">
      <h1
        class="text-xl sm:text-2xl lg:text-2xl font-bold text-kong-text-primary leading-tight"
      >
        {market.question}
      </h1>
      {#if isMarketResolved || isPendingResolution}
        <div class="flex items-center gap-2 mt-1">
          {#if isMarketResolved}
            <span
              class="px-2 py-0.5 bg-kong-accent-green/20 text-kong-text-accent-green text-xs rounded-full"
            >
              Resolved
            </span>
            {#if market.resolved_by}
              <span class="text-xs text-kong-text-secondary">
                by {market.resolved_by[0].toString().slice(0, 8)}...
              </span>
            {/if}
          {:else if isPendingResolution}
            <span
              class="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full"
            >
              Pending Resolution
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  {#if market.rules && market.rules.length > 0}
    <div class="mt-4 p-3 bg-kong-bg-light/10 rounded border border-kong-border/10">
      <h2 class="text-sm font-medium text-kong-text-primary mb-2">Market Rules</h2>
      <p class="text-sm text-kong-text-secondary whitespace-pre-wrap">{market.rules}</p>
    </div>
  {/if}
</div> 