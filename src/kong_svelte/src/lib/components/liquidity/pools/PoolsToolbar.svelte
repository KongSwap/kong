<script lang="ts">
  import { ArrowUp, ArrowDown, Plus } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";

  interface ToolbarProps {
    activePoolView: string;
    onViewChange: (view: string) => void;
    searchInput: string;
    onSearchInput: (value: string) => void;
    sortColumn: string;
    onSortColumnChange: (column: string) => void;
    sortDirection: "asc" | "desc";
    onSortDirectionToggle: () => void;
    userPoolsCount: number;
    isConnected: boolean;
    isMobile: boolean;
    onUserPoolsClick: () => void;
  }

  let { 
    activePoolView,
    onViewChange,
    searchInput,
    onSearchInput,
    sortColumn,
    onSortColumnChange,
    sortDirection,
    onSortDirectionToggle,
    userPoolsCount,
    isConnected,
    isMobile,
    onUserPoolsClick
  }: ToolbarProps = $props();

  const sortOptions = [
    { value: "tvl", label: "TVL" },
    { value: "rolling_24h_volume", label: "Volume 24H" },
    { value: "rolling_24h_apy", label: "APR" },
    { value: "price", label: "Price" }
  ];
</script>

<div class="flex flex-col sticky top-0 z-20 backdrop-blur-md rounded-t-{$panelRoundness}">
  <div class="flex flex-col gap-3 sm:gap-0">
    {#if isMobile}
      <!-- Mobile Header -->
      <div class="space-y-2">
        <div class="flex gap-2 w-full">
          <!-- View Toggle -->
          <div class="flex border border-white/[0.08] rounded-lg overflow-hidden shadow-inner bg-white/[0.02]">
            {#each ["all", "user"] as view}
              <button
                class="px-3 py-2 text-sm transition-colors {activePoolView === view
                  ? 'text-kong-text-primary bg-kong-primary/10 font-medium'
                  : 'text-kong-text-secondary'}"
                onclick={() => {
                  onViewChange(view);
                  if (view === "user") onUserPoolsClick();
                }}
              >
                {view === "all" ? "All" : `My (${userPoolsCount})`}
              </button>
              {#if view === "all"}<div class="w-px bg-white/[0.04]"></div>{/if}
            {/each}
          </div>

          <!-- Search -->
          <div class="flex-1 relative">
            <input
              type="text"
              placeholder={isMobile
                ? "Search pools..."
                : "Search pools by name, symbol, or canister ID"}
              class="w-full bg-kong-bg-secondary p-2 text-kong-text-primary placeholder-kong-text-secondary/70 focus:outline-none focus:border-b focus:border-kong-primary/20 transition-all duration-200"
              value={searchInput}
              oninput={(e) => onSearchInput(e.currentTarget.value)}
            />
            <!-- <svg
              class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg> -->
          </div>
          
          <!-- Add Liquidity Button (Mobile) -->
          <button
            onclick={() => goto('/pools/add')}
            class="p-2 rounded-lg bg-kong-primary/10 border border-kong-primary/20 text-kong-primary hover:bg-kong-primary/20 hover:border-kong-primary/30 transition-all duration-200"
          >
            <Plus class="w-5 h-5" />
          </button>
        </div>

        {#if activePoolView === "all"}
          <div class="flex gap-2 w-full">
            <!-- Sort -->
            <div class="flex-1 flex bg-white/[0.02] border border-white/[0.08] rounded-lg overflow-hidden shadow-inner">
              <select
                value={sortColumn}
                onchange={(e) => onSortColumnChange(e.currentTarget.value)}
                class="flex-1 bg-transparent text-kong-text-primary text-sm focus:outline-none px-3 py-2"
              >
                {#each sortOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
              <div class="w-px bg-white/[0.04]"></div>
              <button
                onclick={onSortDirectionToggle}
                class="px-3 text-kong-primary"
              >
                <svelte:component
                  this={sortDirection === "asc" ? ArrowUp : ArrowDown}
                  class="w-4 h-4"
                />
              </button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Desktop Header -->
      <div class="hidden sm:flex border-b border-white/[0.04] py-1 rounded-t-{$panelRoundness}">
        <div class="flex-1 flex items-center">
          <div class="flex bg-transparent">
            <button
              class="px-4 py-2 transition-colors duration-200 rounded {activePoolView === 'all'
                ? 'text-kong-text-primary font-medium'
                : 'text-kong-text-secondary hover:text-kong-text-primary'}"
              onclick={() => onViewChange("all")}
            >
              All Pools
            </button>
            {#if isConnected}
              <button
                class="px-4 py-2 transition-colors duration-200 {activePoolView === 'user'
                  ? 'text-kong-text-primary font-medium'
                  : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                onclick={() => {
                  onViewChange("user");
                  onUserPoolsClick();
                }}
              >
                My Pools <span
                  class="text-xs ml-1 font-bold py-0.5 text-white bg-kong-primary px-1.5 rounded"
                >{userPoolsCount}</span>
              </button>
            {/if}
          </div>

          <div class="flex-1 px-4 py-2">
            <input
              type="text"
              placeholder={isMobile
                ? "Search pools..."
                : "Search pools by name, symbol, or canister ID"}
              class="w-full bg-kong-bg-secondary p-2 text-kong-text-primary placeholder-kong-text-secondary/70 focus:outline-none focus:border-b focus:border-kong-primary/20 transition-all duration-200"
              value={searchInput}
              oninput={(e) => onSearchInput(e.currentTarget.value)}
            />
          </div>

          {#if activePoolView === "all"}
            <div class="flex items-center gap-2 px-4">
              <span class="text-sm text-kong-text-secondary">Sort by:</span>
              <div class="relative">
                <select
                  value={sortColumn}
                  onchange={(e) => onSortColumnChange(e.currentTarget.value)}
                  class="appearance-none bg-white/[0.05] border border-white/[0.08] rounded-lg pl-3 pr-8 py-1.5 text-sm text-kong-text-primary focus:outline-none focus:border-kong-primary/50 cursor-pointer"
                >
                  {#each sortOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
                <svg
                  class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-secondary pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              <button
                onclick={onSortDirectionToggle}
                class="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-kong-primary hover:bg-white/[0.08] transition-all duration-200"
              >
                <svelte:component
                  this={sortDirection === "asc" ? ArrowUp : ArrowDown}
                  class="w-4 h-4"
                />
              </button>
            </div>
          {/if}
          
          <!-- Add Liquidity Button -->
          <button
            onclick={() => goto('/pools/add')}
            class="px-4 mr-4 py-1.5 rounded-lg bg-kong-primary/10 border border-kong-primary/20 text-kong-primary hover:bg-kong-primary/20 hover:border-kong-primary/30 transition-all duration-200 flex items-center gap-1.5 font-medium"
          >
            <Plus class="w-4 h-4" />
            <span class="hidden sm:inline">Add Liquidity</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>