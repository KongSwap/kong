<script lang="ts">
  import { Star } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatTokenName } from "$lib/utils/tokenFormatUtils";

  const props = $props<{
    token: Kong.Token;
    index: number;
    currentToken: Kong.Token | null;
    otherPanelToken: Kong.Token | null;
    isApiToken: boolean;
    isFavorite: boolean;
    enablingTokenId: string | null;
    blockedTokenIds: string[];
    balance?: { tokens: string; usd: string; loading?: boolean };
    onTokenClick: (e: MouseEvent | TouchEvent) => void;
    onFavoriteClick: (e: MouseEvent) => void;
    onEnableClick: (e: MouseEvent) => void;
  }>();
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="token-item"
  class:selected={props.currentToken?.address === props.token.address}
  class:disabled={props.otherPanelToken?.address === props.token.address}
  class:blocked={props.blockedTokenIds.includes(props.token.address)}
  class:not-enabled={props.isApiToken}
  onclick={props.onTokenClick}
>
  <!-- Token info section (left side) -->
  <div class="token-info">
    <TokenImages
      tokens={[props.token]}
      size={40}
      containerClass="token-logo-container"
    />
    <div class="token-details">
      <div class="token-symbol-row">
        <!-- Favorite button -->
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <button
          class="favorite-button"
          class:active={props.isFavorite}
          onclick={props.onFavoriteClick}
          title={props.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            size={14}
            fill={props.isFavorite ? "#ffd700" : "none"}
          />
        </button>
        <span class="token-symbol">{props.token.symbol}</span>
      </div>
      <span class="token-name">{formatTokenName(props.token.name, 30)}</span>
    </div>
  </div>

  <!-- Token actions section (right side) -->
  <div class="text-sm token-right text-kong-text-primary">
    {#if props.isApiToken}
      <!-- Enable button for API tokens -->
      <button
        class="enable-token-button"
        onclick={props.onEnableClick}
        disabled={props.enablingTokenId === props.token.address}
      >
        {#if props.enablingTokenId === props.token.address}
          <div class="button-spinner" />
        {:else}
          Enable
        {/if}
      </button>
    {:else if props.balance}
      <!-- Balance display for enabled tokens -->
      <span class="flex flex-col text-right token-balance">
        {#if props.balance.loading}
          <div class="balance-loading-indicator">
            <div class="balance-spinner"></div>
          </div>
        {:else}
          {props.balance.tokens}
          <span class="text-xs token-balance-label">
            {props.balance.usd}
          </span>
        {/if}
      </span>
      <!-- Selected indicator -->
      {#if props.currentToken?.address === props.token.address}
        <div class="selected-indicator">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style lang="postcss" scoped>
  .token-item {
    @apply flex items-center justify-between p-3 mx-2 rounded-lg bg-kong-bg-primary cursor-pointer transition-all duration-200 touch-pan-y select-none;
    height: 64px; /* Fixed height to match TOKEN_ITEM_HEIGHT minus padding */
    box-sizing: border-box;
  }

  .token-item:hover {
    @apply bg-kong-primary/10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .token-item.selected {
    @apply bg-kong-primary/5 rounded-lg border-l-[6px] border-kong-accent-blue;
    padding: 12px 12px 12px 8px; /* Adjust padding to account for the border */
    margin-left: 0.5rem;
    margin-right: 0.5rem;
  }

  .token-item.selected:hover {
    @apply bg-kong-primary/15;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  }

  .token-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    position: relative;
  }

  .token-item.disabled .token-right {
    visibility: hidden;
  }

  .token-item.disabled::after {
    content: "Selected in other panel";
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: theme('colors.kong.text-secondary');
    background-color: theme('colors.kong.bg-light');
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .token-item.disabled:hover {
    background-color: transparent;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .token-logo-container {
    width: 2.5rem;
    height: 2.5rem;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .token-symbol-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .favorite-button {
    @apply text-kong-text-secondary;
    padding: 0.25rem;
    border-radius: 0.375rem;
    background-color: theme('colors.kong.bg-light/10');
    transition: all 0.2s;
  }

  .favorite-button:hover {
    background-color: theme('colors.kong.bg-light/20');
    color: theme('colors.kong.accent-yellow');
  }

  .favorite-button.active {
    color: theme('colors.kong.accent-yellow');
    background-color: theme('colors.kong.bg-light');
  }

  .token-symbol {
    @apply text-base font-semibold text-kong-text-primary tracking-wide;
  }

  .token-name {
    @apply text-sm text-kong-text-secondary;
  }

  .token-right {
    @apply flex items-center justify-end;
    gap: 0.75rem;
    min-width: 120px; /* Fixed width to ensure consistent alignment */
  }

  .token-balance {
    @apply text-right flex flex-col items-end;
  }

  .selected-indicator {
    @apply text-kong-bg-primary;
    background: theme('colors.kong.accent-green');
    border-radius: 50%;
    padding: 4px;
    display: flex;
    margin-left: 4px;
  }

  .enable-token-button {
    @apply px-4 py-2 rounded-lg text-sm font-medium;
    @apply bg-kong-primary text-white;
    @apply hover:bg-kong-primary-hover;
    @apply transition-all duration-200;
    @apply flex items-center justify-center;
    @apply min-w-[80px] h-[32px];
    @apply disabled:opacity-50 disabled:cursor-wait;
  }

  .button-spinner {
    @apply w-4 h-4;
    @apply border-2 border-kong-text-primary/20 border-t-kong-text-primary;
    @apply rounded-full;
    animation: spin 0.6s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .token-item.not-enabled {
    @apply opacity-75;
  }

  .token-item.not-enabled:hover {
    @apply opacity-100;
  }

  .balance-loading-indicator {
    @apply flex items-center justify-center;
    min-width: 60px;
    min-height: 24px;
  }

  .balance-spinner {
    @apply w-3 h-3;
    @apply border-2 border-kong-text-primary/10 border-t-kong-text-primary/60;
    @apply rounded-full;
    animation: spin 0.6s linear infinite;
  }
</style> 