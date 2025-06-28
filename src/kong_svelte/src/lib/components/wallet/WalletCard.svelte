<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import Badge from "$lib/components/common/Badge.svelte";
  import { Clock, ExternalLink, X } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import type { WalletInfo } from "$lib/config/wallets";

  // Props
  type Props = {
    wallet: WalletInfo;
    isRecent?: boolean;
    recentTimestamp?: number;
    isClicked?: boolean;
    isFocused?: boolean;
    isDisabled?: boolean;
    showRemove?: boolean;
    variant?: 'default' | 'recent' | 'first-recent';
    animationDelay?: number;
    onConnect: () => void;
    onRemove?: () => void;
  };

  let {
    wallet,
    isRecent = false,
    recentTimestamp,
    isClicked = false,
    isFocused = false,
    isDisabled = false,
    showRemove = false,
    variant = 'default',
    animationDelay = 0,
    onConnect,
    onRemove
  }: Props = $props();

  // Format date helper
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // Computed styles
  const cardClasses = $derived.by(() => {
    const base = `wallet-card group relative flex items-center gap-3 w-full p-3 sm:p-4 rounded-xl
      will-change-transform transition-all duration-200 ease-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kong-primary
      cursor-pointer`;
    
    const variantClasses = {
      'default': 'border border-kong-border/30 bg-kong-bg-primary/30',
      'recent': 'border border-kong-border/30 bg-kong-bg-primary/30',
      'first-recent': 'border border-kong-primary/40 bg-kong-primary/5'
    };
    
    const stateClasses = [
      !isDisabled && 'hover:border-kong-primary/100 hover:bg-kong-primary/10 hover:translate-y-[-2px] hover:shadow-lg active:translate-y-0 active:shadow-md',
      isClicked && 'animate-pulse-slow',
      isDisabled && 'opacity-40 cursor-not-allowed pointer-events-none grayscale brightness-75',
      isFocused && 'border-kong-primary bg-kong-primary/5 ring-1 ring-kong-primary/50',
      isRecent && variant === 'default' && 'opacity-60 hover:opacity-100'
    ].filter(Boolean).join(' ');
    
    return `${base} ${variantClasses[variant]} ${stateClasses}`;
  });
</script>

<div
  class={cardClasses}
  onclick={() => !isDisabled && onConnect()}
  onkeydown={(e) => e.key === "Enter" && !isDisabled && onConnect()}
  role="button"
  tabindex="0"
  aria-busy={isClicked}
  aria-disabled={isDisabled}
  in:fade={{ duration: 200, delay: animationDelay }}
>
  <!-- Logo -->
  <div class="wallet-logo relative w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-110">
    <div class="logo-glow absolute inset-0 opacity-0 transition-opacity duration-300"></div>
    <img
      src={wallet.logo}
      alt={wallet.walletName}
      class="w-full h-full rounded-lg transition-all duration-300 dark:brightness-100 object-contain hover:scale-110 z-10 relative"
      loading="lazy"
    />
  </div>

  <!-- Info -->
  <div class="wallet-info flex-1 text-left min-w-0">
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="font-medium text-sm transition-colors duration-200 group-hover:text-kong-primary truncate">
        {wallet.walletName}
      </span>
      {#if wallet.recommended}
        <Badge variant="blue" size="xs">Recommended</Badge>
      {/if}
      {#if wallet.unsupported}
        <span
          class="text-xs font-semibold px-1 py-0.5 rounded bg-kong-accent-yellow/20 text-kong-accent-yellow"
          use:tooltip={{
            text: "The Plug website is no longer available. Use with caution. We recommend migrating to a different wallet.",
            direction: "top",
          }}
        >
          Unsupported
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-1.5 pt-1">
      {#if wallet.website}
        <a
          href={wallet.website}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs flex items-center justify-center text-kong-text-secondary hover:text-kong-primary hover:bg-kong-bg-secondary/20 transition-all duration-200 cursor-pointer"
          title="Visit website"
          onclick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} class="inline mr-0.5" />
        </a>
      {/if}
      
      {#if recentTimestamp}
        <span class="text-kong-text-secondary text-xs">
          <span class="inline-flex items-center gap-1">
            <Clock size={10} class="inline" />
            {formatDate(recentTimestamp)}
          </span>
        </span>
      {:else if isRecent}
        <span class="text-xs text-kong-text-secondary flex items-center">
          <Clock size={10} class="inline mr-0.5" />
          Recent
        </span>
      {/if}
    </div>
  </div>

  <!-- Google Sign In Badge -->
  {#if wallet.googleSignIn}
    <Badge variant="google" size="xs">
      {wallet.googleSignIn}
    </Badge>
  {/if}

  <!-- Remove Button (for recent wallets) -->
  {#if showRemove && onRemove}
    <button
      class="remove-wallet flex items-center justify-center w-7 h-7 rounded-full text-kong-text-secondary hover:text-kong-error hover:bg-kong-error/10 transition-all duration-200"
      onclick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      use:tooltip={{
        text: "Remove from history",
        direction: "left",
      }}
    >
      <X size={14} />
    </button>
  {:else}
    <!-- Arrow -->
    <div class="wallet-arrow flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1 ml-1">
      <svg
        class="text-kong-text-secondary transition-all duration-300 group-hover:text-kong-primary"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  {/if}
</div>

<style lang="postcss">
  .wallet-card {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    border-width: 1px !important;
  }

  .wallet-card:hover {
    border-width: 1px !important;
    border-color: rgb(var(--primary) / 0.8) !important;
    box-shadow:
      0 0 0 1px rgb(var(--primary) / 0.3),
      0 8px 20px -4px rgba(var(--primary), 0.25) !important;
    outline: 1px solid rgba(var(--primary), 0.3);
    outline-offset: 1px;
  }

  .wallet-card::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: radial-gradient(
      circle at center,
      rgba(var(--primary), 0.15),
      transparent 70%
    );
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .wallet-card:hover::after {
    opacity: 1;
  }

  .wallet-card:hover .logo-glow {
    opacity: 0.6;
  }

  .logo-glow {
    background: radial-gradient(
      circle at center,
      rgba(var(--primary), 0.6),
      rgba(var(--primary), 0.2) 60%,
      transparent 70%
    );
    filter: blur(8px);
    z-index: 0;
  }

  .wallet-card[aria-busy="true"] {
    position: relative;
    z-index: 5;
    border-color: rgb(var(--accent-green)) !important;
    background-color: rgba(var(--accent-green), 0.05) !important;
    box-shadow: 0 0 0 1px rgba(var(--accent-green), 0.3), 
                0 8px 16px -4px rgba(var(--accent-green), 0.3) !important;
  }

  .wallet-card[aria-busy="true"]::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: linear-gradient(45deg, 
                rgba(var(--accent-green), 0.1),
                rgba(var(--accent-green), 0.2),
                rgba(var(--accent-green), 0.1));
    z-index: -1;
    animation: pulse 2s infinite;
  }

  .remove-wallet {
    opacity: 0.6;
  }

  .wallet-card:hover .remove-wallet {
    opacity: 1;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  @media (max-width: 640px) {
    .wallet-card {
      padding: 0.75rem !important;
    }
    
    .wallet-logo {
      width: 2rem !important;
      height: 2rem !important;
    }
  }
</style>