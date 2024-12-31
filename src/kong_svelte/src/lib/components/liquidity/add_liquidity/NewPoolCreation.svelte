<script lang="ts">
  import { addLiquidityStore } from "$lib/services/pools/addLiquidityStore";
  import { PoolService } from "$lib/services/pools/PoolService";
  import { toastStore } from "$lib/stores/toastStore";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import Modal from "$lib/components/common/Modal.svelte";

  export let token0: FE.Token;
  export let token1: FE.Token;
  export let amount0: string;
  export let amount1: string;
  export let onSuccess: () => void;
  export let disabled = false;

  let showConfirmModal = false;

  function openModal() {
    showConfirmModal = true;
  }

  async function handleCreatePool() {
    try {
      const amount0BigInt = parseTokenAmount(amount0, token0.decimals);
      const amount1BigInt = parseTokenAmount(amount1, token1.decimals);
      const initialPrice = parseFloat($addLiquidityStore.initialPrice);

      await PoolService.createPool({
        token_0: token0,
        amount_0: amount0BigInt,
        token_1: token1,
        amount_1: amount1BigInt,
        initial_price: initialPrice
      });

      addLiquidityStore.reset();
      toastStore.success(`Successfully created ${token0.symbol}/${token1.symbol} pool`);
      onSuccess();
    } catch (err) {
      console.error("Error creating pool:", err);
      toastStore.error(err.message);
    }
  }
</script>

<slot openModal={openModal} />

<Modal
  title="Confirm Pool Creation"
  isOpen={showConfirmModal}
  onClose={() => showConfirmModal = false}
  variant="yellow"
  height="auto"
>
  <div class="confirm-dialog-content">
    <div class="confirm-section">
      <h4>Initial Liquidity</h4>
      <div class="token-amounts">
        <div class="token-amount">
          <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
          <div class="amount-details">
            <span class="amount">{amount0}</span>
            <span class="symbol">{token0.symbol}</span>
          </div>
        </div>
        <div class="token-amount">
          <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
          <div class="amount-details">
            <span class="amount">{amount1}</span>
            <span class="symbol">{token1.symbol}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="confirm-section">
      <h4>Initial Price</h4>
      <div class="price-info">
        1 {token0.symbol} = {$addLiquidityStore.initialPrice} {token1.symbol}
      </div>
    </div>

    <div class="warning-box">
      <p class="warning-text">
        Please verify all details carefully. Pool creation cannot be undone.
      </p>
    </div>

    <div class="modal-actions">
      <button 
        class="cancel-button"
        on:click={() => showConfirmModal = false}
      >
        Cancel
      </button>
      <button 
        class="confirm-button"
        on:click={handleCreatePool}
      >
        Confirm Creation
      </button>
    </div>
  </div>
</Modal>

<style lang="postcss">
  .pool-creation-section {
    @apply p-6 rounded-lg;
    @apply bg-yellow-500/5 border border-yellow-500/20;
    @apply space-y-4;
  }

  .pool-creation-header {
    @apply flex items-center gap-2;
    @apply mb-4;
  }

  .pool-creation-header h3 {
    @apply text-yellow-500 font-semibold text-lg;
  }

  .pool-info-section {
    @apply space-y-6 p-4 rounded-lg;
    @apply bg-black/20 border border-white/10;
  }

  .info-group h4 {
    @apply text-white/70 text-sm font-medium mb-2;
  }

  .token-amounts {
    @apply space-y-3;
  }

  .token-amount {
    @apply flex items-center gap-3;
  }

  .token-logo {
    @apply w-8 h-8 rounded-full;
  }

  .amount-details {
    @apply flex items-baseline gap-2;
  }

  .amount {
    @apply text-white text-lg font-medium;
  }

  .symbol {
    @apply text-white/70 text-sm;
  }

  .price-display {
    @apply text-white text-lg font-medium;
  }

  .creation-warning {
    @apply text-sm text-white/70;
    @apply p-4 rounded;
    @apply bg-black/20 border border-yellow-500/20;
  }

  .warning-header {
    @apply font-medium text-yellow-500 mb-2;
  }

  .creation-warning ul {
    @apply list-disc pl-4 space-y-2;
  }

  .create-pool-button {
    @apply w-full px-6 py-4 mt-6 rounded-lg;
    @apply bg-yellow-500 text-black font-medium;
    @apply hover:bg-yellow-400 transition-colors duration-200;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .confirm-dialog-content {
    @apply space-y-6;
  }

  .confirm-section {
    @apply space-y-3;
  }

  .confirm-section h4 {
    @apply text-white/70 text-sm font-medium;
  }

  .token-amounts {
    @apply space-y-3;
  }

  .token-amount {
    @apply flex items-center gap-3 bg-black/20 rounded-lg p-3;
  }

  .amount-details {
    @apply flex items-baseline gap-2;
  }

  .amount {
    @apply text-white text-lg font-medium;
  }

  .symbol {
    @apply text-white/70 text-sm;
  }

  .price-info {
    @apply text-white text-lg font-medium bg-black/20 rounded-lg p-3;
  }

  .warning-box {
    @apply bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4;
  }

  .warning-text {
    @apply text-yellow-500 text-sm;
  }

  .dialog-buttons {
    @apply flex gap-3;
  }

  .cancel-button {
    @apply px-6 py-3 rounded-lg w-1/2;
    @apply bg-white/5 text-white font-medium;
    @apply hover:bg-white/10 transition-colors duration-200;
  }

  .confirm-button {
    @apply px-6 py-3 rounded-lg w-1/2;
    @apply bg-kong-accent-green text-black font-medium;
    @apply hover:bg-kong-accent-green transition-colors duration-200;
  }

  .modal-actions {
    @apply flex gap-3 mt-6;
  }
</style> 