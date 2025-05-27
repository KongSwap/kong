<script lang="ts">
  import BigNumber from "bignumber.js";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userTokens } from "$lib/stores/userTokens";
  import { slide } from "svelte/transition";
  import { AlertTriangle, Info, DollarSign, Activity } from "lucide-svelte";

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

<div class="fees-container">
  <!-- Price Impact Card -->
  <div class="info-card" class:warning={showPriceImpactWarning} class:critical={priceImpact > 5}>
    <div class="info-row">
      <div class="info-label">
        <Activity size={16} class="info-icon" />
        <span>Price Impact</span>
      </div>
      <div class="info-value-group">
        <span class="info-value" class:warning-value={showPriceImpactWarning}>
          {priceImpact.toFixed(2)}%
        </span>
        {#if showPriceImpactWarning}
          <AlertTriangle size={14} class="warning-icon" />
        {/if}
      </div>
    </div>
    {#if showPriceImpactWarning}
      <div class="warning-message" transition:slide={{ duration: 150 }}>
        <div class="warning-dot"></div>
        <span>{priceImpact > 5 ? 'Very high' : 'High'} price impact due to low liquidity</span>
      </div>
    {/if}
  </div>

  <!-- Fees Card -->
  <button 
    class="info-card expandable"
    class:expanded={isExpanded}
    on:click={() => isExpanded = !isExpanded}
    type="button"
  >
    <div class="info-row">
      <div class="info-label">
        <DollarSign size={16} class="info-icon" />
        <span>Total Fees</span>
      </div>
      <div class="info-value-group">
        <span class="info-value">
          ${formatToNonZeroDecimal(totalFeesUsd)}
        </span>
        <div class="expand-icon" class:rotated={isExpanded}>
          <Info size={14} />
        </div>
      </div>
    </div>

    <!-- Expanded Fee Breakdown -->
    {#if isExpanded}
      <div class="fee-breakdown" transition:slide={{ duration: 150 }}>
        <!-- Network Fees -->
        <div class="fee-item">
          <div class="fee-label">
            <div class="fee-indicator network"></div>
            <span>Network Fee</span>
          </div>
          <div class="fee-values">
            {#each gasFees as fee}
              {#if new BigNumber(fee.amount).gt(0)}
                <span class="fee-amount">
                  {fee.amount} <span class="fee-token">{fee.token}</span>
                </span>
              {/if}
            {/each}
          </div>
        </div>
        
        <!-- LP Fees -->
        <div class="fee-item">
          <div class="fee-label">
            <div class="fee-indicator lp"></div>
            <span>LP Fee (0.3%)</span>
          </div>
          <div class="fee-values">
            {#each lpFees as fee}
              {#if new BigNumber(fee.amount).gt(0)}
                <span class="fee-amount">
                  {fee.amount} <span class="fee-token">{fee.token}</span>
                </span>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </button>

  <!-- Max Slippage Info -->
  <div class="slippage-info">
    <span class="slippage-label">Max slippage</span>
    <span class="slippage-value">{userMaxSlippage}%</span>
  </div>
</div>

<style lang="postcss">
  /* Container */
  .fees-container {
    @apply flex flex-col gap-3;
  }

  /* Info Card Base */
  .info-card {
    @apply relative bg-gradient-to-br from-kong-bg-secondary/40 to-kong-bg-tertiary/30 
           border border-kong-border/20 rounded-xl p-3.5
           transition-all duration-300 backdrop-blur-sm;
  }

  /* Warning State */
  .info-card.warning {
    @apply border-kong-warning/30 bg-gradient-to-br from-kong-warning/10 to-kong-warning/5;
  }

  /* Critical State */
  .info-card.critical {
    @apply border-kong-error/30 bg-gradient-to-br from-kong-error/10 to-kong-error/5;
  }

  /* Expandable Card */
  .info-card.expandable {
    @apply cursor-pointer hover:border-kong-border/40;
  }

  .info-card.expanded {
    @apply border-kong-primary/30 bg-gradient-to-br from-kong-primary/5 to-kong-primary/10;
  }

  /* Info Row */
  .info-row {
    @apply flex items-center justify-between;
  }

  /* Info Label */
  .info-label {
    @apply flex items-center gap-2 text-sm text-kong-text-secondary;
  }

  .info-icon {
    @apply text-kong-text-secondary/70;
  }

  /* Info Value Group */
  .info-value-group {
    @apply flex items-center gap-2;
  }

  /* Info Value */
  .info-value {
    @apply text-sm font-semibold text-kong-text-primary;
  }

  .info-value.warning-value {
    @apply text-kong-warning;
  }

  .info-card.critical .info-value.warning-value {
    @apply text-kong-error;
  }

  /* Warning Icon */
  .warning-icon {
    @apply text-kong-warning;
  }

  .info-card.critical .warning-icon {
    @apply text-kong-error;
  }

  /* Expand Icon */
  .expand-icon {
    @apply w-5 h-5 flex items-center justify-center text-kong-text-secondary/70
           bg-kong-bg-primary/30 rounded-full transition-all duration-200;
  }

  .expand-icon.rotated {
    @apply rotate-180 bg-kong-primary/20 text-kong-primary;
  }

  /* Warning Message */
  .warning-message {
    @apply flex items-center gap-2 mt-2.5 pt-2.5 border-t border-kong-border/20
           text-xs text-kong-warning;
  }

  .info-card.critical .warning-message {
    @apply text-kong-error;
  }

  .warning-dot {
    @apply w-1.5 h-1.5 rounded-full bg-kong-warning animate-pulse;
  }

  .info-card.critical .warning-dot {
    @apply bg-kong-error;
  }

  /* Fee Breakdown */
  .fee-breakdown {
    @apply mt-3 pt-3 border-t border-kong-border/20 space-y-2.5;
  }

  /* Fee Item */
  .fee-item {
    @apply flex items-center justify-between;
  }

  /* Fee Label */
  .fee-label {
    @apply flex items-center gap-2 text-xs text-kong-text-secondary;
  }

  /* Fee Indicator */
  .fee-indicator {
    @apply w-2 h-2 rounded-full;
  }

  .fee-indicator.network {
    @apply bg-gradient-to-br from-kong-info to-kong-info-hover;
  }

  .fee-indicator.lp {
    @apply bg-gradient-to-br from-kong-primary to-kong-secondary;
  }

  /* Fee Values */
  .fee-values {
    @apply flex flex-col items-end gap-0.5;
  }

  /* Fee Amount */
  .fee-amount {
    @apply text-xs font-medium text-kong-text-primary;
  }

  .fee-token {
    @apply text-kong-text-secondary font-normal;
  }

  /* Slippage Info */
  .slippage-info {
    @apply flex items-center justify-between px-3 py-2
           bg-kong-bg-secondary/20 border border-kong-border/10 
           rounded-lg text-xs;
  }

  .slippage-label {
    @apply text-kong-text-secondary;
  }

  .slippage-value {
    @apply font-medium text-kong-text-primary;
  }

  /* Animations */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Mobile Responsiveness */
  @media (max-width: 640px) {
    .info-card {
      @apply p-3;
    }

    .info-card.expandable {
      @apply active:bg-kong-bg-primary/50;
      -webkit-tap-highlight-color: transparent;
    }

    .fee-breakdown {
      @apply mt-2.5 pt-2.5;
    }
  }
</style>
