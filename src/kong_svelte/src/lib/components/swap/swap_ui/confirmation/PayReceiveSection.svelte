<script lang="ts">
	import  TokenImages from '$lib/components/common/TokenImages.svelte';
  
  export let payToken: FE.Token;
  export let payAmount: string;
  export let receiveToken: FE.Token;
  export let receiveAmount: string;
</script>

<div class="section">
  <div class="token-amount">
    <span class="label">You Pay</span>
    <div class="amount">
      <TokenImages
        tokens={[payToken]}
        size={24}
      />
      <span class="value">{payAmount}</span>
      <span class="token">{payToken.symbol}</span>
    </div>
  </div>
  
  <div class="token-amount">
    <span class="label">You Receive</span>
    <div class="amount">
      <TokenImages
        tokens={[receiveToken]}
        size={24}
      />
      <span class="value">{receiveAmount}</span>
      <span class="token">{receiveToken.symbol}</span>
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
  }

  .token-amount {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .token-amount:first-child {
    margin-bottom: 8px;
  }

  .label {
    color: #ffd700;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .amount {
    font-size: 1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .value {
    color: #ffffff;
  }

  .token {
    color: #ffd700;
    font-weight: 500;
  }
</style>
