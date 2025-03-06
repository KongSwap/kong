<script lang="ts">
  import { Plus, Search, SortDesc } from "lucide-svelte";
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
</script>

<!-- SEARCH AND FILTER BAR -->
<div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
  <!-- TABS -->
  <div class="flex gap-2 p-1 bg-gray-900/50 rounded-lg border border-gray-700/50">
    <button 
      class={`px-4 py-2 rounded-md transition-all duration-200 ${activeTab === 'tokens' ? 'bg-purple-600 text-white' : 'bg-transparent hover:bg-gray-800'}`}
      on:click={() => activeTab = 'tokens'}>
      <span class="flex items-center gap-2">
        💰 TOKENS <span class="text-xs bg-purple-800 px-2 py-0.5 rounded-full">{stats.totalTokens}</span>
      </span>
    </button>
    <button 
      class={`px-4 py-2 rounded-md transition-all duration-200 ${activeTab === 'miners' ? 'bg-blue-600 text-white' : 'bg-transparent hover:bg-gray-800'}`}
      on:click={() => activeTab = 'miners'}>
      <span class="flex items-center gap-2">
        ⛏️ MINERS <span class="text-xs bg-blue-800 px-2 py-0.5 rounded-full">{stats.totalMiners}</span>
      </span>
    </button>
  </div>
  
  <!-- SEARCH AND SORT -->
  <div class="flex gap-2 w-full md:w-auto">
    <div class="relative flex-grow md:flex-grow-0 md:w-64">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="SEARCH DEGEN SHIT..." 
        class="w-full pl-10 pr-4 py-2 bg-gray-900/70 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </div>
    
    <div class="relative">
      <button 
        class="flex items-center gap-2 px-4 py-2 bg-gray-900/70 border border-gray-700 rounded-lg hover:bg-gray-800"
        on:click={toggleSortDirection}
      >
        <SortDesc class="h-4 w-4" />
        <span class="hidden md:inline">{sortField.toUpperCase()}</span>
        <span class="text-xs">{sortDirection === 'desc' ? '↓' : '↑'}</span>
      </button>
      
      <!-- SORT DROPDOWN -->
      <div class="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-20 hidden group-focus:block">
        <div class="p-2">
          <button 
            class="w-full text-left px-3 py-2 rounded hover:bg-gray-800"
            on:click={() => setSortField('date')}
          >
            DATE {sortField === 'date' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button 
            class="w-full text-left px-3 py-2 rounded hover:bg-gray-800"
            on:click={() => setSortField('name')}
          >
            NAME {sortField === 'name' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button 
            class="w-full text-left px-3 py-2 rounded hover:bg-gray-800"
            on:click={() => setSortField('principal')}
          >
            ID {sortField === 'principal' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}
          </button>
        </div>
      </div>
    </div>
    
    <!-- CREATE NEW BUTTON -->
    <button 
      on:click={handleCreateNew}
      class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg shadow-purple-500/20"
    >
      <Plus class="h-4 w-4" />
      <span class="hidden md:inline">{activeTab === 'tokens' ? 'CREATE POW TOKEN' : 'CREATE MINER'}</span>
    </button>
  </div>
</div> 