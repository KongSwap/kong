<script lang="ts">
  import BigNumber from "bignumber.js";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userTokens } from "$lib/stores/userTokens";
  import { slide } from "svelte/transition";
  import Panel from "$lib/components/common/Panel.svelte";
  import { AlertTriangle } from "lucide-svelte";

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

<div class="fees-section">
  <!-- Price Impact Card -->
  <div class="detail-card" class:warning={showPriceImpactWarning}>
    <div class="detail-row">
      <div class="flex items-center gap-2 sm:gap-1">
        <span class="detail-label">Price Impact</span>
        {#if showPriceImpactWarning}
          <AlertTriangle size={14} class="text-kong-warning size-3.5 sm:size-4" />
        {/if}
      </div>
      <span class="detail-value" class:warning-text={showPriceImpactWarning}>
        {priceImpact.toFixed(2)}%
      </span>
    </div>
  </div>

  <!-- Slippage Card -->
  <div class="detail-card">
    <div class="detail-row">
      <span class="detail-label">Max Slippage</span>
      <span class="detail-value highlight">{userMaxSlippage}%</span>
    </div>
  </div>

  <!-- Fees Card with expandable details -->
  <div 
    class="detail-card fees"
    class:expanded={isExpanded}
  >
    <div 
      class="detail-row cursor-pointer"
      on:click={() => isExpanded = !isExpanded}
      role="button"
      tabindex="0"
    >
      <span class="detail-label">Network + LP Fees</span>
      <div class="flex items-center gap-2 sm:gap-1.5">
        <span class="detail-value">-${formatToNonZeroDecimal(totalFeesUsd)}</span>
        <div class="expand-button">{isExpanded ? '−' : '+'}</div>
      </div>
    </div>

    <!-- Expanded Fee Details -->
    {#if isExpanded}
      <div class="fee-details" transition:slide={{ duration: 150 }}>
        <!-- Network Fee -->
        <div class="fee-detail-row">
          <span class="fee-detail-label">
            <div class="fee-dot network"></div>
            Network Fee
          </span>
          <div class="fee-detail-values">
            {#each gasFees as fee}
              {#if new BigNumber(fee.amount).gt(0)}
                <span class="fee-amount">-{fee.amount} {fee.token}</span>
              {/if}
            {/each}
          </div>
        </div>
        
        <!-- LP Fee -->
        <div class="fee-detail-row">
          <span class="fee-detail-label">
            <div class="fee-dot lp"></div>
            LP Fee
          </span>
          <div class="fee-detail-values">
            {#each lpFees as fee}
              {#if new BigNumber(fee.amount).gt(0)}
                <span class="fee-amount">-{fee.amount} {fee.token}</span>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  /* Main Container */
  .fees-section {
    @apply flex flex-col gap-3 sm:gap-2 sm:px-0;
  }

  /* Detail Card Common Styles */
  .detail-card {
    @apply bg-kong-bg-dark/30 rounded-lg border border-kong-border/20 p-3 transition-all duration-200 sm:p-2.5;
  }

  /* Warning Card State */
  .detail-card.warning {
    @apply border-kong-warning/30 bg-kong-warning/5;
  }

  /* Expanded Card State */
  .detail-card.expanded {
    @apply border-kong-border/40;
  }

  /* Fees Card Special Styling */
  .detail-card.fees {
    @apply hover:border-kong-border/40 cursor-pointer;
  }

  /* Detail Row Layout */
  .detail-row {
    @apply flex items-center justify-between;
  }

  /* Detail Label */
  .detail-label {
    @apply text-xs text-kong-text-secondary sm:text-base;
  }

  /* Detail Value */
  .detail-value {
    @apply text-xs font-medium text-kong-text-primary sm:text-base;
  }

  /* Highlighted Value */
  .detail-value.highlight {
    @apply text-kong-primary;
  }

  /* Warning Text */
  .warning-text {
    @apply text-kong-warning;
  }

  /* Warning Message */
  .warning-message {
    @apply text-xs text-kong-warning mt-2 bg-kong-warning/10 p-1.5 rounded sm:text-[10px] sm:p-1 sm:mt-1.5;
  }

  /* Expand Button */
  .expand-button {
    @apply w-5 h-5 flex items-center justify-center text-kong-text-secondary 
           bg-kong-bg-dark/50 rounded-full border border-kong-border/30 text-sm sm:w-4 sm:h-4 sm:text-xs;
  }

  /* Fee Details Container */
  .fee-details {
    @apply mt-3 pt-3 border-t border-kong-border/20 space-y-2 sm:mt-2 sm:pt-2 sm:space-y-1.5;
  }

  /* Fee Detail Row */
  .fee-detail-row {
    @apply flex items-center justify-between;
  }

  /* Fee Detail Label */
  .fee-detail-label {
    @apply text-[10px] text-kong-text-secondary flex items-center gap-1.5 sm:text-sm sm:gap-1;
  }

  /* Fee Dot Indicator */
  .fee-dot {
    @apply w-2 h-2 rounded-full sm:w-1.5 sm:h-1.5;
  }

  /* Network Fee Dot */
  .fee-dot.network {
    @apply bg-kong-accent-blue;
  }

  /* LP Fee Dot */
  .fee-dot.lp {
    @apply bg-kong-accent-purple;
  }

  /* Fee Detail Values Container */
  .fee-detail-values {
    @apply flex flex-col items-end gap-1 sm:gap-0.5;
  }

  /* Fee Amount */
  .fee-amount {
    @apply text-[10px] text-kong-text-primary sm:text-sm;
  }

  /* Mobile Responsive Styles */
  @media (max-width: 640px) {
    /* Improve touch targets */
    .detail-card.fees {
      @apply min-h-[42px] active:bg-kong-bg-dark/40;
      -webkit-tap-highlight-color: transparent;
    }
    
    /* Reduce visual complexity */
    .detail-card {
      @apply border-opacity-30;
    }
    
    /* Ensure proper spacing */
    .fees-section {
      @apply pb-1;
    }
  }
</style>
