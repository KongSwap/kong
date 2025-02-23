<script lang="ts">
  import { onMount } from 'svelte';
  import { createPNP } from '@windoge98/plug-n-play';
  import { idlFactory } from '../../../../token_backend.did.js';
  import { tokenInfo } from '../../stores/token-info';
  import { tokenStore } from '../../stores/tokens';
  import type { TokenInfo, Result, MiningInfo, Block, _SERVICE } from '../../../../token_backend.did.js';

  export let isConnected: boolean = false;
  export let metrics: any = null;

  let tokenInfoValue: TokenInfo;
  tokenInfo.subscribe(value => {
    console.log('TokenInfo updated:', value);
    tokenInfoValue = value as TokenInfo;
  });

  let miningInfo: MiningInfo | null = null;
  let currentBlock: Block | null = null;
  let pnp: any = null;
  let anonActor: _SERVICE | null = null;
  let tokenMetrics: {
    total_supply: bigint;
    circulating_supply: bigint;
    holders: number;
    total_transactions: number;
  } | null = null;
  let activeMinerCount = 0;
  let averageBlockTime: bigint | null = null;
  let intervals: (number | NodeJS.Timeout)[] = [];
  let lastUpdateTimes = {
    mining: null as number | null,
    block: null as number | null,
    metrics: null as number | null,
    network: null as number | null
  };

  function getCanisterId(): string {
    if (pnp?.isDev) {
      return 'sk4hs-faaaa-aaaag-at3rq-cai';
    }
    if (typeof window !== 'undefined' && window.__CANISTER_ID__) {
      return window.__CANISTER_ID__;
    }
    throw new Error('Canister ID not found');
  }

  async function getAnonActor(): Promise<_SERVICE> {
    try {
      if (!anonActor) {
        const canisterId = getCanisterId();
        anonActor = await pnp.getActor(canisterId, idlFactory, { anon: true });
      }
      return anonActor;
    } catch (error) {
      console.error("Failed to create anonymous actor:", error);
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

      miningInfo = 'Ok' in result ? result.Ok : 
                   'current_difficulty' in result ? result :
                   null;

      if ('Err' in result) {
        console.error('Failed to get mining info:', result.Err);
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

      currentBlock = 'Ok' in result ? result.Ok : null;

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
      const result = await actor.get_info();
      
      if ('Ok' in result) {
        // Update tokenInfo store with all token information
        tokenInfo.setInfo(
          result.Ok.name, 
          result.Ok.ticker,
          Array.isArray(result.Ok.decimals) ? result.Ok.decimals[0] : 8,
          Array.isArray(result.Ok.logo) ? result.Ok.logo[0] : undefined,
          Array.isArray(result.Ok.ledger_id) ? result.Ok.ledger_id[0] : undefined,
          Array.isArray(result.Ok.archive_options) ? result.Ok.archive_options[0] : undefined,
          result.Ok.total_supply
        );

        tokenMetrics = {
          total_supply: result.Ok.total_supply,
          circulating_supply: result.Ok.total_supply, // Assuming all tokens are in circulation for now
          holders: 0, // This info isn't available yet
          total_transactions: 0 // This info isn't available yet
        };
      }

      if ('Err' in result) {
        console.error('Failed to get token info:', result.Err);
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
      const blockTimeResult = await actor.get_average_block_time();
      if ('Ok' in blockTimeResult) {
        averageBlockTime = blockTimeResult.Ok;
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

  async function initialize() {
    try {
      console.log('Starting initialization...');
      
      if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
        (window as any).global = window;
      }

      console.log('Creating PNP...');
      pnp = createPNP({
        hostUrl: "https://icp0.io",
        isDev: false,
      });

      console.log('Fetching tokens...');
      try {
        await tokenStore.fetchTokens();
        // Add direct canister call to get token info
        const actor = await getAnonActor();
        const result = await actor.get_info();
        console.log('Direct token info result:', result);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }

      await Promise.all([
        refreshMiningInfo(),
        refreshCurrentBlock(),
        fetchTokenMetrics(),
        refreshNetworkStatus()
      ]);
      
      // Set up auto-refresh intervals
      intervals = [
        setInterval(refreshMiningInfo, 1000),
        setInterval(refreshCurrentBlock, 1000), 
        setInterval(fetchTokenMetrics, 3000),
        setInterval(refreshNetworkStatus, 1000)
      ];
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  }

  onMount(() => {
    initialize().catch(error => {
      console.error('Failed to initialize:', error);
    });

    return () => {
      intervals.forEach(clearInterval);
    };
  });
</script>

<div class="container px-4 py-8 mx-auto max-w-7xl">
  <!-- Ledger ID Banner -->
  <div class="p-4 mb-6 text-center transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
    <h2 class="mb-2 text-lg font-medium text-emerald-500">Floppa's Ledger ID</h2>
    <div class="flex items-center justify-center gap-2">
      <code class="px-3 py-1 font-mono text-sm text-white rounded-lg bg-black/30">{tokenInfoValue.ledger_id || 'Ledger not yet initialized'}</code>
      <button 
        class="p-2 transition-colors rounded-lg hover:bg-black/20" 
        on:click={() => {
          if (tokenInfoValue?.ledger_id) {
            navigator.clipboard.writeText(String(tokenInfoValue.ledger_id));
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
        <svg class="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
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
        {#if metrics}
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Total Supply</span>
            <p class="text-lg font-medium text-white">{formatTokenAmount(metrics.total_supply)} {tokenInfoValue.ticker}</p>
          </div>
          <div class="space-y-1">
            <span class="text-sm text-gray-400">Circulating Supply</span>
            <p class="text-lg font-medium text-white">{formatTokenAmount(metrics.circulating_supply)} {tokenInfoValue.ticker}</p>
          </div>
        {:else}
          <div class="flex items-center justify-center col-span-2 py-4 italic text-gray-400">
            Loading token metrics...
          </div>
        {/if}
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
