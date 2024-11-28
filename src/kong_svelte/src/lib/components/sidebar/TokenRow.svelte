<script lang="ts">
  import { fade, scale, fly } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { Star, MoreVertical, ArrowDown, ArrowUp } from 'lucide-svelte';
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { formatBalance, formatUsdValue } from '$lib/utils/tokenFormatters';
  import { createEventDispatcher } from 'svelte';
  import TokenDetails from '$lib/components/common/TokenDetails.svelte';

  export let token: any;
  const dispatch = createEventDispatcher();
  let showDetails = false;
  let isHovered = false;
  let isPressed = false;
  let showMenu = false;

  $: console.log("usdValue", token);


  function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('toggleFavorite', { token });
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
    showMenu = !showMenu;
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
              class:active={token.isFavorite}
              on:click={handleFavoriteClick}
              title={token.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star size={16} fill={token.isFavorite ? "#ffd700" : "none"} />
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
    background: rgba(42, 45, 61, 0.3);
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(58, 62, 82, 0.3);
    outline: none;
    transform-origin: center;
    will-change: transform, box-shadow, background-color, border-color;
  }

  .token-row:hover {
    background: rgba(42, 45, 61, 0.8);
    border-color: rgba(58, 62, 82, 0.8);
    box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.3);
    transform: translateY(-1px);
  }

  .token-row.pressed {
    transform: scale(0.98);
    box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.2);
    background: rgba(42, 45, 61, 1);
  }

  .token-row:focus {
    box-shadow: 0 0 0 2px rgba(78, 132, 255, 0.5);
    border-color: rgba(78, 132, 255, 0.5);
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
    padding-left: 16px;
  }

  .token-image {
    transition: transform 200ms ease;
  }

  .token-image.hovered {
    transform: scale(1.05);
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
    color: rgba(255, 255, 255, 0.5); /* Slightly brighter */
    background: rgba(255, 255, 255, 0.08); /* Slightly brighter */
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .favorite-button:hover {
    color: rgba(255, 255, 255, 1);
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.1);
  }

  .favorite-button.active {
    color: #ffd700;
    background: rgba(255, 215, 0, 0.15); /* Slightly brighter */
  }

  .token-symbol {
    font-size: 18px;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.95); /* Brighter */
  }

  .token-name {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75); /* Brighter */
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
    padding-right: 16px;
  }

  .balance {
    font-size: 16px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.95); /* Brighter */
  }

  .usd-value {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75); /* Brighter */
  }

  .menu-container {
    height: 100%;
  }

  .menu-button {
    color: rgba(255, 255, 255, 0.7); /* Brighter */
    background: rgba(32, 35, 48, 0.6); /* More transparent */
    border: none;
    border-radius: 0 12px 12px 0; /* Rounded right corners */
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 100%;
  }

  .menu-button:hover {
    color: white;
    background: rgba(42, 45, 61, 0.9); /* Darker on hover */
  }

  .menu-button:active {
    background: rgba(42, 45, 61, 1); /* Darkest when active */
  }
</style>
