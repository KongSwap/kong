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
      <TokenImages tokens={[payToken]} size={24} />
      <div class="token-details">
        <span class="type">You Pay</span>
        <span class="amount">{payAmount} {payToken?.symbol}</span>
      </div>
    </div>
  </div>
  
  <div class="token-section">
    <div class="token-info">
      <TokenImages tokens={[receiveToken]} size={24} />
      <div class="token-details">
        <span class="type">You Receive</span>
        <span class="amount">{receiveAmount} {receiveToken?.symbol}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
  }

  .token-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .token-section:first-child {
    margin-bottom: 8px;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .token-details {
    display: flex;
    flex-direction: column;
  }

  .type {
    color: #ffd700;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .amount {
    font-size: 1rem;
    font-weight: 500;
    color: #ffffff;
  }
</style>
