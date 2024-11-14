<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import { tokenStore, formattedTokens, toggleFavoriteToken, isTokenFavorite } from "$lib/services/tokens/tokenStore";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import TokenQtyInput from "$lib/components/common/TokenQtyInput.svelte";
  import { IcrcService } from "$lib/services/icrc/icrcService";

  let selectedToken: any = null;
  let isModalOpen = false;
  let amount = "";
  let error = "";
  let balance = "0";
  let destinationPid;
  
  function handleTokenClick(token: any) {
    selectedToken = token;
    isModalOpen = true;
  }

  function handleCloseModal() {
    isModalOpen = false;
    selectedToken = null;
  }

  function handleInput(event) {
    const value = event.detail.value;
    if (parseFloat(value) > parseFloat(balance.toString())) {
      error = "Insufficient balance";
    } else {
      error = "";
    }
  }

  function handleFavoriteClick(event: MouseEvent, token: any) {
    event.stopPropagation(); // Prevent modal from opening
    toggleFavoriteToken(token.canister_id);
  }

  const sendToken = async () => {
    const tx = await IcrcService.icrc1Transfer(selectedToken, destinationPid, BigInt(amount));
    console.log(tx);
  }

  $: balance = $formattedTokens?.find(
    (token) => token.canister_id === selectedToken?.canister_id,
  )?.formattedBalance || "0";
</script>

<div class="token-list w-full">
  {#if $tokenStore.isLoading && $formattedTokens.length === 0}
    <div class="loading"><LoadingIndicator /></div>
  {:else if $tokenStore.error}
    <div class="error">{$tokenStore.error}</div>
  {:else}
    {#each $formattedTokens as token (token.canister_id)}
      <div class="token-row-wrapper">
        <div class="flex-grow" on:click={() => handleTokenClick(token)}>
          <TokenRow {token} />
        </div>
        <button
          class="favorite-button"
          on:click={(e) => handleFavoriteClick(e, token)}
          aria-label={isTokenFavorite(token.canister_id) ? "Remove from favorites" : "Add to favorites"}
        >
          {#if isTokenFavorite(token.canister_id)}
            <span class="star filled">★</span>
          {:else}
            <span class="star outline">☆</span>
          {/if}
        </button>
      </div>
    {/each}
  {/if}
</div>

<Modal
  show={isModalOpen}
  onClose={handleCloseModal}
  title={"Send " + (selectedToken?.symbol || "Token Details")}
  width="480px"
  height="100%"
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
        bind:value={destinationPid}
        required
        size="lg"
      />
    </div>

    <div class="modal-buttons">
      <Button text="Close" on:click={handleCloseModal} />
      <Button text="Send" variant="green" on:click={() => sendToken()} />
    </div>
  {/if}
</Modal>

<style scoped lang="postcss">
  .token-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .token-row-wrapper {
    display: flex;
    align-items: center;
    padding: 8px;
    border-radius: 8px;
    transition: background-color 0.2s;
    cursor: pointer;
  }

  .token-row-wrapper:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .favorite-button {
    background: transparent;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    transition: all 100ms;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .favorite-button:hover {
    color: rgb(253, 224, 71);
    transform: scale(1.1);
  }

  .star {
    font-size: 1.25rem;
    border: none;
    outline: none;
    line-height: 1;
  }

  .star.filled {
    color: rgb(253, 224, 71);
  }

  .loading,
  .error {
    text-align: center;
    padding: 16px;
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
