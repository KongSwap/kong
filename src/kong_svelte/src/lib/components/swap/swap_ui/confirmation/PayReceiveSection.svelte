<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  export let payToken: FE.Token;
  export let payAmount: string;
  export let receiveToken: FE.Token;
  export let receiveAmount: string;

</script>

<div class="section">
  <div class="token-section">
    <div class="token-info">
      <TokenImages tokens={[payToken]} size={32} containerClass="token-image" />
      <div class="token-details">
        <span class="type">You Pay</span>
        <span class="amount">{payAmount} {payToken?.symbol}</span>
      </div>
    </div>
  </div>
  
  <div class="divider"></div>
  
  <div class="token-section">
    <div class="token-info">
      <TokenImages tokens={[receiveToken]} size={32} containerClass="token-image" />
      <div class="token-details">
        <span class="type">You Receive</span>
        <span class="amount">{receiveAmount} {receiveToken?.symbol}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(26, 27, 35, 0.6);
    border: 1px solid rgba(42, 45, 61, 1);
    border-radius: 12px;
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
    background: rgba(255, 255, 255, 0.1);
    margin: 8px 0;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .token-image {
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .type {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
  }

  .amount {
    font-size: 18px;
    font-weight: 500;
    color: white;
    letter-spacing: -0.01em;
  }
</style>
