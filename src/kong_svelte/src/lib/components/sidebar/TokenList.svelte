<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import { tokenStore, formattedTokens, portfolioValue } from "$lib/services/tokens/tokenStore";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { RefreshCw } from "lucide-svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import TokenQtyInput from "$lib/components/common/TokenQtyInput.svelte";

  let selectedToken: any = null;
  let isModalOpen = false;
  let amount = "";
  let error = "";
  let balance = "0";
  let isRefreshing = false;
  
  function handleTokenClick(token: any) {
    selectedToken = token;
    isModalOpen = true;
  }

  function handleCloseModal() {
    isModalOpen = false;
    selectedToken = null;
  }

  function handleReload() {
    isRefreshing = true;
    tokenStore.loadBalances().then(() => {
      isRefreshing = false;
    });
  }

  function handleInput(event) {
    const value = event.detail.value;
    // Validate amount
    if (parseFloat(value) > parseFloat(balance.toString())) {
      error = "Insufficient balance";
    } else {
      error = "";
    }
  }
  

  $: balance =
    $formattedTokens?.find(
      (token) => token.canister_id === selectedToken?.canister_id,
    )?.formattedBalance || "0";

  $: sortedTokens = [...($formattedTokens || [])].sort((a, b) => {
    const aValue = parseFloat(a.formattedUsdValue.replace(/[^0-9.-]+/g, ''));
    const bValue = parseFloat(b.formattedUsdValue.replace(/[^0-9.-]+/g, ''));
    return bValue - aValue; // Sort in descending order
  });
</script>

<div class="token-list w-full">
  <div class="portfolio-value">
    <button
      class="portfolio-refresh-button"
      on:click={handleReload}
      aria-label="Refresh Portfolio Value"
    >
      <h3 class="text-xs uppercase font-semibold">Portfolio Value</h3>
      <p class="text-3xl font-bold font-mono">
        {#if isRefreshing}
          <LoadingIndicator />
        {:else}
          ${$portfolioValue}
        {/if}
      </p>
      <div class="refresh-overlay">
        <RefreshCw size={24} />
      </div>
    </button>
  </div>
  {#if $tokenStore.isLoading && $formattedTokens.length === 0}
    <div class="loading"><LoadingIndicator /></div>
  {:else if $tokenStore.error}
    <div class="error">{$tokenStore.error}</div>
  {:else}
    {#each sortedTokens as token (token.canister_id)}
      <TokenRow {token} onClick={() => handleTokenClick(token)} />
    {/each}
  {/if}
</div>

<Modal
  show={isModalOpen}
  onClose={handleCloseModal}
  title={"Send " + (selectedToken?.symbol || "Token Details")}
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
        <h3 class="text-lg font-semibold text-yellow-500">
          {selectedToken.symbol}
        </h3>
        <p class="text-base">
          {selectedToken.formattedBalance} {selectedToken.symbol}
        </p>
        <p class="text-base">${selectedToken.formattedUsdValue}</p>
      </div>
    </div>

    <div class="transfer-section">
      <TokenQtyInput
        bind:value={amount}
        token={selectedToken}
        {error}
        onInput={handleInput}
      />
      <TextInput
        id="principal"
        placeholder="Destination pid"
        required
        size="lg"
      />
    </div>

    <div class="modal-buttons">
      <Button text="Close" on:click={handleCloseModal} />
      <Button text="Send" variant="green" on:click={handleCloseModal} />
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
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    margin-bottom: 16px;
    transition: transform 0.2s ease;
  }

  .portfolio-value:hover {
    transform: scale(1.02);
  }

  .portfolio-refresh-button {
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    padding: 12px;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .portfolio-refresh-button:active {
    transform: scale(0.98);
  }

  .refresh-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(2px);
    opacity: 0;
    transition: all 0.3s ease;
    color: white;
    gap: 8px;
  }

  .refresh-overlay :global(svg) {
    transition: transform 0.3s ease;
  }

  .portfolio-refresh-button:hover .refresh-overlay :global(svg) {
    transform: rotate(180deg);
  }

  .portfolio-refresh-button:hover .refresh-overlay,
  .portfolio-refresh-button:focus-visible .refresh-overlay {
    opacity: 0.69;
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
