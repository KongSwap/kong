<script lang="ts">
  import { goto } from '$app/navigation';
	import { truncateAddress } from '$lib/utils/principalUtils';
  import { Activity, CircleHelp, User } from "lucide-svelte";

  let { market, isMarketResolved, isPendingResolution, isMarketVoided } = $props();
</script>

<div class="!rounded animate-fadeIn mb-2">
  <div class="flex items-center gap-2 sm:gap-3">
    <div
      class="{market.image_url ? '' : 'p-2 sm:p-2 bg-kong-accent-green/10 rounded flex items-center justify-center'}"
    >
    {#if market.image_url.length > 0}
      <img src={market.image_url} alt="Market Icon" class="w-[4.4rem] h-[4.4rem] object-cover">
    {:else}
      <CircleHelp
        class="text-kong-text-accent-green w-8 h-8"
      />
    {/if}
    </div>
    <div class="flex-1">
      <h1
        class="text-xl sm:text-2xl lg:text-2xl font-bold text-kong-text-primary leading-tight"
      >
        {market.question}
      </h1>
      {#if isMarketResolved || isPendingResolution || isMarketVoided}
        <div class="flex items-center gap-2 mt-1">
          {#if isMarketResolved}
            <span
              class="px-2 py-0.5 flex items-center gap-0.5 bg-kong-accent-green/20 text-kong-text-accent-green text-xs rounded-full"
            >
              <Activity size={12} />
              Resolved
            </span>
            {#if market.resolved_by}
              <span class="text-xs text-kong-text-secondary">
                by {market.resolved_by[0].toString().slice(0, 8)}...
              </span>
            {/if}
          {:else if isMarketVoided}
            <span
              class="px-2 py-0.5 flex items-center gap-0.5 bg-kong-accent-red/20 text-kong-text-accent-red text-xs rounded-full"
            >
              <Activity size={12} />
              Voided
            </span>
          {:else if isPendingResolution}
            <span
              class="px-2 py-0.5 flex items-center gap-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full"
            >
              <Activity size={12} />
              Pending Resolution
            </span>
          {/if}
          <span
            class="px-2 py-0.5 cursor-pointer flex items-center gap-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full"
            on:click={(e) => {
              goto(`/wallets/${market.creator.toText()}`);
            }}
          >
            <User size={12} />
            {truncateAddress(market.creator.toText())}
          </span>
        </div>
      {/if}
    </div>
  </div>
</div> 