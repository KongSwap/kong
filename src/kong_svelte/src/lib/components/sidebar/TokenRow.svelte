<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { Star, MoreVertical } from 'lucide-svelte';
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { formatUsdValue, formatTokenBalance } from '$lib/utils/tokenFormatters';
  import TokenDetails from '$lib/components/common/TokenDetails.svelte';
  import { FavoriteService } from '$lib/services/tokens/favoriteService';
  import { tokenStore } from '$lib/services/tokens';
  
  export let token: any;

  let showDetails = false;
  let isHovered = false;
  let isPressed = false;
  let showMenu = false;
  let localFavorite = false; // Local state for immediate feedback
  let formattedBalance = '';
  let lastLogTime = 0;
  const LOG_THROTTLE = 1000; // 1 second
  
  let isFavorite = false;
  let showTokenDetails = false;

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

  function handleRowClick() {
    showDetails = true;
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

  $: {
    const balance = $tokenStore.balances[token.canister_id]?.in_tokens;
    formattedBalance = formatTokenBalance(
      balance?.toString() || "0",
      token.decimals
    );
    
    // Throttle logging
    const now = Date.now();
    if (now - lastLogTime > LOG_THROTTLE) {
      lastLogTime = now;
      // Only log if needed for debugging
      // console.log('Balance update:', formattedBalance);
    }
  }

  // If you need to debug, use this instead of direct console.logs
  function debugLog(value: any) {
    const now = Date.now();
    if (now - lastLogTime > LOG_THROTTLE) {
      lastLogTime = now;
    }
  }
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
              class:active={localFavorite}
              on:click={handleFavoriteClick}
              title={localFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star size={16} fill={localFavorite ? "#ffd700" : "none"} />
            </button>
            <span class="token-symbol">{token.symbol}</span>
          </div>
          <span class="token-name">{token.name}</span>
        </div>
      </div>

      <div class="token-right">
        <div class="value-info">
          <div class="balance">
            {formattedBalance}
          </div>
          <div class="usd-value">
            {formatUsdValue($tokenStore.balances[token.canister_id]?.in_usd || '0')}
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

{#if showTokenDetails}
  <TokenDetails 
    token={token}
    isOpen={showTokenDetails}
    on:close={() => showTokenDetails = false}
  />
{/if}

<style scoped lang="postcss">
  .token-row {
    flex: 1;
    cursor: pointer;
    transform-origin: center;
    will-change: transform;
    transition: background-color 0.1s ease;
    border: 1px solid transparent;
    transition: border-color 0.2s ease;
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
    color: text-kong-text-primary/50;
    background-color: rgba(255, 255, 255, 0.05);
  }

  .favorite-button:hover {
    @apply text-white;
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
    color: text-kong-text-primary;
  }

  .token-name {
    font-size: 14px;
    color: text-kong-text-primary/70;
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
    color: text-kong-text-primary;
  }

  .usd-value {
    font-size: 14px;
    color: text-kong-text-primary/70;
  }

  .menu-container {
    height: 100%;
  }

  .menu-button {
    @apply text-kong-text-primary/70;
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
