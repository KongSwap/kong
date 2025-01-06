<script lang="ts">
	import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  export let payToken: FE.Token;
  export let payAmount: string;
  export let receiveToken: FE.Token;
  export let receiveAmount: string;
  export let payUsdValue: string;
  export let receiveUsdValue: string;
</script>

<div class="section rounded">
  <div class="token-section">
    <div class="token-info">
      <TokenImages tokens={[payToken]} size={38} containerClass="token-image" />
      <div class="token-details">
        <span class="type">You Pay</span>
        <span class="amount">{payAmount} {payToken?.symbol}</span>
        <span class="text-xs">${formatToNonZeroDecimal(Number(payAmount) * Number(payToken?.metrics.price))}</span>
      </div>
    </div>
  </div>
  
  <div class="divider"></div>
  
  <div class="token-section">
    <div class="token-info">
      <TokenImages tokens={[receiveToken]} size={38} containerClass="token-image" />
      <div class="token-details">
        <span class="type">You Receive</span>
        <span class="amount">{receiveAmount} {receiveToken?.symbol}</span>
        <span class="text-xs">${formatToNonZeroDecimal(Number(receiveAmount) * Number(receiveToken?.metrics.price))}</span>
      </div>
    </div>
  </div>
</div>

<style scoped lang="postcss">
  .section {
    @apply bg-kong-bg-dark border border-kong-bg-dark rounded;
    padding: 16px;
  }

  .token-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }

  .divider {
    width: 100%;
    height: 1px;
    @apply bg-kong-bg-dark/20;
    margin: 8px 0;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .type {
    font-size: 14px;
    @apply text-kong-text-secondary;
  }

  .amount {
    font-size: 18px;
    font-weight: 500;
    @apply text-kong-text-primary;
    letter-spacing: -0.01em;
  }

  @media (max-width: 640px) {
    .section {
      padding: 0.25rem 12px;
    }

    .token-section {
      padding: 4px 0;
    }

    .token-info {
      gap: 8px;
    }

    .type {
      font-size: 12px;
    }

    .amount {
      font-size: 14px;
    }

    .divider {
      margin: 4px 0;
    }
  }
</style>
