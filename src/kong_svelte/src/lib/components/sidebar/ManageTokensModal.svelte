<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Coins, Search, Download } from "lucide-svelte";
  import { debounce } from "$lib/utils/debounce";
  import { fetchTokens } from "$lib/api/tokens";
  import { onMount } from "svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { TokenService } from "$lib/services/tokens/TokenService";
  import { toastStore } from "$lib/stores/toastStore";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { auth, canisterIDLs } from "$lib/services/auth";
  import { get } from "svelte/store";
  import { formatTokenBalance } from "$lib/utils/tokenFormatters";
  import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";

  export let isOpen;

  function handleClose() {
    isOpen = false;
  }

  let tokens: FE.Token[] = [];
  let isLoading = true;
  let searchQuery = "";
  let error = "";
  let tokenPreview: FE.Token | null = null;
  let step: "list" | "preview" = "list";
  let searchedToken: FE.Token | null = null;
  let isSearching = false;
  let currentPage = 1;
  let totalCount = 0;
  let isLoadingMore = false;
  let hasMore = true;
  let tokenListContainer: HTMLElement;

  const params = {
    limit: 50,
    page: 1,
  };

  // Create debounced search function
  const debouncedSearch = debounce(handleSearch, 300);

  // Create intersection observer for infinite scroll
  let observer: IntersectionObserver;

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && hasMore) {
          console.log('Loading more tokens...');
          loadMoreTokens();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    loadInitialTokens();

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  });

  // Watch for container changes and update observer
  $: if (tokenListContainer && observer) {
    // Disconnect any existing observations
    observer.disconnect();
    
    // Create and observe new sentinel
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel h-4';
    tokenListContainer.appendChild(sentinel);
    observer.observe(sentinel);
  }

  async function loadInitialTokens() {
    try {
      const response = await fetchTokens(params);
      tokens = response.tokens;
      totalCount = response.total_count;
      hasMore = tokens.length < totalCount;
      currentPage = 1;
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      isLoading = false;
    }
  }

  async function loadMoreTokens() {
    if (!hasMore || isLoadingMore) return;

    isLoadingMore = true;
    const nextPage = currentPage + 1;
    console.log('Loading page:', nextPage);

    try {
      const response = await fetchTokens({
        ...params,
        page: nextPage,
        limit: 50
      });

      if (response.tokens.length > 0) {
        // Filter out duplicates before appending
        const newTokens = response.tokens.filter(
          newToken => !tokens.some(
            existingToken => existingToken.canister_id === newToken.canister_id
          )
        );
        tokens = [...tokens, ...newTokens];
        currentPage = nextPage;
        hasMore = tokens.length < response.total_count;
        console.log('Loaded tokens:', tokens.length, 'of', response.total_count);
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error("Error loading more tokens:", error);
    } finally {
      isLoadingMore = false;
    }
  }

  // Reset pagination when search query changes
  $: {
    if (searchQuery && searchQuery.length > 0) {
      debouncedSearch();
    } else {
      error = "";
      tokenPreview = null;
      step = "list";
      loadInitialTokens();
    }
  }

  $: filteredTokens = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.canister_id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  function toggleToken(token: FE.Token) {
    const isEnabled = $userTokens.enabledTokens[token.canister_id];
    if (isEnabled) {
      userTokens.disableToken(token.canister_id);
    } else {
      userTokens.enableToken(token);
    }
  }

  async function handleSearch() {
    if (!searchQuery) {
      error = "Please enter a canister ID";
      return;
    }

    isSearching = true;
    error = "";
    searchedToken = null;

    try {
      // First check if it's in our existing tokens
      const existingToken = tokens.find((t) => 
        t.canister_id.toLowerCase() === searchQuery.toLowerCase()
      );
      if (existingToken) {
        isSearching = false;
        return;
      }

      // If it looks like a canister ID, try to import it
      if (searchQuery.length >= 26) {
        let importToken = await TokenService.fetchTokenMetadata(searchQuery);
        if (importToken) {
          // Fetch user's balance if connected
          if (get(auth).isConnected) {
            const balance = await IcrcService.getIcrc1Balance(
              importToken,
              get(auth).account.owner,
            );
            importToken.balance = balance.toString();
          }
          searchedToken = importToken;
        }
      } else {
        // Otherwise, search through all tokens
        const response = await fetchTokens({ ...params, search: searchQuery });
        if (response.tokens && response.tokens.length > 0) {
          tokens = [...tokens, ...response.tokens.filter(newToken => 
            !tokens.some(existingToken => existingToken.canister_id === newToken.canister_id)
          )];
        }
      }
    } catch (e) {
      error = "Failed to find token. Please check the canister ID.";
      console.error("Error searching token:", e);
    } finally {
      isSearching = false;
    }
  }

  async function handleImport(token: FE.Token) {
    tokenPreview = token;
    step = "preview";
  }

  async function handleConfirm() {
    if (!tokenPreview) return;

    isLoading = true;
    try {
      const actor = auth?.pnp?.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        {
          anon: false,
          requiresSigning: false,
        },
      );
      const result = await actor.add_token({
        token: "IC." + tokenPreview.canister_id,
      });
      console.log(result);
      if (result.Ok) {
        userTokens.enableToken(tokenPreview);
        toastStore.success("Token added successfully");
        searchedToken = null;
        tokenPreview = null;
        step = "list";
        searchQuery = "";
        await fetchTokens(params);
        isOpen = false;
      } else {
        error = "Failed to add token";
        console.error("Error adding token:", result.Err);
      }
    } catch (e) {
      error = "Failed to add token";
      console.error("Error adding token:", e);
    } finally {
      isLoading = false;
    }
  }
</script>

<Modal
  bind:isOpen
  variant="transparent"
  title="Manage Tokens"
  height="500px"
  onClose={handleClose}
>
  <div class="manage-tokens-container">
    {#if step === "list"}
      <div class="list-container">
        <div class="list-header">
          <p class="description">
            View and manage your custom tokens. You can remove tokens that you no
            longer want to track. To import a token, enter the canister ID and then
            click the "Import Token" button.
          </p>

          <div class="search-container">
            <div class="search-input-wrapper">
              <Search size={16} class="search-icon ml-4" />
              <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search tokens or enter canister ID..."
                class="search-input ml-1"
              />
            </div>
          </div>

          {#if error}
            <div class="error-message">
              <svg
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
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          {/if}
        </div>

        {#if isLoading || isSearching}
          <div class="loading-state">
            <div class="loading-spinner" />
            <p>Loading tokens...</p>
          </div>
        {:else if tokens.length === 0 && !searchedToken}
          <div class="empty-state">
            <Coins size={32} />
            <p>No custom tokens added yet</p>
          </div>
        {:else if filteredTokens.length === 0 && !searchedToken}
          <div class="empty-state">
            <Search size={32} />
            <p>No tokens found matching "{searchQuery}"</p>
          </div>
        {:else}
          <div class="token-list" bind:this={tokenListContainer}>
            <div class="token-list-content">
              {#if searchedToken}
                <div class="token-item searched">
                  <div class="token-info">
                    {#if searchedToken.logo_url}
                      <img
                        src={searchedToken.logo_url}
                        alt={searchedToken.symbol}
                        class="token-logo"
                      />
                    {:else}
                      <div class="token-logo-placeholder">
                        {searchedToken.symbol?.[0] || "?"}
                      </div>
                    {/if}
                    <div class="token-details">
                      <h3>{searchedToken.name}</h3>
                      <p class="token-symbol">{searchedToken.symbol}</p>
                      {#if !searchedToken.icrc1 && !searchedToken.icrc2}
                        <div class="warning-text">
                          Token does not support required standards
                        </div>
                      {/if}
                    </div>
                  </div>
                  <button
                    class="import-button"
                    on:click={() => handleImport(searchedToken)}
                    disabled={!searchedToken.icrc1}
                  >
                    {#if !searchedToken.icrc1 && !searchedToken.icrc2}
                      <span>Not Supported</span>
                    {:else}
                      <Download size={16} />
                      <span>Import</span>
                    {/if}
                  </button>
                </div>
              {/if}

              {#each filteredTokens as token (token.canister_id)}
                <div class="token-item">
                  <div class="token-info">
                    {#if token.logo_url}
                      <img
                        src={token.logo_url}
                        alt={token.symbol}
                        class="token-logo"
                      />
                    {:else}
                      <div class="token-logo-placeholder">
                        {token.symbol?.[0] || "?"}
                      </div>
                    {/if}
                    <div class="token-details">
                      <h3>{token.name}</h3>
                      <p class="token-symbol">{token.symbol}</p>
                    </div>
                  </div>
                  <button
                    class="toggle-button {$userTokens.enabledTokens[
                      token.canister_id
                    ]
                      ? 'enabled'
                      : ''}"
                    on:click={() => toggleToken(token)}
                    title={$userTokens.enabledTokens[token.canister_id]
                      ? "Disable token"
                      : "Enable token"}
                  >
                    {#if $userTokens.enabledTokens[token.canister_id]}
                      <div class="enabled-text">Enabled</div>
                    {:else}
                      <div class="enable-text">Enable</div>
                    {/if}
                  </button>
                </div>
              {/each}

              {#if isLoadingMore}
                <div class="loading-more">
                  <div class="loading-spinner" />
                  <p>Loading more tokens...</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {:else if step === "preview" && tokenPreview}
      <div class="preview-content">
        <div class="token-preview">
          <div class="token-header">
            {#if tokenPreview.logo_url}
              <img
                src={tokenPreview.logo_url}
                alt={tokenPreview.symbol}
                class="token-logo"
              />
            {:else}
              <div class="token-logo-placeholder">
                {tokenPreview.symbol?.[0] || "?"}
              </div>
            {/if}
            <div class="token-info">
              <h3>{tokenPreview.name}</h3>
              <p class="token-symbol">{tokenPreview.symbol}</p>
            </div>
          </div>

          <div class="s">
            <div class="detail-row">
              <span class="detail-label">Canister ID</span>
              <code class="detail-value">{tokenPreview.canister_id}</code>
            </div>
            {#if get(auth).isConnected}
              <div class="detail-row">
                <span class="detail-label">Your Balance</span>
                <span class="detail-value highlight">
                  {formatTokenBalance(
                    tokenPreview.balance,
                    tokenPreview.decimals,
                  )}
                  {tokenPreview.symbol}
                </span>
              </div>
            {/if}
            <div class="detail-row">
              <span class="detail-label">Decimals</span>
              <span class="detail-value">{tokenPreview.decimals}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Supply</span>
              <span class="detail-value">
                {formatTokenBalance(
                  tokenPreview.metrics?.total_supply.toString(),
                  tokenPreview.decimals,
                )}
                {tokenPreview.symbol}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fee</span>
              <span class="detail-value">
                {formatTokenBalance(
                  tokenPreview.fee.toString(),
                  tokenPreview.decimals,
                )}
                {tokenPreview.symbol}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Standards</span>
              <div class="standards-list">
                {#if tokenPreview.icrc1}<span class="standard-tag">ICRC-1</span
                  >{/if}
                {#if tokenPreview.icrc2}<span class="standard-tag">ICRC-2</span
                  >{/if}
                {#if tokenPreview.icrc3}<span class="standard-tag">ICRC-3</span
                  >{/if}
              </div>
            </div>
          </div>

          <div class="button-group pb-4">
            <button
              type="button"
              class="cancel-button"
              on:click={() => {
                step = "list";
                tokenPreview = null;
                error = "";
              }}
              disabled={isLoading}
            >
              Back
            </button>
            <button
              type="button"
              class="submit-button"
              class:error={!tokenPreview.icrc1 && !tokenPreview.icrc2}
              on:click={handleConfirm}
              disabled={isLoading || !tokenPreview.icrc1}
            >
              {#if isLoading}
                <span class="loading-spinner"></span>
                <span>Adding Token...</span>
              {:else if !tokenPreview.icrc1 && !tokenPreview.icrc2}
                <svg
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Not Supported</span>
              {:else}
                Import Token
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</Modal>

<style scoped lang="postcss">
  .manage-tokens-container {
    @apply h-[500px] flex flex-col overflow-hidden;
  }

  .list-container {
    @apply flex flex-col h-full overflow-hidden;
  }

  .list-header {
    @apply flex-none;
  }

  .description {
    @apply text-sm text-kong-text-primary/70 mb-3 px-3;
  }

  .search-container {
    @apply px-3 mb-3;
  }

  .search-input-wrapper {
    @apply relative flex items-center bg-white/[0.03] border border-white/10 rounded-lg;
    @apply hover:bg-white/[0.04] hover:border-white/20;
    @apply transition-all duration-200;
  }

  .search-icon {
    @apply text-kong-text-primary/30;
    @apply pointer-events-none;
  }

  .search-input {
    @apply w-full py-2 pl-2 pr-4;
    @apply text-sm text-kong-text-primary placeholder:text-kong-text-primary/30;
    @apply focus:outline-none;
    @apply bg-transparent border-none;
  }

  .search-input-wrapper:focus-within {
    @apply ring-1 ring-kong-primary/50 border-kong-primary/50;
  }

  .loading-state,
  .empty-state {
    @apply flex flex-col items-center justify-center gap-3 py-8 text-kong-text-primary/70 flex-1;
  }

  .loading-spinner {
    @apply w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin;
  }

  .token-list {
    @apply flex-1 overflow-y-auto min-h-0;
  }

  .token-list-content {
    @apply space-y-1.5 px-4 pb-4;
  }

  .token-item {
    @apply flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10;
    @apply transition-colors duration-200;
  }

  .token-item:hover {
    @apply bg-white/[0.07] border-white/20;
  }

  .token-info {
    @apply flex items-center gap-2.5;
  }

  .token-logo {
    @apply w-9 h-9 rounded-full;
  }

  .token-logo-placeholder {
    @apply w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-base font-semibold text-kong-text-primary;
  }

  .token-details h3 {
    @apply text-base font-medium text-kong-text-primary mb-0.5;
  }

  .token-symbol {
    @apply text-sm text-kong-text-primary/70;
  }

  .toggle-button {
    @apply px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200;
    @apply bg-white/5 text-kong-text-primary/50 hover:bg-white/10;
  }

  .toggle-button.enabled {
    @apply bg-kong-primary/10 text-kong-primary hover:bg-kong-primary/20;
  }

  .enabled-text,
  .enable-text {
    @apply flex items-center gap-2;
  }

  .error-message {
    @apply flex items-center gap-2 mx-3 p-2.5 rounded-lg;
    @apply bg-kong-accent-red/10 text-kong-accent-red text-sm;
    @apply border border-kong-accent-red/20;
    @apply mb-3;
  }

  .search-token-button {
    @apply mt-3 px-5 py-2 rounded-lg text-sm font-medium;
    @apply bg-kong-primary text-white hover:bg-kong-primary-hover;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    @apply flex items-center gap-2 justify-center;
    @apply transition-all duration-200;
  }

  /* Preview styles */
  .preview-content {
    @apply flex flex-col gap-4 h-full;
  }

  .token-preview {
    @apply flex flex-col gap-4 flex-1;
  }

  .token-header {
    @apply flex items-start gap-3 p-3 mx-3 rounded-lg;
    @apply bg-white/[0.03] border border-white/10;
    @apply transition-colors duration-200;
  }

  .token-header .token-logo {
    @apply w-11 h-11;
  }

  .token-header .token-logo-placeholder {
    @apply w-11 h-11 text-lg;
  }

  .token-header h3 {
    @apply text-lg font-semibold mb-0.5;
  }

  .token-header .token-info {
    @apply flex-1 min-w-0 flex flex-col my-auto;
  }

  .warning-box {
    @apply flex items-center gap-2 mt-1.5 py-1 px-2 rounded-md;
    @apply bg-yellow-500/[0.07] text-yellow-500 border border-yellow-500/20;
    @apply transition-all duration-200;
  }

  .warning-box.error {
    @apply bg-kong-accent-red/[0.07] text-kong-accent-red border-kong-accent-red/20;
  }

  .warning-text {
    @apply text-xs font-medium;
  }

  .s {
    @apply mx-3 bg-white/[0.03] border border-white/10 rounded-lg divide-y divide-white/10;
    @apply transition-colors duration-200;
  }

  .detail-row {
    @apply flex items-center justify-between p-3;
    @apply transition-colors duration-200;
  }

  .detail-row:hover {
    @apply bg-white/[0.02];
  }

  .detail-label {
    @apply text-sm text-kong-text-primary/70;
  }

  .detail-value {
    @apply text-sm text-kong-text-primary font-medium;
  }

  code.detail-value {
    @apply bg-white/10 px-2.5 py-1 rounded-lg font-mono text-xs;
    @apply border border-white/5;
  }

  .standards-list {
    @apply flex gap-1.5;
  }

  .standards-list:not(:has(.standard-tag)) {
    @apply text-kong-accent-red;
  }

  .standards-list:not(:has(.standard-tag))::after {
    content: "No supported standards found";
    @apply text-sm font-medium;
  }

  .standard-tag {
    @apply bg-kong-primary/10 text-kong-primary;
    @apply px-2.5 py-1 rounded-lg text-xs font-medium;
    @apply border border-kong-primary/20;
    @apply flex items-center gap-1.5;
  }

  .standard-tag::before {
    content: "";
    @apply w-1.5 h-1.5 rounded-full bg-current;
  }

  .button-group {
    @apply flex gap-2 px-3 mt-auto pb-3;
  }

  .button-group button {
    @apply flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg;
    @apply text-sm font-medium transition-all duration-200;
  }

  .cancel-button {
    @apply bg-white/5 text-kong-text-primary/70 border border-white/10;
    @apply hover:bg-white/[0.07] hover:text-kong-text-primary hover:border-white/20;
  }

  .submit-button {
    @apply bg-kong-primary text-white border border-kong-primary/50;
    @apply hover:bg-kong-primary-hover;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .submit-button.error {
    @apply bg-kong-accent-red border-kong-accent-red/50;
    @apply hover:bg-kong-accent-red-hover;
  }

  .detail-value.highlight {
    @apply text-kong-primary font-medium;
  }

  .token-item.searched {
    @apply bg-white/[0.07] border-white/20;
  }

  .warning-text {
    @apply text-xs text-kong-accent-red mt-0.5;
  }

  .import-button {
    @apply px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200;
    @apply bg-kong-primary text-white hover:bg-kong-primary-hover;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    @apply flex items-center gap-2;
  }

  .import-button:disabled {
    @apply bg-kong-accent-red text-white hover:bg-kong-accent-red;
  }

  .import-button .loading-spinner {
    @apply w-4 h-4;
  }

  .loading-more {
    @apply flex flex-col items-center justify-center gap-2 py-4;
  }

  .loading-more .loading-spinner {
    @apply w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin text-kong-text-primary/50;
  }

  .loading-more p {
    @apply text-sm text-kong-text-primary/50;
  }

  .sentinel {
    @apply w-full;
  }
</style>
