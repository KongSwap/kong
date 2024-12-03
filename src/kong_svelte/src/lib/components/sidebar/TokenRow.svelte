<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { Star, MoreVertical, ArrowDown, ArrowUp } from 'lucide-svelte';
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { formatUsdValue } from '$lib/utils/tokenFormatters';
  import { createEventDispatcher } from 'svelte';
  import TokenDetails from '$lib/components/common/TokenDetails.svelte';
  import { currentWalletFavorites } from '$lib/services/tokens/favoriteStore';

  export let token: any;
  const dispatch = createEventDispatcher();
  let showDetails = false;
  let isHovered = false;
  let isPressed = false;
  let showMenu = false;
  
  $: isFavorite = $currentWalletFavorites.includes(token.canister_id);

  $: console.log("usdValue", token);


  function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('toggleFavorite', { canisterId: token.canister_id });
  }

  function handleRowClick() {
    showDetails = true;
  }

  function handleSendClick(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    dispatch('send', { token });
  }

  function handleReceiveClick(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    dispatch('receive', { token });
  }

  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    showDetails = true;
  }

  // Close menu when clicking outside
  function handleClickOutside(e: MouseEvent) {
    if (showMenu) {
      showMenu = false;
    }
  }

  $: token
</script>

<svelte:window on:click={handleClickOutside} />

<div class="token-wrapper">
  <div 
    class="token-row"
    class:pressed={isPressed}
    in:fly={{ y: 20, duration: 400, delay: 200 }}
    out:fade={{ duration: 200 }}
    on:click={handleRowClick}
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
    on:mousedown={() => isPressed = true}
    on:mouseup={() => isPressed = false}
    role="button"
    tabindex="0"
    on:keydown={e => e.key === 'Enter' && handleRowClick()}
  >
    <div class="token-content">
      <div class="token-left">
        <div class="token-image" class:hovered={isHovered}>
          <TokenImages tokens={[token]} size={36} />
        </div>

        <div class="token-info">
          <div class="token-name-row">
            <button 
              class="favorite-button"
              class:active={isFavorite}
              on:click={handleFavoriteClick}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star size={16} fill={isFavorite ? "#ffd700" : "none"} />
            </button>
            <span class="token-symbol">{token.symbol}</span>
          </div>
          <span class="token-name">{token.name}</span>
        </div>
      </div>

      <div class="token-right">
        <div class="value-info">
          <div class="balance">
            {token.formattedBalance}
          </div>
          <div class="usd-value">
            {formatUsdValue(token.formattedUsdValue)}
          </div>
        </div>

        <div class="menu-container">
          <button 
            class="menu-button"
            on:click={toggleMenu}
            title="Token details"
          >
            <MoreVertical size={24} />
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

{#if showDetails}
  <div>
    <TokenDetails {token} on:close={() => showDetails = false} />
  </div>
{/if}

<style>
  .token-row {
    flex: 1;
    cursor: pointer;
    transform-origin: center;
    will-change: transform;
    transition: background-color 0.1s ease;
  }

  .token-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
  }

  .token-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .token-image {
    transform: scale(1);
  }

  .token-info {
    display: flex;
    flex-direction: column;
  }

  .token-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .favorite-button {
    padding: 4px;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .favorite-button:hover {
    color: rgba(255, 255, 255, 1);
    transform: scale(1.1);
    background-color: rgba(255, 255, 255, 0.1);
  }

  .favorite-button.active {
    color: #ffd700;
    background-color: rgba(253, 224, 71, 0.1);
  }

  .token-symbol {
    font-size: 18px;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.95);
  }

  .token-name {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75);
  }

  .token-right {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .value-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .balance {
    font-size: 16px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.95);
  }

  .usd-value {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75);
  }

  .menu-container {
    height: 100%;
  }

  .menu-button {
    color: rgba(255, 255, 255, 0.7);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 100%;
  }

  .menu-button:hover {
    color: white;
  }
</style>
