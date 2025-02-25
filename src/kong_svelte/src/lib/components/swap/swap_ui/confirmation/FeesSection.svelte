<script lang="ts">
  import BigNumber from "bignumber.js";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userTokens } from "$lib/stores/userTokens";
  import { slide } from "svelte/transition";
  import Panel from "$lib/components/common/Panel.svelte";

  const { 
    gasFees = [], 
    lpFees = [], 
    userMaxSlippage, 
    priceImpact, 
    showPriceImpactWarning 
  } = $props<{
    gasFees: { amount: string; token: string }[];
    lpFees: { amount: string; token: string }[];
    userMaxSlippage: number;
    priceImpact: number;
    showPriceImpactWarning: boolean;
  }>();

  let isExpanded = $state(false);

  const totalFeesUsd = $derived(
    [...gasFees, ...lpFees].reduce((total, fee) => {
      const token = $userTokens?.tokens.find(t => t.symbol === fee.token);
      if (!token?.metrics?.price) return total;
      return total + Number(fee.amount) * Number(token.metrics.price);
    }, 0)
  );
</script>

<div class="p-4">
  <div class="fees-container">

    <div class="settings-group">
      <div class="setting-row">
        <div class="flex items-center gap-2">
          <span class="label">Price Impact</span>
          {#if showPriceImpactWarning}
            <span class="warning-icon" title="High price impact may result in unfavorable rates">⚠️</span>
          {/if}
        </div>
        <span class="value" class:warning={showPriceImpactWarning}>
          {priceImpact.toFixed(2)}%
        </span>
      </div>
      <div class="setting-row">
        <span class="label">Max Slippage</span>
        <span class="value highlight">{userMaxSlippage}%</span>
      </div>

    </div>
  </div>
</div>

<div class="p-4">
  <div class="fees-container">
    <div class="settings-group">
      <div 
        class="setting-row"
        class:expanded={isExpanded}
        on:click={() => isExpanded = !isExpanded}
        role="button"
        tabindex="0"
      >
        <div class="flex items-center gap-2">
          <span class="label">Network Fee + LP Fee</span>
          {#if showPriceImpactWarning}
            <span class="warning-icon" title="High price impact may result in unfavorable rates">⚠️</span>
          {/if}
        </div>
        <div class="fee-total">
          <span class="value">-${formatToNonZeroDecimal(totalFeesUsd)}</span>
          <span class="expand-icon">{isExpanded ? '−' : '+'}</span>
        </div>
      </div>

      <!-- Expanded Details -->
      {#if isExpanded}
        <div transition:slide>
          <Panel variant="transparent" type="secondary" className="mt-2">
            <div class="detail-row">
              <span class="label">Network Fee</span>
              <div class="fee-values">
                {#each gasFees as fee}
                  {#if new BigNumber(fee.amount).gt(0)}
                    <span class="value">-{fee.amount} {fee.token}</span>
                  {/if}
                {/each}
              </div>
            </div>
            <div class="detail-row">
              <span class="label">LP Fee</span>
              <div class="fee-values">
                {#each lpFees as fee}
                  {#if new BigNumber(fee.amount).gt(0)}
                    <span class="value">-{fee.amount} {fee.token}</span>
                  {/if}
                {/each}
              </div>
            </div>
          </Panel>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .fees-container {
    @apply space-y-4;
  }

  .fee-total {
    @apply flex items-center gap-2;
  }

  .expand-icon {
    @apply text-kong-text-secondary text-lg leading-none;
  }

  .detail-row {
    @apply flex justify-between items-center py-2;
  }

  .settings-group {
    @apply space-y-3;
  }

  .setting-row {
    @apply flex justify-between items-center cursor-pointer py-1;
  }

  .label {
    @apply text-sm text-kong-text-secondary;
  }

  .value {
    @apply text-sm text-kong-text-primary;
  }

  .value.highlight {
    @apply font-medium text-kong-primary;
  }

  .value.warning {
    @apply text-kong-warning;
  }

  .warning-icon {
    @apply text-kong-warning text-xs;
  }

  .fee-values {
    @apply flex flex-col items-end gap-1;
  }

  @media (max-width: 640px) {
    .p-4 {
      @apply p-3;
    }

    .label, .value {
      @apply text-xs;
    }

    .expand-icon {
      @apply text-base;
    }

    .detail-row {
      @apply py-1.5;
    }
  }
</style>
