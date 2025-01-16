<script lang="ts">
  import BigNumber from "bignumber.js";

  export let gasFees: { amount: string; token: string }[] = [];
  export let lpFees: { amount: string; token: string }[] = [];
  export let userMaxSlippage: number;
  export let receiveToken: FE.Token;

  $: totalGasFee = gasFees.reduce((total, fee) => 
    new BigNumber(total).plus(fee.amount).toString(), "0"
  );
  
  $: totalLPFee = lpFees.reduce((total, fee) => 
    new BigNumber(total).plus(fee.amount).toString(), "0"
  );
</script>

<div class="fees-section p-4">
  <h3 class="text-sm font-medium mb-2">Fees</h3>
  
  <!-- Gas Fees -->
  <div class="fee-group mb-2">
    <span class="text-sm text-gray-400">Network Fees:</span>
    <div class="fee-details">
      {#each gasFees as fee}
        {#if new BigNumber(fee.amount).gt(0)}
          <div class="fee-item">
            <span>{fee.amount} {fee.token}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- LP Fees -->
  <div class="fee-group mb-2">
    <span class="text-sm text-gray-400">Liquidity Provider Fees:</span>
    <div class="fee-details">
      {#each lpFees as fee}
        {#if new BigNumber(fee.amount).gt(0)}
          <div class="fee-item">
            <span>{fee.amount} {fee.token}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Max Slippage -->
  <div class="fee-group">
    <span class="text-sm text-gray-400">Max Slippage:</span>
    <span>{userMaxSlippage}%</span>
  </div>
</div>

<style>
  .fees-section {
    @apply bg-opacity-50 rounded-lg;
  }

  .fee-group {
    @apply flex justify-between items-center;
  }

  .fee-details {
    @apply flex flex-col items-end;
  }

  .fee-item {
    @apply text-sm;
  }
</style>
