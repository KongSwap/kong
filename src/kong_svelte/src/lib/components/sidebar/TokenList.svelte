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
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { ArrowUpDown, Search } from 'lucide-svelte';
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

  $: sortedAndFilteredTokens = processedTokens
    .filter(token => {
      if (!$sidebarStore.filterText) return true;
      const searchText = $sidebarStore.filterText.toLowerCase();
      return token.name.toLowerCase().includes(searchText) ||
             token.symbol.toLowerCase().includes(searchText);
    })
    .sort((a, b) => {
      const direction = $sidebarStore.sortDirection === 'asc' ? 1 : -1;
      switch ($sidebarStore.sortBy) {
        case 'name':
          return direction * a.name.localeCompare(b.name);
        case 'balance':
          return direction * (Number(a.balance) - Number(b.balance));
        case 'value':
          return direction * ((Number(a.balance) * (a.price ?? 0)) - (Number(b.balance) * (b.price ?? 0)));
        case 'price':
          return direction * ((a.price ?? 0) - (b.price ?? 0));
        default:
          return 0;
      }
    });

  const sortOptions = [
    { id: 'value', label: 'Value' },
    { id: 'balance', label: 'Balance' },
    { id: 'name', label: 'Name' },
    { id: 'price', label: 'Price' }
  ];

  onDestroy(() => {
    handleCloseModal();
  });
</script>

<div class="token-list" class:expanded={$sidebarStore.isExpanded}>
  {#if $tokenStore.isLoading && processedTokens.length === 0}
    <div class="loading"><LoadingIndicator /></div>
  {:else}
    {#if $sidebarStore.isExpanded}
      <div class="filter-bar">
        <div class="search-box">
          <Search size={18} class="text-white/40" />
          <input
            type="text"
            placeholder="Search tokens..."
            bind:value={$sidebarStore.filterText}
            class="bg-transparent border-none outline-none text-white placeholder-white/40 w-full"
          />
        </div>
        <div class="sort-options">
          {#each sortOptions as option}
            <button
              class="sort-button"
              class:active={$sidebarStore.sortBy === option.id}
              on:click={() => sidebarStore.setSortBy(option.id)}
            >
              {option.label}
              {#if $sidebarStore.sortBy === option.id}
                <div class="transform transition-transform" class:rotate-180={$sidebarStore.sortDirection === 'desc'}>
                  <ArrowUpDown size={14} />
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="token-grid">
      {#each sortedAndFilteredTokens as token (token.canister_id)}
        <TokenRow
          {token}
          onClick={() => handleTokenClick(token)}
        />
      {/each}
    </div>
  {/if}
</div>

{#if isModalOpen && selectedToken}
  <Modal
    isOpen={isModalOpen}
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

<style lang="postcss">
  .token-list {
    @apply w-full flex flex-col gap-2 px-3 py-4;
  }

  .token-list.expanded {
    @apply px-6;
  }

  .filter-bar {
    @apply flex flex-col sm:flex-row gap-4 mb-4 sticky top-0 bg-black/90 backdrop-blur-md p-4 rounded-lg border border-white/5;
  }

  .search-box {
    @apply flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg flex-1;
  }

  .sort-options {
    @apply flex flex-wrap gap-2;
  }

  .sort-button {
    @apply px-3 py-1.5 rounded-md bg-white/5 text-sm text-white/60
           hover:bg-white/10 hover:text-white flex items-center gap-1.5
           transition-all duration-200;
  }

  .sort-button.active {
    @apply bg-white/20 text-white;
  }

  .token-list.expanded .token-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 gap-4;
  }

  .token-grid {
    @apply flex flex-col gap-2 transition-all duration-300;
  }

  .loading {
    @apply flex justify-center items-center p-4;
  }

  @media (min-width: 1400px) {
    .token-list.expanded .token-grid {
      @apply grid-cols-3;
    }
  }

  @media (min-width: 1800px) {
    .token-list.expanded .token-grid {
      @apply grid-cols-4;
    }
  }

  @media (max-width: 768px) {
    .token-list {
      @apply px-2 py-3;
    }

    .token-list.expanded {
      @apply px-3;
    }

    .token-list.expanded .token-grid {
      @apply grid-cols-1;
    }

    .filter-bar {
      @apply flex-col p-2;
    }

    .sort-options {
      @apply overflow-x-auto pb-2 flex-nowrap;
    }
  }
</style>
