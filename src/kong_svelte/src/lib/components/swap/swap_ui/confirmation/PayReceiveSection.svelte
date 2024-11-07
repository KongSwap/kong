<script lang="ts">
	import  TokenImages from '$lib/components/common/TokenImages.svelte';
  import { tokenStore } from '$lib/stores/tokenStore';
  
  export let payToken: string;
  export let payAmount: string;
  export let receiveToken: string;
  export let receiveAmount: string;
</script>

<div class="section">
  <div class="token-amount">
    <span class="label">You Pay</span>
    <div class="amount">
      <TokenImages
        tokens={[
          $tokenStore.tokens?.find(t => t.symbol === payToken) || "/tokens/not_verified.webp"
        ]}
        size={24}
      />
      <span class="value">{payAmount}</span>
      <span class="token">{payToken}</span>
    </div>
  </div>
  
  <div class="token-amount">
    <span class="label">You Receive</span>
    <div class="amount">
      <TokenImages
        tokens={[
          $tokenStore.tokens?.find(t => t.symbol === receiveToken) || "/tokens/not_verified.webp"
        ]}
        size={24}
      />
      <span class="value">{receiveAmount}</span>
      <span class="token">{receiveToken}</span>
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
