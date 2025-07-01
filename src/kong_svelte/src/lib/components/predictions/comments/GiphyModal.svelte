<script lang="ts">
  import { Search, Loader2 } from "lucide-svelte";
  import Dialog from "$lib/components/common/Dialog.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { GiphyFetch } from "@giphy/js-fetch-api";
  import type { IGif } from "@giphy/js-types";

  let { isOpen, onClose, onSelectGif } = $props<{
    isOpen: boolean;
    onClose: () => void;
    onSelectGif: (url: string) => void;
  }>();

  let searchQuery = $state("");
  let gifs = $state<IGif[]>([]);
  let loading = $state(false);
  let selectedGif = $state<string | null>(null);
  let offset = $state(0);
  let hasMore = $state(true);
  let error = $state<string | null>(null);
  const LIMIT = 25;

  // Request tracking to prevent race conditions
  let currentRequestId = 0;
  let activeRequest: AbortController | null = null;

  // Initialize Giphy SDK
  const GIPHY_API_KEY = "G9w8qoH0iPJG98CGYAfhQumR6Vp566yg";
  const giphyFetch = new GiphyFetch(GIPHY_API_KEY);

  // Load trending GIFs on mount
  $effect(() => {
    if (isOpen && gifs.length === 0) {
      loadTrendingGifs();
    }

    // Cleanup on unmount
    return () => {
      if (activeRequest) {
        activeRequest.abort();
      }
    };
  });

  async function loadTrendingGifs(append = false) {
    // Prevent multiple simultaneous requests
    if (loading) return;
    
    // Cancel any pending request
    if (activeRequest) {
      activeRequest.abort();
    }

    const requestId = ++currentRequestId;
    activeRequest = new AbortController();
    error = null;

    try {
      loading = true;
      const { data, pagination } = await giphyFetch.trending({
        limit: LIMIT,
        offset: append ? offset : 0,
        rating: "pg-13",
        type: "gifs",
      });

      // Check if this is still the latest request
      if (requestId !== currentRequestId) return;

      if (append) {
        gifs = [...gifs, ...data];
      } else {
        gifs = data;
        offset = 0;
      }

      offset = pagination.offset + pagination.count;
      hasMore = pagination.total_count > offset;
    } catch (err) {
      // Ignore aborted requests
      if (err.name === 'AbortError') return;
      
      // Check if this is still the latest request
      if (requestId !== currentRequestId) return;

      console.error("Failed to load trending GIFs:", err);
      error = "Failed to load GIFs. Please try again.";
      if (!append) {
        gifs = [];
        offset = 0;
        hasMore = false;
      }
    } finally {
      // Only update loading state if this is the latest request
      if (requestId === currentRequestId) {
        loading = false;
        activeRequest = null;
      }
    }
  }

  async function searchGifs(append = false) {
    if (!searchQuery.trim()) {
      loadTrendingGifs(append);
      return;
    }

    // Prevent multiple simultaneous requests
    if (loading) return;

    // Cancel any pending request
    if (activeRequest) {
      activeRequest.abort();
    }

    const requestId = ++currentRequestId;
    activeRequest = new AbortController();
    error = null;

    try {
      loading = true;
      const { data, pagination } = await giphyFetch.search(searchQuery, {
        limit: LIMIT,
        offset: append ? offset : 0,
        rating: "pg-13",
        type: "gifs",
        lang: "en",
      });

      // Check if this is still the latest request
      if (requestId !== currentRequestId) return;

      if (append) {
        gifs = [...gifs, ...data];
      } else {
        gifs = data;
        offset = 0;
      }

      offset = pagination.offset + pagination.count;
      hasMore = pagination.total_count > offset;
    } catch (err) {
      // Ignore aborted requests
      if (err.name === 'AbortError') return;
      
      // Check if this is still the latest request
      if (requestId !== currentRequestId) return;

      console.error("Failed to search GIFs:", err);
      error = "Failed to search GIFs. Please try again.";
      if (!append) {
        gifs = [];
        offset = 0;
        hasMore = false;
      }
    } finally {
      // Only update loading state if this is the latest request
      if (requestId === currentRequestId) {
        loading = false;
        activeRequest = null;
      }
    }
  }

  function loadMore() {
    if (!loading && hasMore && !error) {
      if (searchQuery.trim()) {
        searchGifs(true);
      } else {
        loadTrendingGifs(true);
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !loading) {
      searchGifs();
    }
  }

  function selectGif(gifUrl: string) {
    selectedGif = gifUrl;
    onSelectGif(gifUrl);
    onClose();

    // Reset state
    setTimeout(() => {
      selectedGif = null;
      searchQuery = "";
      error = null;
    }, 300);
  }

  function handleClose() {
    // Cancel any pending requests
    if (activeRequest) {
      activeRequest.abort();
    }

    onClose();
    // Reset state
    setTimeout(() => {
      selectedGif = null;
      searchQuery = "";
      gifs = [];
      offset = 0;
      hasMore = true;
      error = null;
      currentRequestId = 0;
      activeRequest = null;
    }, 300);
  }

  function retryLoad() {
    error = null;
    if (searchQuery.trim()) {
      searchGifs(false);
    } else {
      loadTrendingGifs(false);
    }
  }
</script>

<Dialog open={isOpen} onClose={handleClose} title="Choose a GIF">
  <div class="flex flex-col h-[600px]">
    <!-- Search bar -->
    <div class="mb-4">
      <div class="relative">
        <input
          bind:value={searchQuery}
          onkeydown={handleKeydown}
          placeholder="Search for GIFs..."
          disabled={loading}
          class="w-full px-4 py-2 pl-10 bg-kong-bg-tertiary border border-kong-border/50
                 rounded-md text-sm text-kong-text-primary
                 placeholder:text-kong-text-secondary/50
                 focus:outline-none focus:ring-2 focus:ring-kong-primary/20
                 focus:border-kong-primary/50 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Search
          size={18}
          class="absolute left-3 top-1/2 -translate-y-1/2 text-kong-text-secondary"
        />
      </div>
      <ButtonV2
        onclick={() => searchGifs(false)}
        theme="primary"
        size="sm"
        fullWidth={true}
        className="mt-2"
        disabled={loading}
      >
        {loading ? "Searching..." : "Search"}
      </ButtonV2>
    </div>

    <!-- GIFs grid -->
    <div class="flex-1 overflow-y-auto">
      {#if loading && gifs.length === 0}
        <div class="flex items-center justify-center h-full">
          <Loader2 class="w-8 h-8 animate-spin text-kong-text-secondary" />
        </div>
      {:else if error && gifs.length === 0}
        <div class="flex flex-col items-center justify-center h-full gap-4">
          <p class="text-kong-text-secondary text-center">{error}</p>
          <ButtonV2 onclick={retryLoad} theme="secondary" size="sm">
            Retry
          </ButtonV2>
        </div>
      {:else if gifs.length === 0 && !loading}
        <div
          class="flex items-center justify-center h-full text-kong-text-secondary"
        >
          No GIFs found. Try a different search term.
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {#each gifs as gif}
            <button
              onclick={() => selectGif(gif.images.original.url)}
              class="relative group overflow-hidden rounded-md bg-kong-bg-tertiary
                     hover:ring-2 hover:ring-kong-primary transition-all
                     {selectedGif === gif.images.original.url
                ? 'ring-2 ring-kong-primary'
                : ''}"
            >
              <img
                src={gif.images.fixed_height_small.url}
                alt={gif.title || "GIF"}
                class="w-full h-32 object-cover"
                loading="lazy"
              />
              <div
                class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100
                          transition-opacity flex items-center justify-center"
              >
                <span class="text-white text-xs font-medium">Select</span>
              </div>
            </button>
          {/each}
        </div>

        <!-- Error message for failed load more -->
        {#if error && gifs.length > 0}
          <div class="text-center mt-4">
            <p class="text-red-500 text-sm mb-2">{error}</p>
            <ButtonV2 onclick={retryLoad} theme="secondary" size="sm">
              Retry
            </ButtonV2>
          </div>
        {/if}

        <!-- Load more button -->
        {#if !loading && !error && hasMore && gifs.length > 0}
          <div class="flex justify-center mt-4">
            <ButtonV2 onclick={loadMore} theme="secondary" size="sm">
              Load More
            </ButtonV2>
          </div>
        {/if}

        <!-- Loading indicator for load more -->
        {#if loading && gifs.length > 0}
          <div class="flex justify-center mt-4">
            <Loader2 class="w-6 h-6 animate-spin text-kong-text-secondary" />
          </div>
        {/if}
      {/if}
    </div>

    <!-- Powered by Giphy -->
    <div class="mt-4 text-center">
      <img
        src="https://developers.giphy.com/static/img/dev-logo-lg.gif"
        alt="Powered by GIPHY"
        class="h-4 mx-auto opacity-50"
      />
    </div>
  </div>
</Dialog>

<style lang="postcss">
  /* Custom scrollbar for GIF grid */
  .overflow-y-auto {
    scrollbar-width: thin;
    scrollbar-color: rgb(var(--ui-border) / 0.3) transparent;
  }

  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: rgb(var(--ui-border) / 0.3);
    border-radius: 3px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background-color: rgb(var(--ui-border) / 0.5);
  }
</style>
