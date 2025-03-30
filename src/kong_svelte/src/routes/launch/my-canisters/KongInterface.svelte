<script lang="ts">
    import { onMount } from 'svelte';
    import { createEventDispatcher } from 'svelte';
    import { auth } from '$lib/stores/auth';
    import { toastStore } from '$lib/stores/toastStore';
    import Button from '$lib/components/common/Button.svelte';
    import { formatBalance } from '$lib/utils/numberFormatUtils';
    import { formatTokenBalance } from '$lib/utils/tokenFormatters';
    import DirectConnectTokenModal from './DirectConnectTokenModal.svelte';
    import Portal from 'svelte-portal';
    import { Principal } from '@dfinity/principal';
    import FlashEvent from '$lib/components/launch/FlashEvent.svelte';
    
    import { idlFactory as minerIdlFactory } from '$declarations/miner/miner.did.js';
    import { idlFactory as tokenBackendIdlFactory } from '$declarations/token_backend/token_backend.did.js';
    import type { MinerInfo, MiningStats } from '$declarations/miner/miner.did';
    import type { TokenInfo, MiningInfo } from '$declarations/token_backend/token_backend.did';
  
    const dispatch = createEventDispatcher();
    
    // Props
    export let canisterId: string;
    export let wasmType: string | null = null;
  
    // State
    let isLoading = true;
    let actor: any = null;
    let minerInfo: MinerInfo | null = null;
    let miningStats: MiningStats | null = null;
    let tokenInfo: TokenInfo | null = null;
    let miningInfo: MiningInfo | null = null;
    let currentBlock: any | null = null;
    let isMining = false;
    let isStartingToken = false;
    let isCreatingGenesisBlock = false;
    let isStartingMining = false;
    let isStoppingMining = false;
    let isConnectingToken = false;
    let isDisconnectingToken = false;
    let showConnectTokenModal = false;
    let isClaimingRewards = false;
    let isTransformingMiner = false;
    let isChangingSpeed = false;
    let speedPercentage = 100;
    let showTransformModal = false;
    let flashEvent = null;
  
    onMount(async () => {
      try {
        await loadCanisterInterface();
      } catch (error) {
        console.error('Error loading canister interface:', error);
        toastStore.error('Failed to load canister interface');
      }
    });
  
    async function loadCanisterInterface() {
      isLoading = true;
      try {
        // Get the appropriate IDL factory based on the WASM type
        const idlFactory = wasmType === 'miner' ? minerIdlFactory : 
                          wasmType === 'token_backend' ? tokenBackendIdlFactory : 
                          null;
        
        if (!idlFactory) {
          throw new Error(`Unsupported WASM type: ${wasmType}`);
        }
        
        // Create an actor for the canister
        actor = await auth.getActor(canisterId, idlFactory, { requiresSigning: true });
        
        // Load specific information based on the WASM type
        if (wasmType === 'miner') {
          await loadMinerInfo();
        } else if (wasmType === 'token_backend') {
          await loadTokenInfo();
        }
      } catch (error) {
        console.error('Error loading canister interface:', error);
        toastStore.error('Failed to load canister interface');
      } finally {
        isLoading = false;
      }
    }
    
    // Miner functions
    async function loadMinerInfo() {
      try {
        // Get miner info
        const infoResult = await actor.get_info();
        if ('Ok' in infoResult) {
          // Handle the case where miner_type is missing in the response
          const rawMinerInfo = infoResult.Ok;
          // Default to Normal type if miner_type is missing
          minerInfo = {
            ...rawMinerInfo,
            miner_type: rawMinerInfo.miner_type || { Normal: null }
          };
          // Extract mining status from minerInfo
          isMining = minerInfo.is_mining;
          // Extract speed percentage from minerInfo
          speedPercentage = minerInfo.speed_percentage;
        } else {
          toastStore.error(`Failed to get miner info: ${infoResult.Err}`);
        }
        
        // Get mining stats
        const statsResult = await actor.get_mining_stats();
        if (statsResult && statsResult.length > 0) {
          miningStats = statsResult[0];
        } else {
          miningStats = null;
        }
      } catch (error) {
        console.error('Error loading miner info:', error);
        toastStore.error('Failed to load miner information');
      }
    }
  
    async function startMining() {
      isStartingMining = true;
      try {
        const result = await actor.start_mining();
        if ('Ok' in result) {
          toastStore.success('Mining started successfully');
          isMining = true;
          await loadMinerInfo();
          
          // Show flash event
          flashEvent = {
            type: 'miner_started',
            data: { canister_id: canisterId }
          };
          
          // Hide flash event after 3 seconds
          setTimeout(() => {
            flashEvent = null;
          }, 3000);
        } else {
          toastStore.error(`Failed to start mining: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error starting mining:', error);
        toastStore.error('Failed to start mining');
      } finally {
        isStartingMining = false;
      }
    }
  
    async function stopMining() {
      isStoppingMining = true;
      try {
        const result = await actor.stop_mining();
        if ('Ok' in result) {
          toastStore.success('Mining stopped successfully');
          isMining = false;
          await loadMinerInfo();
        } else {
          toastStore.error(`Failed to stop mining: ${result.Err}`);
        }
      } finally {
        isStoppingMining = false;
      }
    }
    
    function openConnectTokenModal() {
      showConnectTokenModal = true;
    }
    
    function closeConnectTokenModal() {
      showConnectTokenModal = false;
    }
    
    async function handleConnectToken(event: CustomEvent<string>) {
      const tokenCanisterId = event.detail;
      await connectToken(tokenCanisterId);
    }
    
    async function connectToken(tokenCanisterId: string) {
      isConnectingToken = true;
      try {
        // Convert the string canisterId to a Principal object
        const tokenPrincipal = Principal.fromText(tokenCanisterId);
        const result = await actor.connect_token(tokenPrincipal);
        if ('Ok' in result) {
          toastStore.success('Token connected successfully');
          await loadMinerInfo();
          
          // Show flash event
          flashEvent = {
            type: 'token_connected',
            data: { canister_id: tokenCanisterId }
          };
          
          // Hide flash event after 3 seconds
          setTimeout(() => {
            flashEvent = null;
          }, 3000);
        } else {
          toastStore.error(`Failed to connect token: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error connecting token:', error);
        toastStore.error('Error connecting token: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        isConnectingToken = false;
      }
    }
    
    async function disconnectToken() {
      isDisconnectingToken = true;
      try {
        const result = await actor.disconnect_token();
        if ('Ok' in result) {
          toastStore.success('Token disconnected successfully');
          await loadMinerInfo();
        } else {
          toastStore.error(`Failed to disconnect token: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error disconnecting token:', error);
        toastStore.error('Failed to disconnect token');
      } finally {
        isDisconnectingToken = false;
      }
    }
  
    // Token backend functions
    async function loadTokenInfo() {
      try {
        const infoResult = await actor.get_info();
        if ('Ok' in infoResult) {
          tokenInfo = infoResult.Ok;
        } else {
          toastStore.error(`Failed to get token info: ${infoResult.Err}`);
        }
  
        miningInfo = await actor.get_mining_info();
        const blockResult = await actor.get_current_block();
        if (blockResult && blockResult.length > 0) {
          currentBlock = blockResult[0];
        } else {
          currentBlock = null;
        }
      } catch (error) {
        console.error('Error loading token info:', error);
        toastStore.error('Failed to load token information');
      }
    }
  
    async function startToken() {
      isStartingToken = true;
      try {
        const result = await actor.start_token();
        if ('Ok' in result) {
          toastStore.success('Token started successfully');
          await loadTokenInfo();
        } else {
          toastStore.error(`Failed to start token: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error starting token:', error);
        toastStore.error('Failed to start token');
      } finally {
        isStartingToken = false;
      }
    }
  
    async function createGenesisBlock() {
      isCreatingGenesisBlock = true;
      try {
        const result = await actor.create_genesis_block();
        if ('Ok' in result) {
          toastStore.success('Genesis block created successfully');
          await loadTokenInfo();
        } else {
          toastStore.error(`Failed to create genesis block: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error creating genesis block:', error);
        toastStore.error('Failed to create genesis block');
      } finally {
        isCreatingGenesisBlock = false;
      }
    }
  
    // Add new functions for the new functionality
    async function claimRewards() {
      isClaimingRewards = true;
      try {
        const result = await actor.claim_rewards();
        if ('Ok' in result) {
          toastStore.success('Rewards claimed successfully');
          await loadMinerInfo();
          
          // Show flash event
          flashEvent = {
            type: 'rewards_claimed',
            data: { canister_id: canisterId }
          };
          
          // Hide flash event after 3 seconds
          setTimeout(() => {
            flashEvent = null;
          }, 3000);
        } else {
          toastStore.error(`Failed to claim rewards: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error claiming rewards:', error);
        toastStore.error('Failed to claim rewards');
      } finally {
        isClaimingRewards = false;
      }
    }
    
    async function changeSpeed(newSpeed: number) {
      isChangingSpeed = true;
      try {
        const result = await actor.set_mining_speed(newSpeed);
        if ('Ok' in result) {
          toastStore.success(`Mining speed set to ${newSpeed}%`);
          speedPercentage = newSpeed;
          await loadMinerInfo();
        } else {
          toastStore.error(`Failed to set mining speed: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error setting mining speed:', error);
        toastStore.error('Failed to set mining speed');
      } finally {
        isChangingSpeed = false;
      }
    }
    
    function handleSpeedChange(event: Event) {
      const target = event.target as HTMLInputElement;
      const newSpeed = parseInt(target.value, 10);
      changeSpeed(newSpeed);
    }
    
    // Transform miner functionality (TODO)
    async function transformMiner(type: any) {
      isTransformingMiner = true;
      try {
        const result = await actor.transform_miner(type);
        if ('Ok' in result) {
          toastStore.success('Miner transformed successfully');
          await loadMinerInfo();
        } else {
          toastStore.error(`Failed to transform miner: ${result.Err}`);
        }
      } catch (error) {
        console.error('Error transforming miner:', error);
        toastStore.error('Failed to transform miner');
      } finally {
        isTransformingMiner = false;
      }
    }
    
    // For now, this is a placeholder for future implementation
    function openTransformModal() {
      // TODO: Implement transform miner modal
      toastStore.info('Transform miner functionality coming soon');
    }
  
    function handleClose() {
      dispatch('close');
    }
</script>
  
<div class="overflow-y-auto text-white">
  <div class="space-y-6">
    <div class="mb-4">
      <p class="text-sm text-gray-400">Canister ID: {canisterId}</p>
    </div>
    
    {#if isLoading}
      <div class="flex flex-col items-center justify-center p-8 space-y-4">
        <div class="w-8 h-8 border-4 rounded-full border-t-blue-500 border-b-blue-700 animate-spin"></div>
        <p class="text-gray-300">Loading canister interface...</p>
      </div>
    {:else if wasmType === 'miner'}
      <!-- Miner Interface -->
      {#if minerInfo}
        <div class="mb-6">
          <h4 class="mb-3 text-sm font-medium text-gray-300">Miner Information</h4>
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Status</div>
              <div class="text-sm font-medium text-green-400">
                {isMining ? 'Mining' : 'Idle'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Speed</div>
              <div class="text-sm font-medium text-purple-400">
                {minerInfo.speed_percentage ?? 0}%
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Chunks per Refresh</div>
              <div class="text-sm font-medium text-amber-400">
                {minerInfo.chunks_per_refresh?.toString() || '0'}
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if miningStats}
        <div class="mb-6">
          <h4 class="mb-3 text-sm font-medium text-gray-300">Mining Stats</h4>
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Total Hashes</div>
              <div class="text-sm font-medium text-blue-400">
                {miningStats.total_hashes?.toString() || '0'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Blocks Mined</div>
              <div class="text-sm font-medium text-green-400">
                {miningStats.blocks_mined?.toString() || '0'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Hash Rate</div>
              <div class="text-sm font-medium text-purple-400">
                {miningStats.last_hash_rate?.toFixed(2) || '0'} H/s
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Total Rewards</div>
              <div class="text-sm font-medium text-amber-400">
                {miningStats.total_rewards?.toString() || '0'}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Mining Controls -->
      <div class="space-y-2">
        <h4 class="mb-3 text-sm font-medium text-gray-300">Mining Controls</h4>
        
        <!-- Mining Speed Control -->
        <div class="mb-4 p-2 rounded bg-gray-800">
          <div class="flex justify-between items-center mb-2">
            <div class="text-xs text-gray-400">Mining Speed: {speedPercentage}%</div>
            <div class="text-xs text-gray-400">
              {#if isChangingSpeed}
                <span class="inline-block w-3 h-3 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
              {/if}
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={speedPercentage}
            on:change={handleSpeedChange}
            disabled={isChangingSpeed || !isMining}
            class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-700 accent-blue-500"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-400">1%</span>
            <span class="text-xs text-gray-400">50%</span>
            <span class="text-xs text-gray-400">100%</span>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-2">
          {#if isMining}
            <button
              on:click={stopMining}
              disabled={isStoppingMining}
              class="px-3 py-2 text-sm text-white transition-colors bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isStoppingMining}
                <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
              {/if}
              Stop Mining
            </button>
          {:else}
            <button
              on:click={startMining}
              disabled={isStartingMining}
              class="px-3 py-2 text-sm text-white transition-colors bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isStartingMining}
                <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
              {/if}
              Start Mining
            </button>
          {/if}
          
          <button
            on:click={openConnectTokenModal}
            disabled={isConnectingToken}
            class="px-3 py-2 text-sm text-white transition-colors bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isConnectingToken}
              <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
            {/if}
            Connect Token
          </button>
          
          <button
            on:click={disconnectToken}
            disabled={isDisconnectingToken}
            class="px-3 py-2 text-sm text-white transition-colors rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isDisconnectingToken}
              <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
            {/if}
            Disconnect Token
          </button>
          
          <!-- New buttons for claim rewards and transform miner -->
          <button
            on:click={claimRewards}
            disabled={isClaimingRewards || !minerInfo?.current_token[0] || !miningStats?.total_rewards || miningStats?.total_rewards <= 0}
            class="px-3 py-2 text-sm text-white transition-colors rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isClaimingRewards}
              <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
            {/if}
            Claim Rewards
          </button>
          
          <button
            on:click={openTransformModal}
            disabled={isTransformingMiner}
            class="px-3 py-2 text-sm text-white transition-colors rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isTransformingMiner}
              <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
            {/if}
            Transform Miner (TODO)
          </button>
        </div>
      </div>
    {:else if wasmType === 'token_backend'}
      <!-- Token Backend Interface -->
      {#if tokenInfo}
        <div class="mb-6">
          <h4 class="mb-3 text-sm font-medium text-gray-300">Token Information</h4>
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Name</div>
              <div class="text-sm font-medium text-blue-400">
                {tokenInfo.name || 'Unknown'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Ticker</div>
              <div class="text-sm font-medium text-green-400">
                {tokenInfo.ticker || 'Unknown'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Decimals</div>
              <div class="text-sm font-medium text-purple-400">
                {tokenInfo.decimals ?? 0}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Total Supply</div>
              <div class="text-sm font-medium text-amber-400">
                {tokenInfo.total_supply ? formatBalance(tokenInfo.total_supply, tokenInfo.decimals) : '0'} {tokenInfo.ticker || ''}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Transfer Fee</div>
              <div class="text-sm font-medium text-red-400">
                {tokenInfo.transfer_fee ? formatBalance(tokenInfo.transfer_fee, tokenInfo.decimals) : '0'} {tokenInfo.ticker || ''}
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if miningInfo}
        <div class="mb-6">
          <h4 class="mb-3 text-sm font-medium text-gray-300">Mining Information</h4>
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Current Difficulty</div>
              <div class="text-sm font-medium text-blue-400">
                {miningInfo.current_difficulty?.toFixed(8) || '0'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Block Time Target</div>
              <div class="text-sm font-medium text-green-400">
                {miningInfo.block_time_target?.toString() || '0'} seconds
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Current Block Reward</div>
              <div class="text-sm font-medium text-purple-400">
                {miningInfo.current_block_reward?.toString() || '0'} {tokenInfo?.ticker || ''}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Mining Complete</div>
              <div class="text-sm font-medium text-amber-400">
                {miningInfo.mining_complete ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if currentBlock}
        <div class="mb-6">
          <h4 class="mb-3 text-sm font-medium text-gray-300">Current Block</h4>
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Height</div>
              <div class="text-sm font-medium text-blue-400">
                {currentBlock.height?.toString() || '0'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Difficulty</div>
              <div class="text-sm font-medium text-green-400">
                {currentBlock.difficulty?.toFixed(8) || '0'}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-800">
              <div class="text-xs text-gray-400">Timestamp</div>
              <div class="text-sm font-medium text-purple-400">
                {currentBlock.timestamp ? new Date(Number(currentBlock.timestamp) / 1_000_000).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Token Controls -->
      <div class="space-y-2">
        <h4 class="mb-3 text-sm font-medium text-gray-300">Token Controls</h4>
        <div class="grid grid-cols-1 gap-2">
          <button
            on:click={startToken}
            disabled={isStartingToken}
            class="px-3 py-2 text-sm text-white transition-colors bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isStartingToken}
              <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
            {/if}
            Start Token
          </button>
          
          <button
            on:click={createGenesisBlock}
            disabled={isCreatingGenesisBlock}
            class="px-3 py-2 text-sm text-white transition-colors bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isCreatingGenesisBlock}
              <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
            {/if}
            Generate Genesis Block
          </button>
        </div>
      </div>
    {:else}
      <div class="p-3 mb-4 rounded bg-yellow-900/30">
        <p class="text-yellow-500">The canister type "{wasmType}" is not supported by this interface.</p>
      </div>
    {/if}
  </div>
</div>

<!-- Connect Token Modal -->
{#if showConnectTokenModal}
  <DirectConnectTokenModal 
    isOpen={showConnectTokenModal}
    onClose={closeConnectTokenModal}
    on:connect={handleConnectToken}
  />
{/if}

<!-- Flash Event -->
{#if flashEvent}
  <FlashEvent {flashEvent} />
{/if}