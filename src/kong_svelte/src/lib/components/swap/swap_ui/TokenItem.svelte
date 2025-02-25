<script lang="ts">
  import { Star } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";

  const props = $props<{
    token: FE.Token;
    index: number;
    currentToken: FE.Token | null;
    otherPanelToken: FE.Token | null;
    isApiToken: boolean;
    isFavorite: boolean;
    enablingTokenId: string | null;
    blockedTokenIds: string[];
    balance?: { tokens: string; usd: string };
    onTokenClick: (e: MouseEvent | TouchEvent) => void;
    onFavoriteClick: (e: MouseEvent) => void;
    onEnableClick: (e: MouseEvent) => void;
  }>();

  function getStaggerDelay(index: number) {
    return index * 30; // 30ms delay between each item
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="token-item"
  class:selected={props.currentToken?.canister_id === props.token.canister_id}
  class:disabled={props.otherPanelToken?.canister_id === props.token.canister_id}
  class:blocked={props.blockedTokenIds.includes(props.token.canister_id)}
  class:not-enabled={props.isApiToken}
  on:click={props.onTokenClick}
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
          on:click={props.onFavoriteClick}
          title={props.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            size={14}
            fill={props.isFavorite ? "#ffd700" : "none"}
          />
        </button>
        <span class="token-symbol">{props.token.symbol}</span>
      </div>
      <span class="token-name">{props.token.name}</span>
    </div>
  </div>

  <!-- Token actions section (right side) -->
  <div class="text-sm token-right text-kong-text-primary">
    {#if props.isApiToken}
      <!-- Enable button for API tokens -->
      <button
        class="enable-token-button"
        on:click={props.onEnableClick}
        disabled={props.enablingTokenId === props.token.canister_id}
      >
        {#if props.enablingTokenId === props.token.canister_id}
          <div class="button-spinner" />
        {:else}
          Enable
        {/if}
      </button>
    {:else if props.balance}
      <!-- Balance display for enabled tokens -->
      <span class="flex flex-col text-right token-balance">
        {props.balance.tokens}
        <span class="text-xs token-balance-label">
          {props.balance.usd}
        </span>
      </span>
      <!-- Selected indicator -->
      {#if props.currentToken?.canister_id === props.token.canister_id}
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

<style lang="postcss">
  .token-item {
    @apply flex items-center justify-between py-3 rounded-xl bg-kong-bg-dark cursor-pointer transition-all duration-200 touch-pan-y select-none mx-4 border border-transparent;
  }

  .token-item:hover {
    @apply bg-kong-border/10 transform-none border-transparent;
  }

  .token-item.selected {
    @apply bg-kong-primary/5 px-2 border-l-4 border-l-kong-accent-green rounded-lg;
    margin-left: 0.5rem;
    margin-right: 0.5rem;
  }

  .token-item.selected:hover {
    @apply bg-kong-primary/10;
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
    color: rgba(255, 255, 255, 0.5);
    background-color: rgb(37, 41, 62);
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
    background-color: rgba(255, 255, 255, 0.05);
    transition: all 0.2s;
  }

  .favorite-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .favorite-button.active {
    color: #fde047;
    background-color: rgba(253, 224, 71, 0.1);
  }

  .token-symbol {
    @apply text-base font-semibold text-kong-text-primary tracking-wide;
  }

  .token-name {
    @apply text-sm text-kong-text-secondary;
  }

  .token-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .selected-indicator {
    @apply text-kong-text-accent-green;
    color: #4ade80;
    background: #4ade8010;
    border-radius: 50%;
    padding: 4px;
    display: flex;
  }

  .token-balance {
    margin-right: 8px;
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
    @apply border-2 border-white/20 border-t-white;
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
</style> 