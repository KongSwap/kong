<script lang="ts">
  import { tokenStore } from '$lib/stores/tokenStore';
  
  export let payToken: string;
  export let payAmount: string;
  export let receiveToken: string;
  export let receiveAmount: string;
</script>

<div class="section">
  <div class="amount-row">
    <div class="label">You Pay</div>
    <div class="token-amount">
      <img 
        src={$tokenStore.tokens?.find(t => t.symbol === payToken)?.logo || "/tokens/not_verified.webp"}
        alt={payToken}
        class="token-icon"
      />
      <span class="token-symbol">{payToken}</span>
      <span class="amount">{payAmount}</span>
    </div>
  </div>

  <div class="arrow">↓</div>

  <div class="amount-row">
    <div class="label">You Receive</div>
    <div class="token-amount">
      <img 
        src={$tokenStore.tokens?.find(t => t.symbol === receiveToken)?.logo || "/tokens/not_verified.webp"}
        alt={receiveToken}
        class="token-icon"
      />
      <span class="token-symbol">{receiveToken}</span>
      <span class="amount">{receiveAmount}</span>
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
  }

  .amount-row {
    background: rgba(0, 0, 0, 0.1);
    padding: 16px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .label {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .token-amount {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .token-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .token-symbol {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.875rem;
    color: #fff;
  }

  .amount {
    font-family: monospace;
    font-size: 1.25rem;
    color: #fff;
    font-weight: 500;
  }

  .arrow {
    display: flex;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.5rem;
    padding: 8px 0;
  }
</style> 
