<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import {
    tokenStore,
    formattedTokens,
    toggleFavoriteToken,
  } from "$lib/services/tokens/tokenStore";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import TokenQtyInput from "$lib/components/common/TokenQtyInput.svelte";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { tokenLogoStore } from "$lib/services/tokens/tokenLogos";
  import { toastStore } from "$lib/stores/toastStore";
  import { Principal } from "@dfinity/principal";
  import { onDestroy } from "svelte";
    import { auth } from "$lib/services/auth";

  // Accept tokens prop for live data
  export let tokens: any[] = [];

  let selectedToken: any = null;
  let isModalOpen = false;
  let amount: string | number = "";
  let error = "";
  let balance = "0";
  let destinationPid = "";
  let isSending = false;

  function handleInput(value: string) {
    amount = value;
    error = ""; // Clear error when user types
  }

  function validatePrincipal(pid: string): boolean {
    try {
      Principal.fromText(pid);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function handleSend() {
    if (!selectedToken || !amount || !destinationPid) {
      error = "Please fill in all fields";
      return;
    }

    if (!validatePrincipal(destinationPid)) {
      error = "Invalid destination address";
      return;
    }

    const numAmount = parseFloat(amount.toString());
    if (isNaN(numAmount) || numAmount <= 0) {
      error = "Invalid amount";
      return;
    }

    const maxAmount = parseFloat(balance);
    if (numAmount > maxAmount) {
      error = "Insufficient balance";
      return;
    }

    isSending = true;
    error = "";

    try {
      // Convert amount to bigint with proper decimals
      const decimals = selectedToken.decimals || 8;
      const amountBigInt = BigInt(
        Math.floor(numAmount * Math.pow(10, decimals)),
      );

      const result = await IcrcService.icrc1Transfer(
        selectedToken,
        destinationPid,
        amountBigInt,
      );

      if (result?.Ok) {
        handleCloseModal();
        toastStore.success("Token sent successfully");
        // Trigger a token balance refresh
        tokenStore.loadBalance(
          selectedToken,
          $auth.account?.owner?.toString(),
          true,
        );
      } else if (result?.Err) {
        const errMsg =
          typeof result.Err === "object"
            ? Object.entries(result.Err)[0][0]
            : JSON.stringify(result.Err);
        error = `Failed to send token: ${errMsg}`;
        toastStore.error(error);
      }
    } catch (err) {
      error = err.message || "Failed to send token";
      toastStore.error(error);
    } finally {
      isSending = false;
    }
  }

  function handleTokenClick(token: any) {
    if (isModalOpen) {
      handleCloseModal();
      // Wait for modal to close before opening new one
      setTimeout(() => {
        selectedToken = token;
        isModalOpen = true;
      }, 300);
    } else {
      selectedToken = token;
      isModalOpen = true;
    }
  }

  function handleCloseModal() {
    isModalOpen = false;
    // Reset form state after transition
    setTimeout(() => {
      selectedToken = null;
      amount = "";
      destinationPid = "";
      error = "";
      isSending = false;
      balance = "0";
    }, 300); // Match the transition duration
  }

  function handleFavoriteClick(e: MouseEvent, token: any) {
    const owner = $auth?.account?.owner?.toString();
    if (!owner) return;

    toggleFavoriteToken(token.canister_id);
  }

  $: balance =
    processedTokens?.find(
      (token) => token.canister_id === selectedToken?.canister_id,
    )?.formattedBalance || "0";

  // Process and sort tokens data when it changes
  $: processedTokens = tokens
    .map((token) => {
      const formattedToken =
        $formattedTokens?.find((t) => t.canister_id === token.canister_id) ||
        token;
      const favoriteTokens =
        $tokenStore.favoriteTokens[$auth?.account?.owner?.toString()] ||
        [];
      return {
        ...formattedToken,
        logo: $tokenLogoStore[token.canister_id] || null,
        formattedBalance: formattedToken.formattedBalance || "0",
        name: formattedToken.name || token.name,
        symbol: formattedToken.symbol || token.symbol,
        usdValue: parseFloat(
          $tokenStore.balances[token.canister_id]?.in_usd || "0",
        ),
        isFavorite: favoriteTokens.includes(token.canister_id),
      };
    })
    .sort((a, b) => {
      // Sort by favorite status first (favorites at top)
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1;
      }
      // Then sort by USD value within each group
      return b.usdValue - a.usdValue;
    });

  onDestroy(() => {
    handleCloseModal();
  });
</script>

<div class="token-list w-full">
  {#if $tokenStore.isLoading && processedTokens.length === 0}
    <div class="loading"><LoadingIndicator /></div>
  {:else if $tokenStore.error}
    <div class="error">{$tokenStore.error}</div>
  {:else}
    {#each processedTokens as token (token.canister_id)}
      <div class="token-row-wrapper">
        <div class="flex-grow" on:click={() => handleTokenClick(token)}>
          <TokenRow {token} />
        </div>
        <button
          class="favorite-button"
          on:click={(e) => handleFavoriteClick(e, token)}
          aria-label={$tokenStore.favoriteTokens[
            $auth?.account?.owner?.toString()
          ]?.includes(token.canister_id)
            ? "Remove from favorites"
            : "Add to favorites"}
        >
          {#if $tokenStore.favoriteTokens[$auth?.account?.owner?.toString()]?.includes(token.canister_id)}
            <span class="star filled">★</span>
          {:else}
            <span class="star outline">☆</span>
          {/if}
        </button>
      </div>
    {/each}
  {/if}
</div>

{#if isModalOpen && selectedToken}
  <Modal
    show={isModalOpen}
    onClose={handleCloseModal}
    title={"Send " + (selectedToken?.symbol || "Token Details")}
    width="480px"
    height="auto"
  >
    <div class="token-details w-[380px]" class:hidden={!isModalOpen}>
      <img
        src={$tokenLogoStore[selectedToken.canister_id] ??
          "/tokens/not_verified.webp"}
        alt={selectedToken.name}
        class="token-logo"
      />
      <div class="token-info w-full">
        <h3 class="text-lg font-semibold text-yellow-500">
          {selectedToken.symbol}
        </h3>
        <p class="text-base">
          {selectedToken.formattedBalance}
          {selectedToken.symbol}
        </p>
        <p class="text-base">${selectedToken.formattedUsdValue}</p>
      </div>
    </div>

    {#key isModalOpen}
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
    {/key}

    <div class="modal-buttons">
      <Button text="Close" onClick={handleCloseModal} />
      <Button
        text={isSending ? "Sending..." : "Send"}
        variant="green"
        onClick={() => handleSend()}
        disabled={isSending || !amount || !destinationPid}
      />
    </div>
  </Modal>
{/if}

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
