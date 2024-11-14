<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import { tokenStore, formattedTokens } from "$lib/services/tokens/tokenStore";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import TokenQtyInput from "$lib/components/common/TokenQtyInput.svelte";
  import {IcrcService} from "$lib/services/icrc/icrcService";

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
    // Validate amount
    if (parseFloat(value) > parseFloat(balance.toString())) {
      error = "Insufficient balance";
    } else {
      error = "";
    }
  }

  const sendToken = async () => {
    const tx = await IcrcService.icrc1Transfer(selectedToken, destinationPid, BigInt(amount));
    console.log(tx);
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
