<script lang="ts">
  import { onMount } from "svelte";
  import { wsConnected, wsEvents, notifications, connectWebSocket, disconnectWebSocket, canistersList } from "$lib/api/canisters";
  import { Plus, Search, SortDesc } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenList from "$lib/components/launch/TokenList.svelte";
  import MinerList from "$lib/components/launch/MinerList.svelte";

  let activeTab: "tokens" | "miners" = "tokens";
  let searchQuery = "";
  let loading = true;
  let sortField: "date" | "name" | "principal" | "version" = "date";
  let sortDirection: "asc" | "desc" = "desc";

  let tokens = [];
  let miners = [];

  onMount(async () => {
    connectWebSocket();
    try {
      [tokens, miners] = await Promise.all([
        get_token_backends(),
        get_miners()
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      loading = false;
    }
    return () => disconnectWebSocket();
  });

  async function get_token_backends() {
    // Simulating API delay
    return [
      {
        decimals: 8,
        ticker: "KONG",
        transfer_fee: BigInt(1000),
        logo: ["https://example.com/kong.png"],
        name: "Kong Token",
        ledger_id: [],
        total_supply: BigInt(1000000000000),
        principal: "rrkah-fqaaa-aaaaa-aaaaq-cai",
        version: "d13c3f01a",
        dateCreated: new Date("2023-09-01"),
      },
      {
        decimals: 6,
        ticker: "BANANA",
        transfer_fee: BigInt(500),
        logo: ["https://example.com/banana.png"],
        name: "Banana Token",
        ledger_id: [],
        total_supply: BigInt(500000000000),
        principal: "qsgjb-riaaa-aaaaa-aaaga-cai",
        version: "c24d3f01b", 
        dateCreated: new Date("2023-08-15"),
      }
    ];
  }

  async function get_miners() {
    // Simulating API delay
    return [
      {
        owner: "2vxsx-fae",
        current_token: [],
        is_mining: true,
        type: { Normal: null },
        mining_stats: {
          total_hashes: BigInt(1000000),
          blocks_mined: BigInt(50),
          total_rewards: BigInt(5000000),
          last_hash_rate: 2500.5,
          start_time: BigInt(Date.now() - 86400000),
        },
        principal: "aaaaa-aa",
        version: "a13c3f01c",
        dateCreated: new Date("2023-09-10"),
      },
      {
        owner: "2vxsx-fae",
        current_token: [],
        is_mining: false,
        type: { Premium: null },
        mining_stats: null,
        principal: "bbbbb-bb",
        version: "b24d3f01d",
        dateCreated: new Date("2023-08-20"),
      }
    ];
  }

  function handleCreateNew() {
    goto(`/launch/${activeTab === "tokens" ? "create-token" : "create-miner"}`);
  }

  function sortItems(items) {
    return [...items].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = a.dateCreated.getTime() - b.dateCreated.getTime();
          break;
        case "name":
          comparison = (a.name || a.owner).localeCompare(b.name || b.owner);
          break;
        case "principal":
          comparison = a.principal.localeCompare(b.principal);
          break;
        case "version":
          comparison = a.version.localeCompare(b.version);
          break;
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }

  $: filteredTokens = sortItems(tokens.filter(token => {
    const searchLower = searchQuery.toLowerCase();
    return token.name.toLowerCase().includes(searchLower) ||
           token.ticker.toLowerCase().includes(searchLower) ||
           token.principal.toLowerCase().includes(searchLower) ||
           token.version.toLowerCase().includes(searchLower) ||
           token.dateCreated.toLocaleDateString().includes(searchLower);
  }));

  $: filteredMiners = sortItems(miners.filter(miner => {
    const searchLower = searchQuery.toLowerCase();
    return miner.owner.toLowerCase().includes(searchLower) ||
           miner.principal.toLowerCase().includes(searchLower) ||
           miner.version.toLowerCase().includes(searchLower) ||
           miner.dateCreated.toLocaleDateString().includes(searchLower);
  }));
</script>

<style>
  /* Add flashing and dynamic styles here */
  .flashing {
    animation: flash 1s infinite alternate;
  }

  @keyframes flash {
    from { background-color: #222; }
    to { background-color: #444; }
  }
</style>

<div class="min-h-screen px-4 text-kong-text-primary flashing">
  <div class="mx-auto max-w-7xl">
    <div class="flex flex-col gap-6 mb-8 text-center md:flex-row md:justify-between md:items-center">
      <div class="flex flex-col gap-2">
        <h1 class="flex items-center justify-center gap-3 text-2xl font-bold md:justify-start drop-shadow-lg md:text-3xl text-kong-text-primary/80">
          Launch
        </h1>
        <p class="text-sm text-kong-text-primary/60">
          Launch your own token or miner on KongSwap
        </p>
      </div>
      <button
        on:click={handleCreateNew}
        class="flex items-center justify-center gap-2 px-4 py-2 text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90"
      >
        <Plus size={20} />
        Create New {activeTab === "tokens" ? "Token" : "Miner"}
      </button>
    </div>

    <div class="mb-6">
      <div class="flex gap-4 mb-4">
        <button
          class="px-4 py-2 rounded-lg {activeTab === 'tokens' ? 'bg-kong-primary text-white' : 'text-kong-text-primary/60 hover:text-kong-text-primary'}"
          on:click={() => activeTab = "tokens"}
        >
          Tokens
        </button>
        <button
          class="px-4 py-2 rounded-lg {activeTab === 'miners' ? 'bg-kong-primary text-white' : 'text-kong-text-primary/60 hover:text-kong-text-primary'}"
          on:click={() => activeTab = "miners"}
        >
          Miners
        </button>
      </div>

      <div class="flex gap-4 mb-4">
        <div class="relative flex-1">
          <input
            type="text"
            placeholder="Search by name, principal, version or date..."
            bind:value={searchQuery}
            class="w-full px-4 py-2 pl-10 border rounded-lg bg-kong-background-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          />
          <Search size={20} class="absolute transform -translate-y-1/2 left-3 top-1/2 text-kong-text-primary/60" />
        </div>

        <select
          bind:value={sortField}
          class="px-4 py-2 border rounded-lg bg-kong-background-secondary border-kong-border focus:outline-none focus:border-kong-primary"
        >
          <option value="date">Date</option>
          <option value="name">Name</option>
          <option value="principal">Principal</option>
          <option value="version">Version</option>
        </select>

        <button
          on:click={() => sortDirection = sortDirection === "asc" ? "desc" : "asc"}
          class="px-4 py-2 border rounded-lg bg-kong-background-secondary border-kong-border hover:bg-kong-background-secondary/80"
        >
          <SortDesc size={20} class="transform {sortDirection === 'asc' ? 'rotate-180' : ''}" />
        </button>
      </div>
    </div>

    <div class="grid gap-6">
      {#if activeTab === "tokens"}
        <TokenList tokens={filteredTokens} {loading} />
      {:else}
        <MinerList miners={filteredMiners} {loading} />
      {/if}
    </div>
  </div>
</div>
