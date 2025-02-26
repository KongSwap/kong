<script lang="ts">
  import { onMount } from "svelte";
  import { Actor, HttpAgent } from "@dfinity/agent";
  import { Principal } from "@dfinity/principal";
  import { idlFactory } from "../../../../../../declarations/miner/miner.did";
  
  export let canisterId: string;
  
  // Types from miner.did.d.ts
  interface MinerInfo {
    speed_percentage: number;
    current_token: [] | [Principal];
    chunks_per_refresh: bigint;
    miner_type: MinerType;
    is_mining: boolean;
  }
  
  type MinerType = { 'Premium': null } | { 'Lite': null } | { 'Normal': null };
  
  interface MiningStats {
    total_hashes: bigint;
    blocks_mined: bigint;
    chunks_since_refresh: bigint;
    total_rewards: bigint;
    last_hash_rate: number;
    start_time: bigint;
  }
  
  type Result = { 'Ok': null } | { 'Err': string };
  type Result_1 = { 'Ok': MinerInfo } | { 'Err': string };
  
  // State variables
  let minerInfo: MinerInfo | null = null;
  let miningStats: MiningStats | null = null;
  let isLoading = true;
  let error: string | null = null;
  let tokenPrincipal = "";
  let newMiningSpeed = 50;
  let newRefreshInterval = 100n;
  let selectedMinerType: "Premium" | "Lite" | "Normal" = "Normal";
  
  // Create actor
  async function createActor() {
    try {
      const agent = new HttpAgent({ host: "https://ic0.app" });
      const principal = Principal.fromText(canisterId);
      
      // Create actor from interface description
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: principal,
      });
      
      return actor;
    } catch (e) {
      console.error("Error creating actor:", e);
      error = `Error creating actor: ${e.message}`;
      return null;
    }
  }
  
  // Load miner info
  async function loadMinerInfo() {
    isLoading = true;
    error = null;
    
    try {
      const actor = await createActor();
      if (!actor) return;
      
      // Get miner info
      const infoResult = await actor.get_info();
      if ('Err' in infoResult) {
        error = `Error getting miner info: ${infoResult.Err}`;
      } else {
        minerInfo = infoResult.Ok;
      }
      
      // Get mining stats
      const statsResult = await actor.get_mining_stats();
      if (statsResult.length > 0) {
        miningStats = statsResult[0];
      }
    } catch (e) {
      console.error("Error loading miner info:", e);
      error = `Error loading miner info: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }
  
  // Format bigint to readable number
  function formatBigInt(value: bigint): string {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  
  // Format timestamp to date
  function formatTimestamp(timestamp: bigint): string {
    // Convert nanoseconds to milliseconds
    const date = new Date(Number(timestamp) / 1_000_000);
    return date.toLocaleString();
  }
  
  // Format duration from start time
  function formatDuration(startTime: bigint): string {
    const startMs = Number(startTime) / 1_000_000;
    const nowMs = Date.now();
    const durationMs = nowMs - startMs;
    
    const seconds = Math.floor(durationMs / 1000) % 60;
    const minutes = Math.floor(durationMs / (1000 * 60)) % 60;
    const hours = Math.floor(durationMs / (1000 * 60 * 60)) % 24;
    const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  
  // Miner actions
  async function startMining() {
    try {
      const actor = await createActor();
      if (!actor) return;
      
      const result = await actor.start_mining();
      if ('Err' in result) {
        error = `Error starting mining: ${result.Err}`;
      } else {
        await loadMinerInfo();
      }
    } catch (e) {
      error = `Error starting mining: ${e.message}`;
    }
  }
  
  async function stopMining() {
    try {
      const actor = await createActor();
      if (!actor) return;
      
      const result = await actor.stop_mining();
      if ('Err' in result) {
        error = `Error stopping mining: ${result.Err}`;
      } else {
        await loadMinerInfo();
      }
    } catch (e) {
      error = `Error stopping mining: ${e.message}`;
    }
  }
  
  async function claimRewards() {
    try {
      const actor = await createActor();
      if (!actor) return;
      
      const result = await actor.claim_rewards();
      if ('Err' in result) {
        error = `Error claiming rewards: ${result.Err}`;
      } else {
        await loadMinerInfo();
      }
    } catch (e) {
      error = `Error claiming rewards: ${e.message}`;
    }
  }
  
  async function connectToken() {
    if (!tokenPrincipal) {
      error = "Please enter a token principal";
      return;
    }
    
    try {
      const actor = await createActor();
      if (!actor) return;
      
      const principal = Principal.fromText(tokenPrincipal);
      const result = await actor.connect_token(principal);
      if ('Err' in result) {
        error = `Error connecting token: ${result.Err}`;
      } else {
        await loadMinerInfo();
        tokenPrincipal = "";
      }
    } catch (e) {
      error = `Error connecting token: ${e.message}`;
    }
  }
  
  async function disconnectToken() {
    try {
      const actor = await createActor();
      if (!actor) return;
      
      const result = await actor.disconnect_token();
      if ('Err' in result) {
        error = `Error disconnecting token: ${result.Err}`;
      } else {
        await loadMinerInfo();
      }
    } catch (e) {
      error = `Error disconnecting token: ${e.message}`;
    }
  }
  
  async function setMiningSpeed() {
    try {
      const actor = await createActor();
      if (!actor) return;
      
      const result = await actor.set_mining_speed(newMiningSpeed);
      if ('Err' in result) {
        error = `Error setting mining speed: ${result.Err}`;
      } else {
        await loadMinerInfo();
      }
    } catch (e) {
      error = `Error setting mining speed: ${e.message}`;
    }
  }
  
  async function setRefreshInterval() {
    try {
      const actor = await createActor();
      if (!actor) return;
      
      const result = await actor.set_template_refresh_interval(newRefreshInterval);
      if ('Err' in result) {
        error = `Error setting refresh interval: ${result.Err}`;
      } else {
        await loadMinerInfo();
      }
    } catch (e) {
      error = `Error setting refresh interval: ${e.message}`;
    }
  }
  
  async function transformMiner() {
    try {
      const actor = await createActor();
      if (!actor) return;
      
      let minerType: MinerType;
      if (selectedMinerType === "Premium") {
        minerType = { Premium: null };
      } else if (selectedMinerType === "Lite") {
        minerType = { Lite: null };
      } else {
        minerType = { Normal: null };
      }
      
      const result = await actor.transform_miner(minerType);
      if ('Err' in result) {
        error = `Error transforming miner: ${result.Err}`;
      } else {
        await loadMinerInfo();
      }
    } catch (e) {
      error = `Error transforming miner: ${e.message}`;
    }
  }
  
  // Load data on mount
  onMount(() => {
    loadMinerInfo();
  });
</script>

<div>
  <h2 class="mb-4 text-xl font-bold">Miner Canister</h2>
  <p class="mb-4 font-mono">{canisterId}</p>
  
  {#if error}
    <div class="p-4 mb-4 text-red-500 rounded-lg bg-red-500/10">
      {error}
    </div>
  {/if}
  
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-4 rounded-full border-t-transparent border-kong-primary animate-spin"></div>
      <span class="ml-3">Loading miner data...</span>
    </div>
  {:else if minerInfo}
    <div class="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
      <!-- Miner Info -->
      <div class="p-4 rounded-lg bg-kong-bg-light/5">
        <h3 class="mb-2 text-sm font-medium text-kong-text-secondary">Miner Info</h3>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span>Status:</span>
            <span class={minerInfo.is_mining ? "text-green-500" : "text-red-500"}>
              {minerInfo.is_mining ? "Mining" : "Stopped"}
            </span>
          </div>
          <div class="flex justify-between">
            <span>Type:</span>
            <span>
              {Object.keys(minerInfo.miner_type)[0]}
            </span>
          </div>
          <div class="flex justify-between">
            <span>Mining Speed:</span>
            <span>{minerInfo.speed_percentage}%</span>
          </div>
          <div class="flex justify-between">
            <span>Chunks Per Refresh:</span>
            <span>{minerInfo.chunks_per_refresh.toString()}</span>
          </div>
          <div class="flex justify-between">
            <span>Connected Token:</span>
            <span>
              {#if minerInfo.current_token.length > 0}
                <span class="font-mono text-xs">{minerInfo.current_token[0].toString()}</span>
              {:else}
                <span class="text-kong-text-secondary">None</span>
              {/if}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Mining Stats -->
      {#if miningStats}
        <div class="p-4 rounded-lg bg-kong-bg-light/5">
          <h3 class="mb-2 text-sm font-medium text-kong-text-secondary">Mining Stats</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Total Hashes:</span>
              <span>{formatBigInt(miningStats.total_hashes)}</span>
            </div>
            <div class="flex justify-between">
              <span>Blocks Mined:</span>
              <span>{formatBigInt(miningStats.blocks_mined)}</span>
            </div>
            <div class="flex justify-between">
              <span>Total Rewards:</span>
              <span>{formatBigInt(miningStats.total_rewards)}</span>
            </div>
            <div class="flex justify-between">
              <span>Hash Rate:</span>
              <span>{miningStats.last_hash_rate.toFixed(2)} h/s</span>
            </div>
            <div class="flex justify-between">
              <span>Mining Since:</span>
              <span>{formatTimestamp(miningStats.start_time)}</span>
            </div>
            <div class="flex justify-between">
              <span>Mining Duration:</span>
              <span>{formatDuration(miningStats.start_time)}</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Control Panel -->
    <div class="p-4 mb-6 rounded-lg bg-kong-bg-light/5">
      <h3 class="mb-4 text-sm font-medium text-kong-text-secondary">Mining Controls</h3>
      
      <div class="flex flex-wrap gap-2">
        {#if minerInfo.is_mining}
          <button 
            on:click={stopMining}
            class="px-4 py-2 font-medium transition-colors bg-red-500 rounded-lg text-kong-text-inverse hover:bg-red-600"
          >
            Stop Mining
          </button>
        {:else}
          <button 
            on:click={startMining}
            class="px-4 py-2 font-medium transition-colors bg-green-500 rounded-lg text-kong-text-inverse hover:bg-green-600"
          >
            Start Mining
          </button>
        {/if}
        
        <button 
          on:click={claimRewards}
          class="px-4 py-2 font-medium transition-colors rounded-lg bg-kong-primary text-kong-text-inverse hover:bg-kong-primary-dark"
        >
          Claim Rewards
        </button>
      </div>
    </div>
    
    <!-- Token Connection -->
    <div class="p-4 mb-6 rounded-lg bg-kong-bg-light/5">
      <h3 class="mb-4 text-sm font-medium text-kong-text-secondary">Token Connection</h3>
      
      {#if minerInfo.current_token.length > 0}
        <div class="mb-4">
          <p class="mb-2">Connected to token:</p>
          <p class="font-mono text-sm">{minerInfo.current_token[0].toString()}</p>
        </div>
        
        <button 
          on:click={disconnectToken}
          class="px-4 py-2 font-medium transition-colors bg-red-500 rounded-lg text-kong-text-inverse hover:bg-red-600"
        >
          Disconnect Token
        </button>
      {:else}
        <div class="flex flex-col gap-2 mb-4 sm:flex-row">
          <input 
            type="text" 
            bind:value={tokenPrincipal}
            placeholder="Token Principal ID" 
            class="flex-1 px-3 py-2 bg-transparent border rounded-lg border-kong-border focus:border-kong-primary focus:outline-none"
          />
          
          <button 
            on:click={connectToken}
            class="px-4 py-2 font-medium transition-colors rounded-lg bg-kong-primary text-kong-text-inverse hover:bg-kong-primary-dark"
          >
            Connect Token
          </button>
        </div>
      {/if}
    </div>
    
    <!-- Mining Speed -->
    <div class="p-4 mb-6 rounded-lg bg-kong-bg-light/5">
      <h3 class="mb-4 text-sm font-medium text-kong-text-secondary">Mining Speed</h3>
      
      <div class="mb-4">
        <p class="mb-2">Current speed: {minerInfo.speed_percentage}%</p>
        <input 
          type="range" 
          min="1" 
          max="100" 
          bind:value={newMiningSpeed}
          class="w-full"
        />
        <p class="mt-1 text-sm text-kong-text-secondary">New speed: {newMiningSpeed}%</p>
      </div>
      
      <button 
        on:click={setMiningSpeed}
        class="px-4 py-2 font-medium transition-colors rounded-lg bg-kong-primary text-kong-text-inverse hover:bg-kong-primary-dark"
      >
        Update Mining Speed
      </button>
    </div>
    
    <!-- Refresh Interval -->
    <div class="p-4 mb-6 rounded-lg bg-kong-bg-light/5">
      <h3 class="mb-4 text-sm font-medium text-kong-text-secondary">Chunks Per Refresh</h3>
      
      <div class="flex flex-col gap-2 mb-4 sm:flex-row">
        <input 
          type="number" 
          bind:value={newRefreshInterval}
          min="1"
          class="flex-1 px-3 py-2 bg-transparent border rounded-lg border-kong-border focus:border-kong-primary focus:outline-none"
        />
        
        <button 
          on:click={setRefreshInterval}
          class="px-4 py-2 font-medium transition-colors rounded-lg bg-kong-primary text-kong-text-inverse hover:bg-kong-primary-dark"
        >
          Update Refresh Interval
        </button>
      </div>
      
      <p class="text-sm text-kong-text-secondary">Current: {minerInfo.chunks_per_refresh.toString()} chunks</p>
    </div>
    
    <!-- Transform Miner -->
    <div class="p-4 mb-6 rounded-lg bg-kong-bg-light/5">
      <h3 class="mb-4 text-sm font-medium text-kong-text-secondary">Transform Miner</h3>
      
      <div class="mb-4">
        <p class="mb-2">Current type: {Object.keys(minerInfo.miner_type)[0]}</p>
        
        <div class="flex flex-wrap gap-2">
          <label class="flex items-center gap-2">
            <input 
              type="radio" 
              bind:group={selectedMinerType} 
              value="Lite"
              class="text-kong-primary focus:ring-kong-primary"
            />
            Lite
          </label>
          
          <label class="flex items-center gap-2">
            <input 
              type="radio" 
              bind:group={selectedMinerType} 
              value="Normal"
              class="text-kong-primary focus:ring-kong-primary"
            />
            Normal
          </label>
          
          <label class="flex items-center gap-2">
            <input 
              type="radio" 
              bind:group={selectedMinerType} 
              value="Premium"
              class="text-kong-primary focus:ring-kong-primary"
            />
            Premium
          </label>
        </div>
      </div>
      
      <button 
        on:click={transformMiner}
        class="px-4 py-2 font-medium transition-colors rounded-lg bg-kong-primary text-kong-text-inverse hover:bg-kong-primary-dark"
      >
        Transform Miner
      </button>
    </div>
    
    <!-- Refresh Button -->
    <div class="flex justify-center">
      <button 
        on:click={loadMinerInfo}
        class="px-4 py-2 font-medium transition-colors rounded-lg bg-kong-bg-light/10 text-kong-text-primary hover:bg-kong-bg-light/20"
      >
        Refresh Miner Data
      </button>
    </div>
  {:else}
    <div class="p-4 text-center rounded-lg text-kong-text-secondary bg-kong-bg-light/5">
      <p>Could not load miner data. Please try refreshing.</p>
      <button 
        on:click={loadMinerInfo}
        class="px-4 py-2 mt-4 font-medium transition-colors rounded-lg bg-kong-primary text-kong-text-inverse hover:bg-kong-primary-dark"
      >
        Retry
      </button>
    </div>
  {/if}
</div> 
