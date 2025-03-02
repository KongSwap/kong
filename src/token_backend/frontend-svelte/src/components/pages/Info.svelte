<script lang="ts">
  import { onMount } from 'svelte';
  import { idlFactory } from '../../../../../../src/declarations/token_backend/token_backend.did.js';
  import { tokenInfo } from '../../stores/token-info';
  import type { TokenInfo as CanisterTokenInfo, Result, MiningInfo, BlockTemplate, _SERVICE } from '../../../../../../src/declarations/token_backend/token_backend.did.js';
  import type { TokenInfo } from '../../stores/token-info';
  import { Principal } from '@dfinity/principal';
  import { createPNP } from '@windoge98/plug-n-play';

  export let isConnected: boolean = false;
  export let metrics: any = null;
  export let pnp: any = null;

  let tokenInfoValue: TokenInfo;
  tokenInfo.subscribe(value => {
    console.log('TokenInfo updated:', value);
    tokenInfoValue = value;
  });

  let miningInfo: MiningInfo | null = null;
  let currentBlock: BlockTemplate | null = null;
  let anonActor: _SERVICE | null = null;
  let tokenMetrics: {
    total_supply: bigint;
    circulating_supply: bigint;
    holders: number;
    total_transactions: number;
  } | null = null;
  let activeMinerCount = 0;
  let averageBlockTime: number | null = null;
  let intervals: (number | NodeJS.Timeout)[] = [];
  let lastUpdateTimes = {
    mining: null as number | null,
    block: null as number | null,
    metrics: null as number | null,
    network: null as number | null
  };
  let logoUrl: string | null = null;

  function getCanisterId(): string {
    if (typeof window !== 'undefined') {
      console.log('Looking for canister ID in window variables');
      if (window.__CANISTER_ID__) {
        console.log('Found canister ID in window.__CANISTER_ID__:', window.__CANISTER_ID__);
        return window.__CANISTER_ID__;
      }
      if ((window as any).canisterId) {
        console.log('Found canister ID in window.canisterId:', (window as any).canisterId);
        return (window as any).canisterId;
      }
      if ((window as any).canisterIdRoot) {
        console.log('Found canister ID in window.canisterIdRoot:', (window as any).canisterIdRoot);
        return (window as any).canisterIdRoot;
      }
      
      // Add fallback canister ID
      const fallbackCanisterId = "bkyz2-fmaaa-aaaaa-qaaaq-cai";
      console.log("Using fallback canister ID:", fallbackCanisterId);
      return fallbackCanisterId;
    }
    console.error('Canister ID not found in window variables');
    throw new Error('Canister ID not found in window variables');
  }

  async function initializePnp() {
    if (!pnp && typeof window !== 'undefined') {
      console.log("Initializing PNP locally in Info component");
      try {
        // Ensure global is defined
        if (typeof (window as any).global === 'undefined') {
          (window as any).global = window;
        }
        
        pnp = createPNP({
          hostUrl: "https://icp0.io",
          isDev: false,
          identityProvider: "https://identity.ic0.app",
          derivationOrigin: window.location.origin,
          persistSession: true
        });
        
        console.log("PNP initialized locally in Info component");
      } catch (error) {
        console.error("Failed to initialize PNP locally:", error);
      }
    }
  }

  async function getAnonActor(): Promise<_SERVICE> {
    try {
      // If we already have an actor instance, use it
      if (anonActor) {
        return anonActor as _SERVICE;
      }
      
      // If pnp is not provided, try to initialize it
      if (!pnp) {
        await initializePnp();
      }
      
      // If pnp is available, use it to create an actor
      if (pnp) {
        const canisterId = getCanisterId();
        console.log("Info.svelte: Creating anonymous actor for canister:", canisterId);
        anonActor = await pnp.getActor(canisterId, idlFactory, { anon: true });
        if (!anonActor) {
          throw new Error("Failed to create anonymous actor");
        }
        return anonActor as _SERVICE;
      }
      
      throw new Error("PNP not initialized");
    } catch (error) {
      console.error("Info.svelte: Failed to create anonymous actor:", error);
      throw error;
    }
  }

  function getTimeSince(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    return seconds < 60 ? 'Just now' : `${seconds}s ago`;
  }

  async function refreshMiningInfo() {
    try {
      const actor = await getAnonActor();
      const result = await actor.get_mining_info();
      
      if (!result) {
        miningInfo = null;
        return;
      }

      // Handle different response formats
      if (typeof result === 'object') {
        if ('Ok' in result && result.Ok) {
          // Handle result wrapped in Ok
          const okResult = result.Ok;
          
          // Check if we have the expected structure
          if (typeof okResult === 'object') {
            // Create a compatible object with the fields we have
            const miningInfoData: any = { ...okResult };
            
            // Handle field name mismatch
            if (!('next_difficulty_adjustment' in okResult) && 'next_halving_interval' in okResult) {
              miningInfoData.next_difficulty_adjustment = okResult.next_halving_interval || BigInt(0);
            }
            
            miningInfo = miningInfoData as MiningInfo;
          }
        } else if ('Err' in result) {
          console.error('Failed to get mining info:', result.Err);
          miningInfo = null;
        } else if ('current_difficulty' in result) {
          // Direct result without Ok/Err wrapper
          const directResult = result;
          
          // Create a compatible object with the fields we have
          const miningInfoData: any = { ...directResult };
          
          // Handle field name mismatch
          if (!('next_difficulty_adjustment' in directResult) && 'next_halving_interval' in directResult) {
            miningInfoData.next_difficulty_adjustment = directResult.next_halving_interval || BigInt(0);
          }
          
          miningInfo = miningInfoData as MiningInfo;
        } else {
          console.error('Unexpected mining info response format:', result);
          miningInfo = null;
        }
      } else {
        console.error('Unexpected mining info response type:', typeof result);
        miningInfo = null;
      }
      
      lastUpdateTimes.mining = Date.now();
    } catch (error) {
      console.error('Error in refreshMiningInfo:', error);
      miningInfo = null;
    }
  }

  async function refreshCurrentBlock() {
    try {
      const actor = await getAnonActor();
      const result = await actor.get_current_block();

      if (!result || (Array.isArray(result) && result.length === 0)) {
        currentBlock = null;
        return;
      }

      if ('Ok' in result) {
        currentBlock = result.Ok as BlockTemplate;
      } else {
        currentBlock = null;
      }

      if ('Err' in result) {
        console.error('Failed to get current block:', result.Err);
      }
      lastUpdateTimes.block = Date.now();
    } catch (error) {
      console.error('Error in refreshCurrentBlock:', error);
      currentBlock = null;
    }
  }

  async function fetchTokenMetrics() {
    try {
      const actor = await getAnonActor();
      
      // First get token info for basic token details
      const infoResult = await actor.get_info();
      
      if ('Ok' in infoResult) {
        const info = infoResult.Ok as CanisterTokenInfo;
        
        // Update tokenInfo with all available fields
        tokenInfo.setInfo(
          info.name, 
          info.ticker,
          info.decimals,
          info.logo,
          info.ledger_id && info.ledger_id.length > 0 && info.ledger_id[0]?.toText ? [Principal.fromText(info.ledger_id[0].toText())] : [],
          info.archive_options,
          info.total_supply,
          info.transfer_fee,
          info.social_links
        );
        
        // Set the logo URL if available
        if (info.logo && info.logo.length > 0) {
          logoUrl = info.logo[0] || null;
        }
      }
      
      if ('Err' in infoResult) {
        console.error('Failed to get token info:', infoResult.Err);
      }
      
      // Now get metrics for supply information
      if (metrics) {
        // If metrics were passed from App.svelte, use them
        console.log("Using metrics from App.svelte:", metrics);
        tokenMetrics = {
          total_supply: metrics.total_supply,
          circulating_supply: metrics.circulating_supply,
          holders: 0,
          total_transactions: 0
        };
      } else {
        // Otherwise fetch metrics directly
        console.log("Fetching metrics directly");
        const metricsResult = await actor.get_metrics();
        
        if ('Ok' in metricsResult) {
          console.log("Got metrics:", metricsResult.Ok);
          tokenMetrics = {
            total_supply: metricsResult.Ok.total_supply,
            circulating_supply: metricsResult.Ok.circulating_supply,
            holders: 0,
            total_transactions: 0
          };
        } else if ('Err' in metricsResult) {
          console.error('Failed to get metrics:', metricsResult.Err);
        }
      }
      
      lastUpdateTimes.metrics = Date.now();
    } catch (error) {
      console.error('Error fetching token metrics:', error);
      tokenMetrics = null;
    }
  }

  async function refreshNetworkStatus() {
    try {
      const actor = await getAnonActor();
      
      // Get active miners count
      const activeMiners = await actor.get_active_miners();
      activeMinerCount = activeMiners.length;

      // Get average block time
      const blockTimeResult = await actor.get_average_block_time([]);
      if ('Ok' in blockTimeResult) {
        averageBlockTime = Number(blockTimeResult.Ok);
      }
      lastUpdateTimes.network = Date.now();
    } catch (error) {
      console.error('Error in refreshNetworkStatus:', error);
    }
  }

  const formatTokenAmount = (amount: number | bigint): string => {
    const decimals = tokenInfoValue?.decimals ?? 8;
    const num = Number(amount) / Math.pow(10, decimals);
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(num);
  };

  const formatDate = (timestamp: bigint): string => 
    new Date(Number(timestamp) * 1000).toLocaleString();

  onMount(() => {
    const initialize = async () => {
      try {
        console.log('Info component mounted');
        
        // Initialize PNP if not provided
        if (!pnp) {
          await initializePnp();
        }
        
        // Fetch token info and metrics
        await fetchTokenMetrics();
        
        // Fetch mining info and current block
        await refreshMiningInfo();
        await refreshCurrentBlock();
        await refreshNetworkStatus();
        
        // Set up refresh intervals for dynamic data
        intervals.push(setInterval(refreshMiningInfo, 30000)); // Every 30 seconds
        intervals.push(setInterval(refreshCurrentBlock, 30000)); // Every 30 seconds
        intervals.push(setInterval(refreshNetworkStatus, 60000)); // Every minute
        intervals.push(setInterval(fetchTokenMetrics, 60000)); // Refresh metrics every minute
        
        console.log('Info component initialization complete');
      } catch (error) {
        console.error('Error initializing Info component:', error);
      }
    };
    
    initialize();
    
    return () => {
      // Clean up intervals on component unmount
      intervals.forEach(interval => clearInterval(interval));
    };
  });
</script>

<div class="container px-4 py-8 mx-auto max-w-7xl">
  <!-- Ledger ID Banner -->
  <div class="p-4 mb-6 text-center transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
    <h2 class="mb-2 text-lg font-medium text-emerald-500">Floppa's Ledger ID</h2>
    <div class="flex items-center justify-center gap-2">
      <code class="px-3 py-1 font-mono text-sm text-white rounded-lg bg-black/30">{tokenInfoValue?.ledger_id && tokenInfoValue.ledger_id.length > 0 && tokenInfoValue.ledger_id[0]?.toText ? Principal.fromText(tokenInfoValue.ledger_id[0].toText()).toText() : 'Ledger not yet initialized'}</code>
      <button 
        class="p-2 transition-colors rounded-lg hover:bg-black/20" 
        on:click={() => {
          if (tokenInfoValue?.ledger_id && tokenInfoValue.ledger_id.length > 0 && tokenInfoValue.ledger_id[0]?.toText) {
            navigator.clipboard.writeText(Principal.fromText(tokenInfoValue.ledger_id[0].toText()).toText());
          } else {
            alert('Ledger not yet initialized');
          }
        }}
        title="Copy to clipboard"
      >
        <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- Token Information Card -->
    <div class="relative p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      {#if lastUpdateTimes.metrics}
        <div class="absolute flex items-center gap-2 top-2 right-2">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span class="text-xs text-gray-400">{getTimeSince(lastUpdateTimes.metrics)}</span>
        </div>
      {/if}
      <div class="flex items-center gap-3 mb-6">
        <!-- Display logo if available -->
        {#if tokenInfoValue?.logo && tokenInfoValue.logo.length > 0}
          {@const logoData = tokenInfoValue.logo[0]}
          {#if logoData}
            <img src={logoData.startsWith('data:') ? logoData : `data:image/png;base64,${logoData}`} alt="Token Logo" class="w-8 h-8 rounded-full" />
          {/if}
        {:else}
          <svg class="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
        {/if}
        <h3 class="text-xl font-bold text-emerald-500">Token Information</h3>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-1">
          <span class="text-sm text-gray-400">Name</span>
          <p class="text-lg font-medium text-white">{tokenInfoValue.name}</p>
        </div>
        <div class="space-y-1">
          <span class="text-sm text-gray-400">Ticker</span>
          <p class="text-lg font-medium text-white">{tokenInfoValue.ticker}</p>
        </div>
        <div class="space-y-1">
          <span class="text-sm text-gray-400">Decimals</span>
          <p class="text-lg font-medium text-white">{tokenInfoValue.decimals}</p>
        </div>
        <div class="space-y-1">
          <span class="text-sm text-gray-400">Transfer Fee</span>
          <p class="text-lg font-medium text-white">
            {#if tokenInfoValue?.transfer_fee !== undefined && tokenInfoValue?.decimals !== undefined}
              {formatTokenAmount(tokenInfoValue.transfer_fee)} {tokenInfoValue.ticker}
            {:else}
              Loading...
            {/if}
          </p>
        </div>
        <div class="space-y-1">
          <span class="text-sm text-gray-400">Total Supply</span>
          <p class="text-lg font-medium text-white">
            {#if tokenMetrics?.total_supply}
              {formatTokenAmount(tokenMetrics.total_supply)} {tokenInfoValue.ticker}
            {:else}
              {formatTokenAmount(tokenInfoValue.total_supply)} {tokenInfoValue.ticker}
            {/if}
          </p>
        </div>
        <div class="space-y-1">
          <span class="text-sm text-gray-400">Circulating Supply</span>
          <p class="text-lg font-medium text-white">
            {#if tokenMetrics?.circulating_supply}
              {formatTokenAmount(tokenMetrics.circulating_supply)} {tokenInfoValue.ticker}
            {:else}
              {formatTokenAmount(tokenInfoValue.total_supply)} {tokenInfoValue.ticker}
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- Mining Status Card -->
    <div class="relative p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      {#if lastUpdateTimes.mining || lastUpdateTimes.network}
        <div class="absolute flex items-center gap-2 top-2 right-2">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span class="text-xs text-gray-400">{getTimeSince(Math.max(lastUpdateTimes.mining || 0, lastUpdateTimes.network || 0))}</span>
        </div>
      {/if}
      <div class="flex items-center gap-3 mb-6">
        <svg class="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 class="text-xl font-bold text-emerald-500">Mining Status</h3>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {#if miningInfo}
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Current Difficulty</span>
            <p class="text-lg font-medium text-white">{miningInfo.current_difficulty}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Block Reward</span>
            <p class="text-lg font-medium text-white">{formatTokenAmount(miningInfo.current_block_reward)} {tokenInfoValue.ticker}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Active Miners</span>
            <p class="text-lg font-medium text-white">{activeMinerCount}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Block Time Target</span>
            <p class="text-lg font-medium text-white">{miningInfo.block_time_target} seconds</p>
          </div>
          {#if averageBlockTime !== null}
            <div class="col-span-2 space-y-1">
              <span class="text-sm text-gray-400">Average Block Time</span>
              <p class="text-lg font-medium text-white">{averageBlockTime} seconds</p>
            </div>
          {/if}
        {:else}
          <div class="flex items-center justify-center col-span-2 py-4 italic text-gray-400">
            Loading mining info...
          </div>
        {/if}
      </div>
    </div>

    <!-- Current Block Card -->
    <div class="relative p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl lg:col-span-2">
      {#if lastUpdateTimes.block}
        <div class="absolute flex items-center gap-2 top-2 right-2">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span class="text-xs text-gray-400">{getTimeSince(lastUpdateTimes.block)}</span>
        </div>
      {/if}
      <div class="flex items-center gap-3 mb-6">
        <svg class="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
        <h3 class="text-xl font-bold text-emerald-500">Current Block</h3>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {#if currentBlock}
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Height</span>
            <p class="text-lg font-medium text-white">{currentBlock.height}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Version</span>
            <p class="text-lg font-medium text-white">{currentBlock.version}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Timestamp</span>
            <p class="text-lg font-medium text-white">{formatDate(currentBlock.timestamp)}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Difficulty</span>
            <p class="text-lg font-medium text-white">{currentBlock.difficulty}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Nonce</span>
            <p class="text-lg font-medium text-white">{currentBlock.nonce}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Events</span>
            <p class="text-lg font-medium text-white">{currentBlock.events.length} events</p>
          </div>
        {:else}
          <div class="flex items-center justify-center col-span-3 py-4 italic text-gray-400">
            Loading current block...
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
