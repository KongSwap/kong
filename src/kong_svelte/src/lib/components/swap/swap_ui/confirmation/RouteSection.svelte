<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatBalance, formatGasFee } from '$lib/utils/tokenFormatters';
  import { tokenStore } from "$lib/services/tokens/tokenStore";

  export let routingPath: string[] = [];
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];

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
  <div class="route-content">
    <div class="path">
      {#each tokens as token, i}
        <div class="token">
          <TokenImages tokens={[token]} size={24} containerClass="token-image" />
          <span class="symbol">{token.symbol}</span>
        </div>
        {#if i < tokens.length - 1}
          <span class="arrow">→</span>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(26, 27, 35, 0.6);
    border: 1px solid rgba(42, 45, 61, 1);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .route-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    width: 100%;
  }

  .path {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;
  }

  .token {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .symbol {
    color: #ffffff;
    font-size: 0.9rem;
  }

  .arrow {
    color: #ffffff;
    opacity: 0.5;
  }

  @media (max-width: 640px) {
    .section {
      padding: 8px;
    }

    .route-content {
      gap: 4px;
    }

    .path {
      gap: 4px;
    }

    .token {
      gap: 4px;
    }

    .token :global(img) {
      width: 20px !important;
      height: 20px !important;
    }

    .symbol {
      font-size: 0.8rem;
    }

    .arrow {
      font-size: 0.8rem;
      margin: 0 -2px;
    }
  }
</style>
