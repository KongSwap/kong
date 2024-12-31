<script lang="ts">
	import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
	import { BigNumber } from 'bignumber.js';
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { livePools, liveUserPools } from "$lib/services/pools/poolStore";

  export let token0: FE.Token | null = null;
  export let token1: FE.Token | null = null;
  export let decimals: number = 8;
  export let layout: "vertical" | "horizontal" = "vertical";
  

  // Calculate percentage of total pool
  $: pool = $livePools.find(p => p.symbol_0 === token0?.symbol && p.symbol_1 === token1?.symbol)
  $: userPool = $liveUserPools.find(p => p.symbol_0 === token0?.symbol && p.symbol_1 === token1?.symbol)
  $: poolShare = new BigNumber(userPool?.balance).div(new BigNumber((pool?.balance_0 + pool?.balance_1).toString()))
  $: hasPosition = userPool?.balance && userPool?.amount_0 && userPool?.amount_1;
  $: hasTokens = token0 && token1;
</script>

{#if hasTokens}
  <Panel variant="transparent" className="bg-black/20">
    {#if layout === "horizontal"}
      <div class="flex flex-col gap-4">
        <!-- Pool Title Row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <TokenImages tokens={[token0, token1]} size={24} overlap />
            <span class="font-medium text-kong-text-primary/90 whitespace-nowrap text-base">
              {token0.symbol}/{token1.symbol} Pool
            </span>
          </div>

          <!-- Status -->
          <div class="flex items-center">
            {#if hasPosition}
              <span class="text-sm text-kong-text-primary/40 font-normal">
                {formatToNonZeroDecimal(poolShare.toString())}% of pool
              </span>
            {:else}
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 whitespace-nowrap">
                New Position
              </span>
            {/if}
          </div>
        </div>

        <!-- Position Info Row -->
        {#if hasPosition}
          <Panel variant="transparent" className="">
            <div class="grid grid-cols-3 w-full gap-6">
            <div>
              <div class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1">LP Tokens</div>
              <div class="text-kong-text-primary/90 font-medium tabular-nums">
                {Number(userPool?.balance)}
              </div>
            </div>

            <div>
              <div class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1">{token0?.symbol}</div>
              <div class="text-kong-text-primary/90 font-medium tabular-nums">
                {Number(userPool?.amount_0)}
              </div>
            </div>

            <div>
              <div class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1">{token1?.symbol}</div>
              <div class="text-kong-text-primary/90 font-medium tabular-nums">
                {Number(userPool?.amount_1)}
              </div>
            </div>
          </div>
          </Panel>
        {/if}
      </div>

    {:else}
      <!-- Vertical Layout -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex flex-col">
          {#if hasPosition}
            <div class="text-kong-text-primary/60 text-sm font-medium uppercase tracking-wider">
              Current Position
            </div>
            <div class="text-kong-text-primary/40 text-xs mt-1">
              {pool}% of pool
            </div>
          {:else}
            <div class="flex flex-col gap-1">
              <div class="inline-flex items-center gap-2">
                <span class="text-sm font-medium uppercase tracking-wider text-kong-text-primary/90">
                  New Position
                </span>
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">
                  First LP
                </span>
              </div>
            </div>
          {/if}
        </div>
        <div class="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-lg">
          <TokenImages tokens={[token0, token1]} size={20} overlap />
          <span class="text-kong-text-primary/60 text-sm font-medium">
            {token0.symbol}/{token1.symbol}
          </span>
        </div>
      </div>

      {#if hasPosition}
        <div class="flex flex-col gap-3">
          <div class="bg-black/20 rounded-lg p-4">
            <div class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1.5">
              LP Tokens
            </div>
            <div class="text-kong-text-primary/90 text-lg font-medium tabular-nums">
              {Number(userPool?.balance)}
            </div>
          </div>

          <div class="bg-black/20 rounded-lg p-4">
            <div class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-3">
              Pooled Assets
            </div>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages tokens={[token0]} size={24} />
                  <span class="text-kong-text-primary/90 font-medium">{token0?.symbol}</span>
                </div>
                <span class="text-kong-text-primary/90 font-medium tabular-nums">
                  {Number(userPool?.amount_0)}
                </span>
              </div>
              <div class="h-px bg-white/5" />
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages tokens={[token1]} size={24} />
                  <span class="text-kong-text-primary/90 font-medium">{token1?.symbol}</span>
                </div>
                <span class="text-kong-text-primary/90 font-medium tabular-nums">
                  {Number(userPool?.amount_1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </Panel>
{/if}
