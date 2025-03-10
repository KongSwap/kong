<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { Star, Send, HandCoins, ArrowUpDown, Droplets, Copy, MoreHorizontal, Trash2 } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import {
    formatUsdValue,
    formatTokenBalance,
  } from "$lib/utils/tokenFormatters";
  import TokenDetails from "$lib/components/common/TokenDetails.svelte";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { currentUserBalancesStore } from "$lib/stores/balancesStore";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import { goto } from "$app/navigation";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { activeDropdownId } from "$lib/stores/dropdownStore";
  import { accountStore } from "$lib/stores/accountStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { createEventDispatcher } from "svelte";

  export let token: any;
  export let onRemove: (canisterId: string) => void = () => {}; // Add callback for token removal

  let showTokenDetails = false;
  let isPressed = false;
  let localFavorite = false;
  let formattedBalance = "0";
  let formattedUsdValue = "$0.00";
  let lastLogTime = 0;
  const LOG_THROTTLE = 1000; // 1 second
  let isFavorite = false;
  let dropdownVisible = false;
  let isDefaultToken = false;

  // Check if this is a default token that shouldn't be removable
  $: isDefaultToken = userTokens.isDefaultToken(token.canister_id);

  // Subscribe to the store and update local dropdown visibility
  activeDropdownId.subscribe((id) => {
    dropdownVisible = id === token.canister_id;
  });

  // Update balance formatting when storedBalances changes
  $: {
    const balance = $currentUserBalancesStore[token.canister_id];
    if (balance) {
      formattedBalance = formatTokenBalance(
        balance.in_tokens?.toString() || "0",
        token.decimals,
      );
      formattedUsdValue = formatUsdValue(balance.in_usd || "0");
    }

    // Throttle logging
    const now = Date.now();
    if (now - lastLogTime > LOG_THROTTLE) {
      lastLogTime = now;
    }
  }

  // Replace the reactive statement with an async function
  async function updateFavoriteStatus() {
    isFavorite = await FavoriteService.isFavorite(token.canister_id);
    localFavorite = isFavorite;
  }

  $: if (token) {
    updateFavoriteStatus();
  }

  async function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    // Toggle local state immediately for UI feedback
    localFavorite = await FavoriteService.toggleFavorite(token.canister_id);
  }

  function handleMenuAction(action: string, token: FE.Token) {
    activeDropdownId.set(null);
    switch (action) {
      case "details":
        showTokenDetails = true;
        break;
      case "swap":
        goto(
          `/swap?from=${token.canister_id}&to=${token.canister_id === CKUSDT_CANISTER_ID ? ICP_CANISTER_ID : CKUSDT_CANISTER_ID}`,
        );
        sidebarStore.collapse();
        break;
      case "receive":
        accountStore.showAccountDetails("principal");
        break;
      case "remove":
        // Disable the token in the userTokens store
        userTokens.disableToken(token.canister_id);
        
        // Show success message
        toastStore.success(`${token.symbol} has been removed from your token list`);
        
        // Call the onRemove callback to notify parent component
        onRemove(token.canister_id);
        break;
      // Add more actions as needed
    }
    dropdownVisible = false;
  }

  function handleRowClick() {
    if (dropdownVisible) {
      activeDropdownId.set(null);
    } else {
      activeDropdownId.set(token.canister_id);
    }
  }

  let dropdownEl: HTMLElement;
  let rowEl: HTMLElement;
  let showAbove = false;

  function updateDropdownPosition() {
    if (!rowEl) return;
    const viewportHeight = window.innerHeight;
    const rowRect = rowEl.getBoundingClientRect();

    // If the row is in the bottom third of the viewport, show dropdown above
    showAbove = rowRect.bottom > (viewportHeight * 2) / 3;
  }

  $: if (dropdownVisible) {
    // Use setTimeout to ensure the DOM is updated
    setTimeout(updateDropdownPosition, 0);
  }
</script>

<div
  class="relative isolate z-0 transition-[z-index] duration-0"
  class:z-[100]={dropdownVisible}
  bind:this={rowEl}
>
  {#if dropdownVisible}
    <div
      class="fixed inset-0 bg-black/50 z-[90]"
      in:fade={{ duration: 100 }}
      out:fade={{ duration: 200 }}
      on:click={() => activeDropdownId.set(null)}
    />
  {/if}

  <div
    class="flex-1 cursor-pointer origin-center transition-all duration-200 relative z-[95] group {dropdownVisible ? '' : 'border-transparent'}"
    class:pressed={isPressed}
    class:bg-kong-bg-light={dropdownVisible}
    class:rounded-lg={dropdownVisible}
    class:shadow-lg={dropdownVisible}
    class:bg-gradient-to-b={dropdownVisible}
    class:from-kong-bg-light={dropdownVisible}
    class:to-kong-bg-dark={dropdownVisible}
    on:mousedown={() => (isPressed = true)}
    on:mouseup={() => (isPressed = false)}
    on:click|stopPropagation={handleRowClick}
    role="button"
    tabindex="0"
    on:keydown={(e) => {
      if (e.key === "Enter") handleRowClick();
    }}
  >
    <div
      class="flex items-center justify-between h-14 relative z-[95]
             group-hover:bg-kong-bg-light/40 group-hover:border-kong-border/10
             transition-all duration-200 rounded-lg px-2"
    >
      <div class="flex items-center gap-3">
        <div class="transform scale-100">
          <TokenImages tokens={[token]} size={32} />
        </div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-1.5">
            <button
              class="p-1 rounded-md text-kong-text-primary/50 bg-white/5 transition-all duration-200 hover:text-kong-text-primary hover:scale-110 hover:bg-white/10 {localFavorite
                ? 'text-yellow-400 bg-yellow-400/10'
                : ''}"
              on:click={handleFavoriteClick}
              title={localFavorite
                ? "Remove from favorites"
                : "Add to favorites"}
            >
              <Star size={14} fill={localFavorite ? "#ffd700" : "none"} />
            </button>
            <span class="text-[15px] font-semibold text-kong-text-primary"
              >{token.symbol}</span
            >
          </div>
          <span class="text-[13px] text-kong-text-primary/70">{token.name}</span
          >
        </div>
      </div>

      <div class="flex items-center h-full">
        <div class="flex flex-col items-end gap-0.5">
          <div class="text-sm font-medium text-kong-text-primary">
            {formattedBalance
              .split(".")[0]
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}{formattedBalance.includes(
              ".",
            )
              ? "." + formattedBalance.split(".")[1]
              : ""}
          </div>
          <div class="text-[13px] text-kong-text-primary/70">
            {formattedUsdValue}
          </div>
        </div>

        <div class="relative z-[100] ml-2 h-full isolate">
          {#if dropdownVisible}
            <div
              bind:this={dropdownEl}
              class="absolute {showAbove
                ? 'bottom-[calc(100%+1px)]'
                : 'top-[calc(100%+2px)]'} -right-1 z-[9999] min-w-[250px] p-1.5 bg-kong-bg-light border border-kong-border {showAbove
                ? 'rounded-t-lg'
                : 'rounded-b-lg'} shadow-lg origin-{showAbove
                ? 'bottom'
                : 'top'}"
              in:fly={{ y: showAbove ? -10 : 10, duration: 200, delay: 150 }}
              out:fade={{ duration: 150 }}
              on:click|stopPropagation
            >
              <div
                class="absolute {showAbove
                  ? '-bottom-[5px]'
                  : '-top-[5px]'} right-3 w-2.5 h-2.5 bg-kong-bg-light border-l border-t border-kong-border transform {showAbove
                  ? 'rotate-[225deg]'
                  : 'rotate-45'} -z-10 shadow-[-2px_-2px_3px_rgba(0,0,0,0.1)]"
              ></div>

              <!-- Dropdown buttons -->
              <button
                class="w-full text-left p-2.5 text-kong-text-primary/90 transition-all duration-200 rounded-md hover:bg-kong-primary/15 hover:text-kong-text-primary hover:translate-x-0.5 flex items-center gap-2"
                on:click|stopPropagation={() => {
                  activeDropdownId.set(null);
                  handleMenuAction("details", token);
                }}
              >
                <Send size={16} />
                Send
              </button>

              <button
                class="w-full text-left p-2.5 text-kong-text-primary/90 transition-all duration-200 rounded-md hover:bg-kong-primary/15 hover:text-kong-text-primary hover:translate-x-0.5 flex items-center gap-2"
                on:click|stopPropagation={() => {
                  activeDropdownId.set(null);
                  handleMenuAction("receive", token);
                }}
              >
                <HandCoins size={16} />
                Receive
              </button>

              <button
                class="w-full text-left p-2.5 text-kong-text-primary/90 transition-all duration-200 rounded-md hover:bg-kong-primary/15 hover:text-kong-text-primary hover:translate-x-0.5 flex items-center gap-2"
                on:click|stopPropagation={() => {
                  activeDropdownId.set(null);
                  sidebarStore.collapse();
                  goto(
                    `/swap?from=${token.canister_id}&to=${token.canister_id === CKUSDT_CANISTER_ID ? ICP_CANISTER_ID : CKUSDT_CANISTER_ID}`,
                  );
                }}
              >
                <ArrowUpDown size={16} />
                Swap
              </button>

              <button
                class="w-full text-left p-2.5 text-kong-text-primary/90 transition-all duration-200 rounded-md hover:bg-kong-primary/15 hover:text-kong-text-primary hover:translate-x-0.5 flex items-center gap-2"
                on:click|stopPropagation={() => {
                  activeDropdownId.set(null);
                  sidebarStore.collapse();
                  goto(
                    `/pools/add?token0=${token.canister_id}&token1=${CKUSDT_CANISTER_ID}`,
                  );
                }}
              >
                <Droplets size={16} />
                Add Liquidity
              </button>

              <button
                class="w-full text-left p-2.5 text-kong-text-primary/90 transition-all duration-200 rounded-md hover:bg-kong-primary/15 hover:text-kong-text-primary hover:translate-x-0.5 flex items-center gap-2"
                on:click|stopPropagation={() => {
                  activeDropdownId.set(null);
                  navigator.clipboard.writeText(token.canister_id);
                  toastStore.success("Canister ID copied to clipboard");
                }}
              >
                <Copy size={16} />
                Copy Canister ID
              </button>
              
              <button
                class="w-full text-left p-2.5 text-kong-text-primary/90 transition-all duration-200 rounded-md hover:bg-kong-primary/15 hover:text-kong-text-primary hover:translate-x-0.5 flex items-center gap-2"
                on:click|stopPropagation={() => {
                  activeDropdownId.set(null);
                  sidebarStore.collapse();
                  goto(`/stats/${token.canister_id}`);
                }}
              >
                <MoreHorizontal size={16} />
                More Info
              </button>
              
              <!-- Remove Token button - only show for non-default tokens -->
              {#if !isDefaultToken}
                <button
                  class="w-full text-left p-2.5 text-red-500/90 transition-all duration-200 rounded-md hover:bg-red-500/15 hover:text-red-500 hover:translate-x-0.5 flex items-center gap-2"
                  on:click|stopPropagation={() => {
                    handleMenuAction("remove", token);
                  }}
                >
                  <Trash2 size={16} />
                  Remove Token
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

{#if showTokenDetails}
  <TokenDetails {token} on:close={() => (showTokenDetails = false)} />
{/if}

<style lang="postcss" scoped>
  .pressed {
    @apply scale-95 transition-all duration-100;
  }
</style>