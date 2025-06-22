<script lang="ts">
  import { fade } from "svelte/transition";
  import {
    Trash2,
    Loader2,
    Check,
    XCircle,
    Ban,
    UserCheck,
  } from "lucide-svelte";
  import type { Message } from "$lib/api/trollbox";
  import { auth } from "$lib/stores/auth";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";

  // Props
  let {
    message,
    isUserAdmin = false,
    isDeleting = false,
    isConfirming = false,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    onBanUser,
    onUnbanUser,
    bannedUsers = new Map<string, bigint>(),
  } = $props<{
    message: Message;
    isUserAdmin?: boolean;
    isDeleting?: boolean;
    isConfirming?: boolean;
    onRequestDelete: (id: bigint) => void;
    onCancelDelete: (id: bigint) => void;
    onConfirmDelete: (id: bigint) => void;
    onBanUser: (
      principal: import("@dfinity/principal").Principal,
      days: number,
    ) => void;
    onUnbanUser: (principal: import("@dfinity/principal").Principal) => void;
    bannedUsers?: Map<string, bigint>;
  }>();

  // Constants
  const DEFAULT_IMAGE = "/tokens/not_verified.webp";
  const banDurations = [
    { value: 1, label: "1 day" },
    { value: 3, label: "3 days" },
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
  ];

  // State
  let tokenCache = $state<Map<string, any>>(new Map());
  let showBanOptions = $state(false);
  let selectedBanDays = $state(1);
  let tokenLinkClickHandler = $state<
    ((event: CustomEvent) => void) | undefined
  >(undefined);
  let isLoadingTokens = $state(false);

  // Derived values
  let isCurrentUser = $derived(
    $auth.isConnected &&
      $auth.account.owner === message.principal.toText(),
  );
  let isBanned = $derived(bannedUsers.has(message.principal.toText()));
  let banTimeLeft = $derived(
    isBanned ? bannedUsers.get(message.principal.toText()) : null,
  );
  let timeString = $derived(
    new Date(Number(message.created_at / BigInt(1000000))).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ),
  );
  let banTimeString = $derived(banTimeLeft ? formatBanTime(banTimeLeft) : "");
  let processedMessage = $derived(processMessageContent(message.message));

  // Extract canister IDs from message for token lookups
  function extractCanisterIds(content: string) {
    const matches = [];
    const tokenRegex = /(?:^|\s)\/price\s+([a-zA-Z0-9-]+)(?:\s|$)/g;
    let match;

    while ((match = tokenRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }

  // Initialize token data
  onMount(async () => {
    // Fetch token data
    const canisterIds = extractCanisterIds(message.message);
    if (canisterIds.length > 0) {
      try {
        isLoadingTokens = true;
        const tokens = await fetchTokensByCanisterId(canisterIds);
        const newCache = new Map(tokenCache);
        tokens.forEach((token) => {
          newCache.set(token.address, token);
        });
        tokenCache = newCache; // Trigger reactivity by assigning new Map
      } catch (error) {
        console.error("Error fetching token data:", error);
      } finally {
        isLoadingTokens = false;
      }
    }

    // Setup token link click event listener
    tokenLinkClickHandler = (event: CustomEvent) => {
      const href = event.detail.href;
      if (href) {
        goto(href);
      }
    };

    window.addEventListener(
      "token-link-click",
      tokenLinkClickHandler as EventListener,
    );
  });

  // Clean up event listeners
  onDestroy(() => {
    if (tokenLinkClickHandler) {
      window.removeEventListener(
        "token-link-click",
        tokenLinkClickHandler as EventListener,
      );
    }
  });

  function processMessageContent(content: string) {
    // First check if the content already contains HTML for token links (from the API)
    if (content.includes('class="token-link"')) {
      // Content already has processed token links, don't double-process
      return content;
    }

    // Updated regex to better match price commands
    const tokenRegex = /(?:^|\s)\/price\s+([a-zA-Z0-9-]+)(?:\s|$)/g;
    let lastIndex = 0;
    let result = "";

    // Process each match while preserving non-matching text
    let match;
    while ((match = tokenRegex.exec(content)) !== null) {
      // Add text before the match
      result += content.slice(lastIndex, match.index);
      lastIndex = match.index + match[0].length;

      const canisterId = match[1];
      const token = tokenCache.get(canisterId);

      // Fallback token display when data is not available or still loading
      if (!token || isLoadingTokens) {
        result += `<span class="bg-kong-primary/20 text-kong-text-on-primary rounded px-1.5 py-0.5 inline-flex items-center gap-1 border border-kong-primary/20 align-text-bottom mx-0.5 text-xs" data-canister-id="${canisterId}">
          <span class="flex items-center gap-0.5">
            <img 
              src="${DEFAULT_IMAGE}" 
              alt="Loading token" 
              class="w-3.5 h-3.5 rounded-full"
              onerror="this.src='${DEFAULT_IMAGE}'"
            />
            ${canisterId.slice(0, 5).toUpperCase()}
          </span>
          <span class="flex items-center gap-0.5">
            <span class="w-2 h-2 rounded-full border border-kong-text-secondary/40 border-t-transparent animate-spin ml-1"></span>
          </span>
        </span>`;
        continue;
      }

      // Get token logo URL or fallback
      const logoUrl =
        token.logo_url || DEFAULT_IMAGE;

      // Format price and determine price change direction
      const price = token.metrics?.price
        ? parseFloat(token.metrics.price).toFixed(2)
        : "?.??";
      const priceChange = token.metrics?.price_change_24h
        ? parseFloat(token.metrics.price_change_24h).toFixed(3)
        : "0.00";
      const direction = !token.metrics?.price_change_24h
        ? "neutral"
        : parseFloat(token.metrics.price_change_24h) > 0
          ? "up"
          : parseFloat(token.metrics.price_change_24h) < 0
            ? "down"
            : "neutral";

      // Choose arrow and color based on price direction
      const arrowIcon =
        direction === "up"
          ? `<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
          : direction === "down"
            ? `<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`
            : `<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

      const priceChangeClass =
        direction === "up"
          ? "text-kong-success"
          : direction === "down"
            ? "text-kong-error"
            : "text-kong-text-on-primary";

      const formattedChange = priceChange.startsWith("-")
        ? priceChange
        : `+${priceChange}`;

      result += `<a href="/stats/${canisterId}" class="token-link local-generated" data-canister-id="${canisterId}" onclick="(function(e) { e.preventDefault(); e.stopPropagation(); const href = '/stats/${canisterId}'; window.dispatchEvent(new CustomEvent('token-link-click', {detail: {href: href}})); return false; })(event)"><span class="bg-kong-primary/80 text-kong-text-on-primary rounded px-1.5 py-0.5 inline-flex items-center gap-1 border border-kong-primary/20 align-text-bottom mx-0.5 text-sm">
        <span class="flex items-center gap-0.5">
          <img 
            src="${logoUrl}" 
            alt="${token.symbol || token.name || "Token"}" 
            class="w-3.5 h-3.5 rounded-full"
            onerror="this.src='${DEFAULT_IMAGE}'"
          />
          ${token.symbol || token.name || canisterId.slice(0, 5).toUpperCase()}
        </span>
        <span class="flex items-center gap-0.5">
          $${price}
          <span class="${priceChangeClass} flex items-center gap-0.5">(${formattedChange}%)${arrowIcon}</span>
        </span>
      </span></a>`;
    }

    // Add any remaining text after the last match
    result += content.slice(lastIndex);
    return result;
  }

  function formatBanTime(seconds: bigint): string {
    const secondsNum = Number(seconds);

    if (secondsNum < 60) {
      return `${secondsNum}s`;
    } else if (secondsNum < 3600) {
      return `${Math.floor(secondsNum / 60)}m`;
    } else if (secondsNum < 86400) {
      return `${Math.floor(secondsNum / 3600)}h`;
    } else {
      return `${Math.floor(secondsNum / 86400)}d`;
    }
  }

  function handleBanUser() {
    onBanUser(message.principal, selectedBanDays);
    showBanOptions = false;
  }

  function toggleBanOptions(event: MouseEvent) {
    event.stopPropagation();
    showBanOptions = !showBanOptions;
  }

  // Handle direct clicks on token representations that aren't properly captured by the global handler
  function handleTokenClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Find if we're inside a token-like element (either from API or locally generated)
    const tokenElement = target.closest("span.bg-kong-primary\\/20");
    if (tokenElement) {
      // Check if we're inside a message that has token links
      const tokenLink =
        tokenElement.closest("a.token-link") ||
        tokenElement.closest(".message-content")?.querySelector("a.token-link");

      if (tokenLink) {
        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();

        // Get the href and navigate programmatically
        const href = tokenLink.getAttribute("href");
        if (href) {
          setTimeout(() => goto(href), 10);
        }

        return false;
      }
    }
  }
</script>

<div
  class="message-item flex flex-col relative group transition-opacity duration-200 {isDeleting
    ? 'opacity-60'
    : ''} {isCurrentUser ? 'items-end' : 'items-start'}"
  transition:fade={{ duration: 150 }}
  data-message-id={message.id.toString()}
>
  <div
    class="flex {isCurrentUser
      ? 'items-end'
      : 'items-start'} gap-1.5 max-w-[85%]"
  >
    {#if !isCurrentUser}
      <img
        onclick={() => goto(`/wallets/${message.principal.toText()}`)}
        src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${message.principal.toText()}&size=20`}
        alt="avatar"
        class="w-8 h-8 mt-1 rounded-full bg-kong-dark cursor-pointer"
      />
    {/if}

    <div
      class="{isCurrentUser
        ? 'bg-kong-primary text-kong-text-on-primary rounded-t-md rounded-bl-md rounded-br-sm'
        : 'bg-kong-dark text-kong-text-primary rounded-t-md rounded-br-md rounded-bl-sm'} px-3 py-2 relative group"
    >
      {#if !isCurrentUser}
        <div
          class="flex items-center gap-1.5 mb-0.5 cursor-pointer"
          onclick={() => goto(`/wallets/${message.principal.toText()}`)}
        >
          <span
            class="text-xs font-medium text-kong-primary cursor-pointer hover:text-kong-primary"
            onclick={() => goto(`/wallets/${message.principal.toText()}`)}
            >{message.principal.toText().slice(0, 10)}</span
          >
        </div>
      {/if}

      <!-- Add data-debug-content attribute for troubleshooting if needed -->
      <p
        class="text-sm break-words leading-relaxed message-content"
        data-debug-content={processedMessage}
        onclick={handleTokenClick}
      >
        {@html processedMessage}
      </p>

      <span
        class="text-xs text-kong-text-primary {isCurrentUser
          ? 'ml-1.5 text-white'
          : 'mr-1.5'} whitespace-nowrap inline-block"
      >
        {timeString}
      </span>

      {#if isUserAdmin && !isDeleting && !isConfirming}
        <button
          onclick={() => onRequestDelete(message.id)}
          class="absolute {isCurrentUser
            ? 'left-0'
            : 'right-0'} top-0 -translate-y-1/2 {isCurrentUser
            ? '-translate-x-1/2'
            : 'translate-x-1/2'} p-1 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-red-900/30 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-kong-bg-tertiary mr-1"
          title="Delete message"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>

        {#if !isCurrentUser}
          <button
            onclick={toggleBanOptions}
            class="absolute {isCurrentUser
              ? 'left-0 -translate-x-[calc(100%+4px)]'
              : 'right-0 translate-x-[calc(100%+4px)]'} top-0 -translate-y-1/2 p-1 {isBanned
              ? 'text-green-400 hover:text-green-300'
              : 'text-red-400 hover:text-red-300'} transition-colors rounded-full {isBanned
              ? 'hover:bg-green-900/30'
              : 'hover:bg-red-900/30'} opacity-0 group-hover:opacity-100 focus:opacity-100 bg-kong-bg-tertiary"
            title={isBanned
              ? `User banned (${banTimeString} remaining)`
              : "Ban user"}
          >
            {#if isBanned}
              <UserCheck class="w-3.5 h-3.5" />
            {:else}
              <Ban class="w-3.5 h-3.5" />
            {/if}
          </button>

          {#if showBanOptions}
            <div
              class="absolute z-10 {isCurrentUser
                ? 'left-0'
                : 'right-0'} top-[-42px] bg-kong-dark border border-kong-primary/20 rounded-md shadow-lg p-2 min-w-[150px]"
              transition:fade={{ duration: 150 }}
            >
              {#if isBanned}
                <div class="flex flex-col">
                  <p class="text-xs text-kong-text-secondary mb-2">
                    User banned for {banTimeString}
                  </p>
                  <button
                    onclick={() => onUnbanUser(message.principal)}
                    class="text-xs bg-green-700/30 hover:bg-green-700/50 text-white rounded px-2 py-1 transition-colors"
                  >
                    Unban User
                  </button>
                </div>
              {:else}
                <div class="flex flex-col">
                  <p class="text-xs text-kong-text-secondary mb-2">
                    Ban for how long?
                  </p>
                  <div class="flex flex-col gap-1 mb-2">
                    {#each banDurations as duration}
                      <label class="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="banDuration"
                          value={duration.value}
                          bind:group={selectedBanDays}
                          class="accent-kong-primary"
                        />
                        <span class="text-xs text-kong-text-primary"
                          >{duration.label}</span
                        >
                      </label>
                    {/each}
                  </div>
                  <button
                    onclick={handleBanUser}
                    class="text-xs bg-red-700/30 hover:bg-red-700/50 text-white rounded px-2 py-1 transition-colors"
                  >
                    Ban User
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      {/if}
    </div>

    {#if isUserAdmin}
      {#if isDeleting}
        <div class="flex items-center bg-red-950/40 rounded-full p-1">
          <Loader2 class="w-3 h-3 animate-spin text-red-400" />
        </div>
      {:else if isConfirming}
        <div class="flex items-center gap-1">
          <button
            onclick={() => onConfirmDelete(message.id)}
            class="p-1 text-green-400 hover:text-green-300 transition-colors rounded-full hover:bg-green-900/30 bg-kong-bg-tertiary"
            title="Confirm delete"
          >
            <Check class="w-3 h-3" />
          </button>
          <button
            onclick={() => onCancelDelete(message.id)}
            class="p-1 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-red-900/30 bg-kong-bg-tertiary"
            title="Cancel delete"
          >
            <XCircle class="w-3 h-3" />
          </button>
        </div>
      {/if}
    {/if}
  </div>
  {#if isDeleting}
    <div class="mt-1 w-full max-w-[85%]" transition:fade={{ duration: 150 }}>
      <div class="bg-red-950/40 rounded-full h-0.5 w-full overflow-hidden">
        <div class="h-full bg-red-500/70 progress-bar"></div>
      </div>
    </div>
  {:else if isConfirming}
    <div
      class="mt-1 text-xs text-amber-400 text-center w-full max-w-[85%]"
      transition:fade={{ duration: 150 }}
    >
      Delete this message?
    </div>
  {:else if isBanned}
    <div
      class="mt-1 text-xs text-red-400 text-center w-full max-w-[85%]"
      transition:fade={{ duration: 150 }}
    >
      User banned • {banTimeString} remaining
    </div>
  {/if}
</div>

<style scoped lang="postcss">
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Add animation for the progress bar */
  .progress-bar {
    width: 100%;
    animation: progress-animation 2s infinite linear;
    background: linear-gradient(
      90deg,
      rgba(239, 68, 68, 0.2) 0%,
      rgba(239, 68, 68, 0.7) 50%,
      rgba(239, 68, 68, 0.2) 100%
    );
    background-size: 200% 100%;
  }

  @keyframes progress-animation {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: 0 0;
    }
  }
</style>
