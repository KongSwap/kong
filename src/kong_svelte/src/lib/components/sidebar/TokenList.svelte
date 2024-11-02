<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import { tokenStore, formattedTokens } from "$lib/stores/tokenStore";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { onMount } from "svelte";
  import { walletStore } from "$lib/stores/walletStore";
  import { RefreshCw } from "lucide-svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import TokenQtyInput from "$lib/components/common/TokenQtyInput.svelte";
  
  let selectedToken: any = null;
  let isModalOpen = false;
  let amount = '';
  let error = '';
  let balance = 0;

  onMount(async () => {
    if ($walletStore.isConnected) {
      await tokenStore.loadTokens();
      await tokenStore.loadBalances();
    }
  });

  function handleTokenClick(token: any) {
    selectedToken = token;
    console.log(selectedToken);
    isModalOpen = true;
  }

  function handleCloseModal() {
    isModalOpen = false;
    selectedToken = null;
  }

  function handleReload() {
    tokenStore.reloadTokensAndBalances();
  }

  function handleInput(event) {
    const value = event.detail.value;
    // Validate amount
    if (parseFloat(value) > parseFloat(balance)) {
      error = 'Insufficient balance';
    } else {
      error = '';
    }
  }

  $: balance = $formattedTokens.tokens.find(token => token.canister_id === selectedToken?.canister_id)?.formattedBalance || 0;
</script>

<div class="token-list w-full">
  {#if $tokenStore.isLoading}
    <div class="loading"><LoadingIndicator /></div>
  {:else if $tokenStore.error}
    <div class="error">{$tokenStore.error}</div>
  {:else}
    <div class="relative flex justify-end">
      <button
        class="flex items-center px-2 py-1 bg-white/10 hover:bg-yellow-500 hover:text-black rounded-md"
        on:click={handleReload}
        aria-label="Refresh Balances"
      >
        <RefreshCw size={18} class="mr-2" /> Refresh Balances
      </button>
    </div>

    <div class="portfolio-value">
      <h3 class="text-xs uppercase font-semibold">Portfolio Value</h3>
      <p class="text-3xl font-bold font-mono">
        ${$formattedTokens.portfolioValue}
      </p>
    </div>

    {#each $formattedTokens.tokens as token (token.canister_id)}
      <TokenRow {token} onClick={() => handleTokenClick(token)} />
    {/each}
  {/if}
</div>

<Modal
  isOpen={isModalOpen}
  onClose={handleCloseModal}
  title={"Send " + selectedToken?.symbol || "Token Details"}
  width="480px"
>
  {#if selectedToken}
    <div class="token-details w-[380px]">
      <img
        src={selectedToken.logo || "/tokens/not_verified.webp"}
        alt={selectedToken.name}
        class="token-logo"
      />
      <div class="token-info w-full">
        <h3 class="text-lg font-semibold text-yellow-500">{selectedToken.symbol}</h3>
        <p class="text-base">{selectedToken.formattedBalance} {selectedToken.symbol}</p>
        <p class="text-base">${selectedToken.formattedUsdValue}</p>
      </div>
    </div>

    <div class="transfer-section">
      <TokenQtyInput
    bind:value={amount}
    token={selectedToken}
    {error}
    on:input={handleInput}
/>
      <TextInput
    id="principal"
    placeholder="Destination pid"
    required
    size="lg"
/>
    </div>

    <div class="modal-buttons">
      <Button text="Close" onClick={handleCloseModal} />
      <Button text="Send" variant="green" onClick={handleCloseModal} />
    </div>
  {/if}
</Modal>

<style lang="postcss" scoped>
  .token-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .loading,
  .error {
    text-align: center;
    padding: 16px;
  }

  .portfolio-value {
    position: relative;
    text-align: center;
    padding: 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .token-details {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
  }

  .token-logo {
    width: 88px;
    height: 88px;
    border-radius: 50%;
  }

  .token-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .token-info h3 {
    font-family: "Press Start 2P", monospace;
    margin: 0;
  }

  .token-info p {
    margin: 0;
    opacity: 0.8;
  }

  .modal-buttons {
    @apply flex justify-center gap-4;
    @apply pb-2.5 mt-4;
  }

  .transfer-section {
    @apply flex flex-col gap-4;
    @apply mt-2 pb-4;
  }
</style>
