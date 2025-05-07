<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import LoadingSpinner from "$lib/components/common/LoadingSpinner.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { Principal } from "@dfinity/principal";
  import { canisterId as launchpadCanisterId } from "$declarations/launchpad";
  import type { _SERVICE as LaunchpadService, TokenInfo as LaunchpadTokenInfo } from "$declarations/launchpad/launchpad.did.js";
  import type { _SERVICE as MinerService, MinerInfo, MiningStats } from "$declarations/miner/miner.did.js";
  import type { _SERVICE as LedgerService } from "$declarations/kong_ledger/kong_ledger.did.js";
  import type { ApproveArgs } from "$declarations/kong_ledger/kong_ledger.did";
  import { canisterIDLs } from "$lib/config/auth.config";
  import type { ActorSubclass } from "@dfinity/agent";
  import { toastStore } from "$lib/stores/toastStore";
  import { onDestroy } from "svelte";

  interface MinerData {
    principal: Principal;
    info: MinerInfo | null;
    stats: MiningStats | null;
    remainingHashes: bigint | null;
    timeRemaining: string | null;
    infoError: string | null;
    statsError: string | null;
    isLoadingInfo: boolean;
    isLoadingStats: boolean;
    isYours?: boolean; // Flag to indicate if this miner belongs to the current user
  }

  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let userMiners = $state<MinerData[]>([]);
  let isLoadingMinersList = $state(true);
  let listError = $state<string | null>(null);
  let availableTokens = $state<LaunchpadTokenInfo[]>([]);
  let isLoadingTokens = $state(false);
  let tokensError = $state<string | null>(null);
  let minerInputs = $state<Record<string, { chunkSize: string; topUp: string }>>({});
  let isTokenModalOpen = $state(false);
  let selectedMinerPrincipal = $state<Principal | null>(null);
  let selectedMinerIndex = $state<number>(-1);

  let globalMiners = $state<MinerData[]>([]);
  let isLoadingGlobal = $state(true);
  let globalError = $state<string | null>(null);
  let showAllMiners = $state(false); // Default to showing all miners
  let globalStats = $derived(() => {
    let totalHashrate = 0;
    let totalBlocks = 0n;
    let totalRewards = 0n;
    let totalMiners = 0;
    let activeMiners = 0;
    
    for (const miner of globalMiners) {
      if (miner.stats) {
        totalHashrate += miner.stats.last_hash_rate;
        totalBlocks += miner.stats.blocks_mined;
        totalRewards += miner.stats.total_rewards;
      }
      if (miner.info) {
        totalMiners++;
        if (miner.info.is_mining) activeMiners++;
      }
    }
    return { totalHashrate, totalBlocks, totalRewards, totalMiners, activeMiners };
  });

  const KONG_LEDGER_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai";
  let kongLedgerActor = $state<ActorSubclass<LedgerService> | null>(null);
  let kongTransferFee = $state<bigint>(0n);

  let cumulativeStats = $derived(() => {
    let totalHashrate = 0;
    let totalBlocks = 0n;
    let totalRewards = 0n;

    for (const miner of userMiners) {
      if (miner.stats) {
        totalHashrate += miner.stats.last_hash_rate;
        totalBlocks += miner.stats.blocks_mined;
        totalRewards += miner.stats.total_rewards;
      }
    }
    return { totalHashrate, totalBlocks, totalRewards };
  });

  const REFRESH_INTERVAL = 30_000;
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  $effect.pre(() => {
    if ($auth.isConnected && $auth.account?.owner) {
      initializeLaunchpadActor();
    } else {
      resetState();
    }
  });

  $effect(() => {
    if (launchpadActor) {
      fetchGlobalMinersList();
      fetchUserMinersList();
      fetchAvailableTokens();
    }
  });

  $effect(() => {
    userMiners.forEach((miner, index) => {
      const principalStr = miner.principal.toText();
      if (!minerInputs[principalStr]) {
         minerInputs[principalStr] = {
           chunkSize: miner.info?.chunk_size?.toString() ?? '',
           topUp: ''
         };
      } else {
        if (!minerInputs[principalStr].chunkSize && miner.info?.chunk_size) {
          minerInputs[principalStr].chunkSize = miner.info.chunk_size.toString();
        }

        if (minerInputs[principalStr].topUp === undefined) {
          (minerInputs[principalStr] as any).topUp = '';
        }
      }

      if (!miner.info && !miner.stats && !miner.isLoadingInfo && !miner.isLoadingStats && !miner.infoError && !miner.statsError) {
        fetchMinerDetails(miner.principal, index);
      }
    });
  });

  $effect(() => {
    if ($auth.isConnected && launchpadActor) {
      if (refreshIntervalId) clearInterval(refreshIntervalId);
      refreshIntervalId = setInterval(fetchUserMinersList, REFRESH_INTERVAL);
    } else if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
  });

  onDestroy(() => {
    if (refreshIntervalId) clearInterval(refreshIntervalId);
  });

  async function initializeLaunchpadActor() {
    if (!$auth.isConnected || !$auth.account?.owner) return;
    try {
      const actor = await auth.getActor(
        launchpadCanisterId,
        canisterIDLs.launchpad
      );
      launchpadActor = actor;
      console.log("Launchpad actor initialized");
      initializeLedgerActor();
    } catch (error) {
      console.error("Error initializing launchpad actor:", error);
      listError = "Failed to initialize launchpad connection.";
      toastStore.error(listError);
    }
  }

  async function initializeLedgerActor() {
    if (!$auth.isConnected) return;
    try {
      kongLedgerActor = await auth.getActor(
        KONG_LEDGER_CANISTER_ID,
        canisterIDLs.icrc2
      );
      await fetchKongFee();
    } catch (err) {
      console.error("Ledger actor init error", err);
      toastStore.error("Failed to init KONG ledger actor");
    }
  }

  async function fetchKongFee() {
    if (!kongLedgerActor) return;
    try {
      const feeRes = await kongLedgerActor.icrc1_fee();
      kongTransferFee = feeRes;
    } catch (e) {
      console.error("Fee fetch error", e);
      toastStore.error("Could not fetch KONG fee");
    }
  }

  async function fetchAvailableTokens() {
    if (!launchpadActor) return;
    isLoadingTokens = true;
    tokensError = null;
    console.log("Fetching available PoW tokens...");
    try {
      const result = await launchpadActor.list_tokens();
      console.log("Raw available tokens result:", result);
      if (Array.isArray(result)) {
        availableTokens = result;
      } else {
         console.error("Unexpected result format from list_tokens:", result);
         throw new Error("Received unexpected data format for token list.");
      }
    } catch (error: any) {
      console.error("Error fetching available tokens:", error);
      tokensError = `Failed to fetch token list: ${error.message || "Unknown error"}`;
      toastStore.error(tokensError);
      availableTokens = [];
    } finally {
      isLoadingTokens = false;
    }
  }

  async function fetchGlobalMinersList() {
    if (!launchpadActor) return;
    isLoadingGlobal = true;
    globalError = null;
    console.log("[DEBUG] Fetching global miners list...");
    try {
      const result = await launchpadActor.list_miners();
      console.log("[DEBUG] Global miners raw result:", result);
      if (Array.isArray(result)) {
        console.log("[DEBUG] Number of global miners:", result.length);
        globalMiners = result.map((item: any) => ({
          principal: item.canister_id,
          info: null,
          stats: null,
          remainingHashes: null,
          timeRemaining: null,
          infoError: null,
          statsError: null,
          isLoadingInfo: false,
          isLoadingStats: false,
          isYours: comparePrincipals(item.creator, $auth.account?.owner),
        }));
        
        // Fetch details for global miners
        globalMiners.forEach((miner, index) => {
          fetchGlobalMinerDetails(miner.principal, index);
        });
      } else throw new Error("Invalid global miners format");
    } catch (err: any) {
      globalError = err.message;
    } finally {
      isLoadingGlobal = false;
    }
  }

  async function fetchGlobalMinerDetails(principal: Principal, index: number) {
    try {
      const minerActor = await auth.getActor(
        principal.toText(),
        canisterIDLs.miner
      );

      try {
        const infoResult = await minerActor.get_info();
        if ('Ok' in infoResult) {
          globalMiners[index].info = infoResult.Ok;
        }
      } catch (infoError: any) {
        console.error(`Error fetching info for global miner ${principal.toText()}:`, infoError);
      }

      try {
        const statsResult = await minerActor.get_mining_stats();
        globalMiners[index].stats = statsResult;
        
        try {
          const timeEst = await minerActor.get_time_remaining_estimate();
          // Parse average rate from time estimate string and set last_hash_rate
          const avgMatch = timeEst.match(/avg\s+([\d.]+)\s+hashes\/s/i);
          if (avgMatch && globalMiners[index].stats) {
            globalMiners[index].stats.last_hash_rate = parseFloat(avgMatch[1]);
          }
        } catch (trErr: any) {
          console.error(`Error fetching time estimate for global miner ${principal.toText()}:`, trErr);
        }
      } catch (statsError: any) {
        console.error(`Error fetching stats for global miner ${principal.toText()}:`, statsError);
      }
    } catch (actorError: any) {
      console.error(`Error getting actor for global miner ${principal.toText()}:`, actorError);
    }
  }

  async function fetchUserMinersList() {
    if (!launchpadActor) return;
    isLoadingMinersList = true;
    listError = null;
    console.log("Fetching user miners list...");
    console.log("[DEBUG] Connected user principal:", getPrincipalText($auth.account?.owner));
    try {
      // call filtered if available
      const fetchFn = (launchpadActor as any).list_miners_filtered
        ? (launchpadActor as any).list_miners_filtered($auth.account.owner!)
        : launchpadActor.list_miners();
      const result = await fetchFn;
      console.log("[DEBUG] Raw miners list result:", result);
      if (Array.isArray(result)) {
        console.log("[DEBUG] Number of miners returned from backend:", result.length);
        userMiners = result.map((item: any) => ({
          principal: item.canister_id,
          info: null,
          stats: null,
          remainingHashes: null,
          timeRemaining: null,
          infoError: null,
          statsError: null,
          isLoadingInfo: false,
          isLoadingStats: false,
          isYours: comparePrincipals(item.creator, $auth.account.owner)
        }));
      } else throw new Error("Invalid user miners format");
    } catch (error: any) {
      console.error("Error fetching filtered miners, falling back:", error);
      // fallback: fetch all then client-side filter
      try {
        const all = await launchpadActor.list_miners();
        console.log("[DEBUG] All miners list:", all);
        
        // Get user principal in consistent format
        const userPrincipalText = getPrincipalText($auth.account.owner);
        console.log("[DEBUG] User principal for filtering:", userPrincipalText);
        
        // Log each miner's creator for comparison
        all.forEach((m: any) => {
          const creatorText = getPrincipalText(m.creator);
          console.log(`[DEBUG] Miner ${getPrincipalText(m.canister_id)} creator: ${creatorText}`);
          console.log(`[DEBUG] Principal comparison: ${creatorText} === ${userPrincipalText} ? ${comparePrincipals(m.creator, $auth.account.owner)}`);
        });
        
        // Add all miners to userMiners for now (debug mode)
        // This will help us see if miners exist but filtering is the issue
        userMiners = all
          .map((item: any) => ({
            principal: item.canister_id,
            info: null,
            stats: null,
            remainingHashes: null,
            timeRemaining: null,
            infoError: null,
            statsError: null,
            isLoadingInfo: false,
            isLoadingStats: false,
            isYours: comparePrincipals(item.creator, $auth.account.owner)
          }));
          
        console.log("[DEBUG] All miners added to userMiners for debugging:", userMiners);
        
        console.log("[DEBUG] Filtered user miners:", userMiners);
      } catch (e: any) {
        listError = e.message;
      }
    } finally {
      isLoadingMinersList = false;
    }
  }

  async function fetchMinerDetails(principal: Principal, index: number) {
    console.log(`Fetching details for miner ${index}: ${principal.toText()}`);
    userMiners[index].isLoadingInfo = true;
    userMiners[index].isLoadingStats = true;
    userMiners[index].infoError = null;
    userMiners[index].statsError = null;

    try {
      const minerActor = await auth.getActor(
        principal.toText(),
        canisterIDLs.miner
      );

      try {
        const infoResult = await minerActor.get_info();
        if ('Ok' in infoResult) {
          userMiners[index].info = infoResult.Ok;
        } else {
          throw new Error(infoResult.Err);
        }
      } catch (infoError: any) {
        console.error(`Error fetching info for miner ${principal.toText()}:`, infoError);
        userMiners[index].infoError = `Info fetch failed: ${infoError.message || "Unknown error"}`;
      } finally {
        userMiners[index].isLoadingInfo = false;
      }

      try {
        const statsResult = await minerActor.get_mining_stats();
        userMiners[index].stats = statsResult;
      } catch (statsError: any) {
        console.error(`Error fetching stats for miner ${principal.toText()}:`, statsError);
        userMiners[index].statsError = `Stats fetch failed: ${statsError.message || "Unknown error"}`;
      } finally {
        userMiners[index].isLoadingStats = false;
      }

      // New: remaining hashes and time estimate
      try {
        const remaining = await minerActor.get_remaining_hashes();
        userMiners[index].remainingHashes = remaining;
      } catch (rhErr: any) {
        console.error(`Error fetching remaining hashes for miner ${principal.toText()}:`, rhErr);
      }

      try {
        const timeEst = await minerActor.get_time_remaining_estimate();
        userMiners[index].timeRemaining = timeEst;
        // Parse average rate from time estimate string and set last_hash_rate
        const avgMatch = timeEst.match(/avg\s+([\d.]+)\s+hashes\/s/i);
        if (avgMatch && userMiners[index].stats) {
          userMiners[index].stats.last_hash_rate = parseFloat(avgMatch[1]);
        }
      } catch (trErr: any) {
        console.error(`Error fetching time estimate for miner ${principal.toText()}:`, trErr);
      }

    } catch (actorError: any) {
      console.error(`Error getting actor for miner ${principal.toText()}:`, actorError);
      const errorMsg = `Actor fetch failed: ${actorError.message || "Unknown error"}`;
      userMiners[index].infoError = errorMsg;
      userMiners[index].statsError = errorMsg;
      userMiners[index].isLoadingInfo = false;
      userMiners[index].isLoadingStats = false;
    }
  }

  async function handleMinerAction(
    action: 'start' | 'stop' | 'claim' | 'set_chunk' | 'connect_token' | 'disconnect_token' | 'top_up',
    principal: Principal,
    index: number,
    value?: any
  ) {
    const actionLabel = action.replace('_', ' ');
    const actionToastId = toastStore.info(`Processing ${actionLabel}...`, { duration: 0 });
    let successMessage = `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} successful!`;

    try {
      const minerActor = await auth.getActor(
        principal.toText(),
        canisterIDLs.miner
      );

      let result: { Ok?: any; Err?: string };

      switch (action) {
        case 'start':
          result = await minerActor.start_mining();
          break;
        case 'stop':
          result = await minerActor.stop_mining();
          break;
        case 'claim':
          result = await minerActor.claim_rewards();
          if (result && 'Ok' in result) {
             const blockIndex = result.Ok as bigint;
             successMessage = `Claim submitted! Block index: ${blockIndex}`;
          }
          break;
        // set_speed case removed as speed_percentage was removed from miner struct
        case 'set_chunk':
           const chunkSize = BigInt(value);
           if (chunkSize <= 0n) {
             throw new Error("Chunk size must be a positive number.");
           }
           result = await minerActor.set_chunk_size(chunkSize);
           break;
        case 'connect_token':
           if (!value || !(value instanceof Principal)) {
             throw new Error("Invalid token principal provided.");
           }
           result = await minerActor.connect_token(value);
           break;
        case 'disconnect_token':
           result = await minerActor.disconnect_token();
           break;
        case 'top_up':
          if (!kongLedgerActor) throw new Error('Ledger actor not initialized');
          if (!value) throw new Error('Amount required');
          if (kongTransferFee === 0n) await fetchKongFee();
          
          // Convert and approve KONG transfer
          const amountKong = parseFloat(String(value));
          if (isNaN(amountKong) || amountKong <= 0) throw new Error('Invalid amount');
          const amountBig = BigInt(Math.floor(amountKong * 10 ** 8));
          const approveAmount = amountBig + kongTransferFee;
          toastStore.info(`Approving ${(Number(approveAmount)/10**8).toFixed(2)} KONG...`);
          const approveArgs: ApproveArgs = {
            fee: [] as [],
            memo: [] as [],
            from_subaccount: [] as [],
            created_at_time: [] as [],
            amount: approveAmount,
            expected_allowance: [] as [],
            expires_at: [] as [],
            spender: { owner: Principal.fromText(launchpadCanisterId), subaccount: [] as [] },
          };
          const apprRes = await kongLedgerActor.icrc2_approve(approveArgs);
          if ('Err' in apprRes) throw new Error(`Approval failed: ${apprRes.Err}`);
          toastStore.success('KONG approved');

          if (!launchpadActor) throw new Error('Launchpad actor not initialized');
          // Call launchpad to top-up miner by principal
          result = await launchpadActor.top_up_miner(principal, amountBig);
          successMessage = 'Top-up via Launchpad successful!';
          break;
        default:
           throw new Error(`Unknown action: ${action}`);
      }

      if (result && 'Ok' in result) {
        toastStore.success(successMessage);
        fetchMinerDetails(principal, index);
      } else if (result && 'Err' in result) {
        throw new Error(result.Err);
      } else {
         throw new Error("Received unexpected or undefined result from miner action.");
      }

    } catch (error: any) {
      console.error(`Error performing ${actionLabel} on miner ${principal.toText()}:`, error);
      toastStore.error(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} failed: ${error.message || "Unknown error"}`);
    } finally {
      toastStore.dismiss(actionToastId);
    }
  }

   function openTokenModal(principal: Principal, index: number) {
     selectedMinerPrincipal = principal;
     selectedMinerIndex = index;
     isTokenModalOpen = true;
   }

   function handleTokenSelection(tokenPrincipal: Principal) {
     if (selectedMinerPrincipal && selectedMinerIndex !== -1) {
       handleMinerAction('connect_token', selectedMinerPrincipal, selectedMinerIndex, tokenPrincipal);
     }
     isTokenModalOpen = false;
   }

  function resetState() {
    launchpadActor = null;
    userMiners = [];
    isLoadingMinersList = true;
    listError = null;
    availableTokens = [];
    isLoadingTokens = false;
    tokensError = null;
  }

  function handleConnect() {
    walletProviderStore.open();
  }

  function formatRewards(amount: bigint | number | null | undefined): string {
    if (amount === null || amount === undefined) return '0.0000';
    const num = BigInt(amount);
    const decimals = 8;
    const integerPart = num / (10n ** BigInt(decimals));
    const fractionalPart = num % (10n ** BigInt(decimals));
    const fractionalString = fractionalPart.toString().padStart(decimals, '0').substring(0, 4);
    return `${integerPart}.${fractionalString}`;
  }

  function formatHashrate(rate: number | null | undefined): string {
    if (rate === null || rate === undefined) return '0 H/s';
    if (rate < 1000) {
      return `${rate.toFixed(2)} H/s`;
    } else if (rate < 1000000) {
      return `${(rate / 1000).toFixed(2)} KH/s`;
    } else if (rate < 1000000000) {
      return `${(rate / 1000000).toFixed(2)} MH/s`;
    } else {
      return `${(rate / 1000000000).toFixed(2)} GH/s`;
    }
  }

  // Format bigint with comma separators
  function formatBigInt(value: bigint | null | undefined): string {
    if (value === null || value === undefined) return 'N/A';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  // Helper function to safely get principal text regardless of format
  function getPrincipalText(principal: any): string {
    if (!principal) return '';
    if (typeof principal === 'string') return principal;
    if (typeof principal.toText === 'function') return principal.toText();
    // Handle raw principal object with _arr property (binary format)
    if (principal._arr && principal._isPrincipal) {
      try {
        return Principal.fromUint8Array(principal._arr).toText();
      } catch (e) {
        console.error('Error converting principal from binary:', e);
      }
    }
    return String(principal);
  }
  
  // Helper function to compare principals safely
  function comparePrincipals(p1: any, p2: any): boolean {
    if (!p1 || !p2) return false;
    const p1Text = getPrincipalText(p1);
    const p2Text = getPrincipalText(p2);
    return p1Text === p2Text;
  }

</script>

<div class="container mx-auto px-4 py-6">
  {#if !$auth.isConnected}
    <Panel>
      <p class="text-kong-text-secondary mb-4">Connect your wallet to view the mining dashboard.</p>
      <ButtonV2 label="Connect Wallet" onclick={handleConnect} theme="primary" />
    </Panel>
  {:else}
    <Panel>
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold mb-3 text-kong-text-primary">Global Stats</h2>
        <div class="flex items-center gap-2">
          <span class="text-sm text-kong-text-secondary">Show All Miners</span>
          <button 
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-kong-primary focus:ring-offset-2"
            class:bg-kong-primary={showAllMiners}
            class:bg-gray-500={!showAllMiners}
            onclick={() => showAllMiners = !showAllMiners}
          >
            <span 
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              class:translate-x-6={showAllMiners}
              class:translate-x-1={!showAllMiners}
            />
          </button>
        </div>
      </div>

      {#if isLoadingGlobal}
        <LoadingSpinner />
      {:else if globalError}
        <p class="text-red-500">Error loading global stats: {globalError}</p>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div class="bg-kong-bg-light p-4 rounded-lg">
            <p class="text-sm text-kong-text-secondary">Total Hashrate</p>
            <p class="text-lg font-medium text-kong-text-primary">{formatHashrate(globalStats().totalHashrate)}</p>
          </div>
          <div class="bg-kong-bg-light p-4 rounded-lg">
            <p class="text-sm text-kong-text-secondary">Total Blocks</p>
            <p class="text-lg font-medium text-kong-text-primary">{globalStats().totalBlocks.toString()}</p>
          </div>
          <div class="bg-kong-bg-light p-4 rounded-lg">
            <p class="text-sm text-kong-text-secondary">Total Rewards</p>
            <p class="text-lg font-medium text-kong-text-primary">{formatRewards(globalStats().totalRewards)}</p>
          </div>
          <div class="bg-kong-bg-light p-4 rounded-lg">
            <p class="text-sm text-kong-text-secondary">Total Miners</p>
            <p class="text-lg font-medium text-kong-text-primary">{globalStats().totalMiners}</p>
          </div>
          <div class="bg-kong-bg-light p-4 rounded-lg">
            <p class="text-sm text-kong-text-secondary">Active Miners</p>
            <p class="text-lg font-medium text-kong-text-primary">{globalStats().activeMiners}</p>
          </div>
        </div>

        <div class="mt-6">
          <h3 class="text-lg font-medium mb-3 text-kong-text-primary">{showAllMiners ? 'All Miners' : 'Your Miners'}</h3>
          
          {#if showAllMiners}
            <!-- ALL MINERS LIST VIEW -->
            <div class="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {#each userMiners as miner}
                <div class="flex items-center bg-kong-bg-light rounded-lg px-4 py-3 shadow hover:bg-kong-bg-secondary transition">
                  <div class="flex-1">
                    <div class="font-mono text-xs text-kong-text-secondary">
                      {getPrincipalText(miner.principal).substring(0, 5)}...{getPrincipalText(miner.principal).slice(-3)}
                    </div>
                    <div class="text-sm text-kong-text-primary">
                      Owner: {miner.isYours ? 'You' : 'Other'}
                    </div>
                  </div>
                  <div class="flex-1 text-xs">
                    <span class={miner.info?.is_mining ? 'text-green-500' : 'text-yellow-500'}>
                      {miner.info ? (miner.info.is_mining ? 'Mining' : 'Stopped') : 'Unknown'}
                    </span>
                  </div>
                  <div class="flex-1 text-xs">{miner.stats ? formatHashrate(miner.stats.last_hash_rate) : 'N/A'}</div>
                  <div class="flex-1 text-xs">{miner.stats ? miner.stats.blocks_mined.toString() : 'N/A'}</div>
                  <div class="flex-1 text-xs">{miner.stats ? formatRewards(miner.stats.total_rewards) : 'N/A'}</div>
                  <div class="flex-1 text-xs">{formatBigInt(miner.remainingHashes)}</div>
                  <div class="flex-1 text-xs">{miner.timeRemaining ?? 'N/A'}</div>
                  {#if miner.isYours}
                    <div class="ml-2">
                      <span class="inline-block w-2 h-2 rounded-full bg-green-500" title="Your Miner"></span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <!-- MY MINERS ROW VIEW -->
            <div class="flex flex-col gap-3">
              {#each userMiners.filter(m => m.isYours) as miner, index}
                <Panel class="p-0 overflow-hidden flex flex-col border border-kong-primary">
                  <!-- Header with Miner Info -->
                  <div class="bg-kong-bg-secondary border-b border-kong-border px-4 py-3 flex items-center">
                    <div class="flex items-center space-x-2 w-48">
                      <span class="inline-block w-2 h-2 rounded-full" 
                            class:bg-green-500={miner.info?.is_mining} 
                            class:bg-yellow-500={!miner.info?.is_mining}></span>
                      <span class="font-mono text-xs text-kong-text-secondary">
                        {getPrincipalText(miner.principal).substring(0, 5)}...{getPrincipalText(miner.principal).slice(-3)}
                      </span>
                      <span class="ml-2 text-sm font-medium" class:text-green-500={miner.info?.is_mining} class:text-yellow-500={!miner.info?.is_mining}>
                        {miner.info ? (miner.info.is_mining ? 'Mining' : 'Stopped') : 'Unknown'}
                      </span>
                    </div>
                    
                    <div class="flex items-center space-x-8 flex-1">
                      <div>
                        <div class="text-xs text-kong-text-secondary">Hashrate</div>
                        <div class="text-sm font-medium text-kong-text-primary">{miner.stats ? formatHashrate(miner.stats.last_hash_rate) : 'N/A'}</div>
                      </div>
                      <div>
                        <div class="text-xs text-kong-text-secondary">Rewards</div>
                        <div class="text-sm font-medium text-kong-text-primary">{miner.stats ? formatRewards(miner.stats.total_rewards) : 'N/A'}</div>
                      </div>
                      <div class="flex-1">
                        <div class="flex justify-between items-center mb-1">
                          <span class="text-xs text-kong-text-secondary">Remaining</span>
                          <span class="text-xs text-kong-text-primary">{formatBigInt(miner.remainingHashes)}</span>
                        </div>
                        <div class="w-full bg-kong-bg-secondary rounded-full h-2 mb-1">
                          {#if miner.remainingHashes && miner.info?.chunk_size}
                            <div class="bg-kong-primary h-2 rounded-full" 
                                style="width: {Math.min(100, 100 - Number(miner.remainingHashes) / Number(miner.info.chunk_size || 10000) * 100)}%"></div>
                          {:else}
                            <div class="bg-kong-primary h-2 rounded-full" style="width: 0%"></div>
                          {/if}
                        </div>
                        <div class="text-xs text-kong-text-secondary">
                          {miner.timeRemaining ?? 'ETA unavailable'}
                        </div>
                      </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex gap-2 ml-4">
                      {#if miner.info}
                        <button 
                          class="px-3 py-2 text-xs rounded-md flex items-center justify-center text-white"
                          class:bg-red-500={miner.info.is_mining}
                          class:bg-green-500={!miner.info.is_mining}
                          class:hover:bg-red-600={miner.info.is_mining}
                          class:hover:bg-green-600={!miner.info.is_mining}
                          onclick={() => handleMinerAction(miner.info?.is_mining ? 'stop' : 'start', miner.principal, index)}
                        >
                          {#if miner.info.is_mining}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                            </svg>
                          {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          {/if}
                          {miner.info.is_mining ? 'Stop' : 'Start'}
                        </button>
                      {/if}
                      <button 
                        class="px-3 py-2 text-xs rounded-md bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white"
                        onclick={() => handleMinerAction('claim', miner.principal, index)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Claim
                      </button>
                      <button 
                        class="px-3 py-2 text-xs rounded-md bg-purple-500 hover:bg-purple-600 flex items-center justify-center text-white"
                        onclick={() => openTokenModal(miner.principal, index)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Token
                      </button>
                    </div>
                  </div>
                  
                  <!-- Controls Section -->
                  <div class="p-4 bg-kong-bg-dark border-t border-kong-border flex flex-wrap md:flex-nowrap gap-4">
                    <!-- Speed Control removed as speed_percentage was removed from miner struct -->
                    
                    <!-- Chunk Size Control -->
                    <div class="flex items-center gap-2 flex-1 min-w-[250px]">
                      <div class="w-20 text-xs text-kong-text-secondary shrink-0">Chunk</div>
                      <div class="flex-1 flex items-center gap-2">
                        <select
                          class="w-32 px-2 py-1 text-xs bg-kong-bg-light border border-kong-border rounded text-kong-text-primary"
                          value={minerInputs[getPrincipalText(miner.principal)]?.chunkSize}
                          oninput={(e:any) => minerInputs[getPrincipalText(miner.principal)].chunkSize = e.target.value}
                        >
                          <option value="1000">1,000</option>
                          <option value="5000">5,000</option>
                          <option value="10000">10,000</option>
                          <option value="50000">50,000</option>
                          <option value="100000">100,000</option>
                          <option value="250000">250,000</option>
                        </select>
                        <button class="px-2 py-1 text-xs rounded bg-kong-primary hover:bg-kong-primary/90 text-white"
                          onclick={() => handleMinerAction('set_chunk', miner.principal, index, minerInputs[getPrincipalText(miner.principal)].chunkSize)}>
                          Set
                        </button>
                      </div>
                    </div>
                    
                    <!-- Top-Up Control -->
                    <div class="flex items-center gap-2 flex-1 min-w-[250px]">
                      <div class="w-20 text-xs text-kong-text-secondary shrink-0">Top-Up</div>
                      <div class="flex-1 flex items-center gap-2">
                        <input type="number" min="0" step="0.01"
                          class="w-24 px-2 py-1 text-xs bg-kong-bg-light border border-kong-border rounded text-kong-text-primary"
                          value={minerInputs[getPrincipalText(miner.principal)]?.topUp}
                          oninput={(e:any) => minerInputs[getPrincipalText(miner.principal)].topUp = e.target.value}
                          placeholder="KONG amount"
                        />
                        <button 
                          class="flex-1 px-4 py-2 text-xs font-bold rounded bg-gradient-to-r from-kong-primary to-kong-primary/80 hover:from-kong-primary/90 hover:to-kong-primary/70 text-white shadow border border-kong-primary flex items-center justify-center"
                          onclick={() => handleMinerAction('top_up', miner.principal, index, minerInputs[getPrincipalText(miner.principal)].topUp)}
                        >
                          <svg xmlns='http://www.w3.org/2000/svg' class='w-4 h-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
                          </svg>
                          Top-Up
                        </button>
                      </div>
                    </div>
                  </div>
                </Panel>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </Panel>
  {/if}
</div>

<Modal isOpen={isTokenModalOpen} onclose={() => isTokenModalOpen = false} title="Select PoW Token">
  {#if isLoadingTokens}
    <LoadingSpinner />
  {:else if tokensError}
    <p class="text-red-500">{tokensError}</p>
  {:else if availableTokens.length === 0}
    <p class="text-kong-text-secondary">No PoW tokens found on the launchpad.</p>
  {:else}
    <div class="space-y-2 max-h-60 overflow-y-auto">
      {#each availableTokens as token (getPrincipalText(token.canister_id))}
        <button
          class="w-full text-left p-2 rounded hover:bg-kong-bg-secondary focus:outline-none focus:ring-1 focus:ring-kong-primary"
          onclick={() => handleTokenSelection(token.canister_id)}
        >
          <p class="font-medium">{token.name} ({token.ticker})</p>
          <p class="text-xs text-kong-text-secondary truncate">{getPrincipalText(token.canister_id)}</p>
        </button>
      {/each}
    </div>
  {/if}
</Modal>




<style>
  .input {
     @apply block w-full px-3 py-1.5 text-base font-normal text-kong-text-primary bg-kong-bg-light bg-clip-padding border border-solid border-kong-border rounded transition ease-in-out m-0 focus:text-kong-text-primary focus:bg-kong-bg-dark focus:border-kong-primary focus:outline-none;
  }
  .input-sm {
      @apply py-1 text-sm;
  }
  .input-bordered {
      @apply border border-kong-border;
  }
</style>
