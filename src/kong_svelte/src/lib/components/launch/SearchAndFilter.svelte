<script lang="ts">
  import { Plus, Search, ArrowUpDown } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { toastStore } from "$lib/stores/toastStore";
  
  export let activeTab = "tokens";
  export let searchQuery = "";
  export let sortField = "date";
  export let sortDirection = "desc";
  export let stats = {
    totalTokens: 0,
    totalMiners: 0
  };
  
  let showSortDropdown = false;
  
  function handleCreateNew() {
    if (!$auth.isConnected) {
      requireWalletConnection();
      return;
    }
    goto(`/launch/${activeTab === "tokens" ? "create-token" : "create-miner"}`);
  }

  async function requireWalletConnection() {
    try {
      await auth.connect("plug");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toastStore.error("CONNECT YOUR WALLET FIRST", {
        title: "🔑 WALLET REQUIRED",
        duration: 5000,
      });
    }
  }
  
  function toggleSortDirection() {
    sortDirection = sortDirection === "desc" ? "asc" : "desc";
  }
  
  function setSortField(field) {
    if (sortField === field) {
      toggleSortDirection();
    } else {
      sortField = field;
      sortDirection = "desc";
    }
  }
  
  function toggleSortDropdown() {
    showSortDropdown = !showSortDropdown;
  }
  
  // Close dropdown when clicking outside
  function handleClickOutside(event) {
    if (showSortDropdown && !event.target.closest('.sort-dropdown-container')) {
      showSortDropdown = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<!-- SEARCH AND FILTER BAR -->
<div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
  <!-- TABS -->
  <div class="flex gap-2 p-1 bg-kong-bg-dark/60 backdrop-blur-md rounded-lg border border-kong-border/50">
    <button 
      class={`px-4 py-2 rounded-md transition-all duration-200 flex items-center gap-2 ${activeTab === 'tokens' ? 'bg-blue-600 text-white' : 'bg-transparent hover:bg-kong-bg-light/10 text-white'}`}
      on:click={() => activeTab = 'tokens'}>
      <span class="flex items-center gap-2">
        <span class="text-lg">🚀</span>
        <span>TOKENS</span>
        <span class="text-xs bg-black/20 px-2 py-0.5 rounded-full">{stats.totalTokens}</span>
      </span>
    </button>
    <button 
      class={`px-4 py-2 rounded-md transition-all duration-200 flex items-center gap-2 ${activeTab === 'miners' ? 'bg-blue-600 text-white' : 'bg-transparent hover:bg-kong-bg-light/10 text-white'}`}
      on:click={() => activeTab = 'miners'}>
      <span class="flex items-center gap-2">
        <span class="text-lg">⛏️</span>
        <span>MINERS</span>
        <span class="text-xs bg-black/20 px-2 py-0.5 rounded-full">{stats.totalMiners}</span>
      </span>
    </button>
  </div>
  
  <!-- SEARCH AND SORT -->
  <div class="flex gap-2 w-full md:w-auto">
    <div class="relative flex-grow md:flex-grow-0 md:w-64">
      <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        <Search class="h-4 w-4" />
      </div>
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="Search by name or ID..." 
        class="w-full pl-10 pr-4 py-2 bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white"
      />
    </div>
    
    <!-- SORT DROPDOWN -->
    <div class="relative sort-dropdown-container">
      <button 
        class="flex items-center gap-2 px-4 py-2 bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-lg hover:bg-kong-bg-light/10 transition-all duration-200"
        on:click={toggleSortDropdown}
      >
        <ArrowUpDown class="h-4 w-4 text-gray-400" />
        <span class="hidden md:inline text-sm">{sortField.toUpperCase()}</span>
        <span class="text-xs">{sortDirection === 'desc' ? '↓' : '↑'}</span>
      </button>
      
      {#if showSortDropdown}
        <div class="absolute right-0 mt-2 w-48 bg-kong-bg-dark border border-kong-border/50 rounded-lg shadow-lg z-20 backdrop-blur-md">
          <div class="p-2 space-y-1">
            <button 
              class="w-full text-left px-3 py-2 rounded-lg hover:bg-kong-bg-light/10 text-sm flex items-center justify-between"
              on:click={() => { setSortField('date'); toggleSortDropdown(); }}
            >
              <span>DATE</span>
              {#if sortField === 'date'}
                <span class="text-blue-500">{sortDirection === 'desc' ? '↓' : '↑'}</span>
              {/if}
            </button>
            <button 
              class="w-full text-left px-3 py-2 rounded-lg hover:bg-kong-bg-light/10 text-sm flex items-center justify-between"
              on:click={() => { setSortField('name'); toggleSortDropdown(); }}
            >
              <span>NAME</span>
              {#if sortField === 'name'}
                <span class="text-blue-500">{sortDirection === 'desc' ? '↓' : '↑'}</span>
              {/if}
            </button>
            <button 
              class="w-full text-left px-3 py-2 rounded-lg hover:bg-kong-bg-light/10 text-sm flex items-center justify-between"
              on:click={() => { setSortField('principal'); toggleSortDropdown(); }}
            >
              <span>ID</span>
              {#if sortField === 'principal'}
                <span class="text-blue-500">{sortDirection === 'desc' ? '↓' : '↑'}</span>
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- CREATE NEW BUTTON -->
    <button 
      on:click={handleCreateNew}
      class="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 text-white"
    >
      <Plus class="h-4 w-4" />
      <span class="hidden md:inline">{activeTab === 'tokens' ? 'LAUNCH TOKEN' : 'DEPLOY MINER'}</span>
      <span class="inline md:hidden">NEW</span>
    </button>
  </div>
</div> 