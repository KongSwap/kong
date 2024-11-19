<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatBalance, formatGasFee } from '$lib/utils/tokenFormatters';
  import { tokenStore } from "$lib/services/tokens/tokenStore";

  export let routingPath: string[] = [];
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];
  export let payToken: FE.Token;
  export let receiveToken: FE.Token;

  // Convert routing path to tokens
  $: tokens = routingPath.map(symbol => 
    $tokenStore.tokens.find(t => t.symbol === symbol)
  ).filter((t): t is FE.Token => t !== undefined);

  // Calculate gas fees per token
  $: formattedGasFees = tokens.map((token, i) => ({
    token,
    amount: gasFees[i] || "0",
  })).filter(fee => fee.amount !== "0");

  // Calculate LP fees per token
  $: formattedLpFees = tokens.map((token, i) => ({
    token,
    amount: lpFees[i] || "0",
  })).filter(fee => fee.amount !== "0");
</script>

<div class="section">
  <h3>Route</h3>
  <div class="path">
    {#each tokens as token, i}
      <div class="token">
        <TokenImages tokens={[token]} size={24} />
        <span class="symbol">{token.symbol}</span>
      </div>
      {#if i < tokens.length - 1}
        <span class="arrow">→</span>
      {/if}
    {/each}
  </div>

  {#if formattedGasFees.length > 0}
    <div class="fees">
      <h4>Network Fees</h4>
      {#each formattedGasFees as fee}
        <div class="fee-item">
          <TokenImages tokens={[fee.token]} size={20} />
          <span class="fee-amount">
            {formatGasFee(fee.amount, fee.token.decimals)} {fee.token.symbol}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  {#if formattedLpFees.length > 0}
    <div class="fees">
      <h4>LP Fees</h4>
      {#each formattedLpFees as fee}
        <div class="fee-item">
          <TokenImages tokens={[fee.token]} size={20} />
          <span class="fee-amount">
            {formatBalance(fee.amount, fee.token.decimals)} {fee.token.symbol}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .section {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
  }

  h3 {
    color: #ffd700;
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 8px;
  }

  h4 {
    color: #ffffff;
    font-size: 0.9rem;
    font-weight: 500;
    margin: 8px 0;
    opacity: 0.8;
  }

  .path {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .token {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .symbol {
    color: #ffffff;
    font-size: 0.9rem;
  }

  .arrow {
    color: #ffffff;
    opacity: 0.5;
  }

  .fees {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .fee-item {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 4px 0;
  }

  .fee-amount {
    color: #ffffff;
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>
