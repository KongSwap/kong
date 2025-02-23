<script lang="ts">
  import { isConnected, backendActor, formatICP } from '$lib/stores/wallet';
  import { onMount } from 'svelte';
  import { Principal } from '@dfinity/principal';
  import { auth, getSubAccountBalance, send_icp, type ICPRecipient } from '$lib/services/auth';

  interface TokenInfo {
    name: string;
    ticker: string;
    total_supply: number;
    ledger_id: Principal | null;
  }

  let tokenBackends: [Principal, TokenInfo][] = [];
  let minersList: [Principal, Principal][] = [];
  let isLoading = true;
  let selectedMiner: Principal | null = null;
  let showMinerDetails = false;
  let selectedMinerDetails: any = null;
  
  // Demo balances
  let kongBalance = 25000;
  let totalPortfolioValue = 156789;
  
  // Demo token balances
  let tokenBalances = [
    { name: "Quantum Token", ticker: "QNTM", balance: 50000, value: 25000 },
    { name: "Neural Network", ticker: "NNET", balance: 75000, value: 37500 },
    { name: "Cyber Credit", ticker: "CCRD", balance: 100000, value: 50000 }
  ];

  // Demo miner data
  let minerData = [
    {
      id: "abc-123",
      tokenBackend: "xyz-789",
      status: "ACTIVE",
      hashRate: "125 H/s",
      uptime: "99.8%",
      rewards: "1250 KONG/day",
      currentToken: "QNTM",
      kongStaked: 500,
      lifetimeRewards: 25000,
      efficiency: "98.5%",
      lastReward: "5 mins ago",
      nextReward: "~55 mins"
    },
    {
      id: "def-456", 
      tokenBackend: "uvw-012",
      status: "MAINTENANCE",
      hashRate: "0 H/s",
      uptime: "45.2%", 
      rewards: "0 KONG/day",
      currentToken: "NNET",
      kongStaked: 200,
      lifetimeRewards: 12000,
      efficiency: "45.2%",
      lastReward: "2 days ago",
      nextReward: "N/A"
    }
  ];

  // Available tokens for mining
  const availableTokens = [
    { name: "Quantum Token", ticker: "QNTM", apy: "12.5%" },
    { name: "Neural Network", ticker: "NNET", apy: "15.2%" },
    { name: "Cyber Credit", ticker: "CCRD", apy: "10.8%" },
    { name: "Digital Gold", ticker: "DGLD", apy: "8.5%" }
  ];

  let protocolIcpBalance = 0n;
  let transferAmount = '';
  let recipientPrincipal = '';
  let transferError = '';
  let transferSuccess = '';
  let isTransferring = false;

  async function loadBalances() {
    if ($isConnected && $auth.account?.owner) {
      try {
        const balance = await getSubAccountBalance($auth.account.owner);
        console.log('Raw balance before setting:', balance.toString());
        
        protocolIcpBalance = balance;
        console.log('Protocol balance after setting:', protocolIcpBalance.toString());
        console.log('Formatted ICP balance:', formatICP(protocolIcpBalance));
        
      } catch (error) {
        console.error('Error fetching ICP balance:', error);
      }
    }
  }

  async function handleTransfer() {
    if (!transferAmount || !recipientPrincipal) {
      transferError = 'Please enter amount and recipient';
      return;
    }

    try {
      isTransferring = true;
      transferError = '';
      transferSuccess = '';

      // Convert amount to e8s (1 ICP = 100000000 e8s)
      const amountE8s = BigInt(Math.floor(Number(transferAmount) * 100000000));
      
      let recipient: ICPRecipient;
      try {
        recipient = {
          Principal: Principal.fromText(recipientPrincipal)
        };
      } catch (e) {
        // If not a valid principal, try as account ID
        recipient = {
          AccountId: recipientPrincipal
        };
      }

      const result = await send_icp(recipient, amountE8s);
      transferSuccess = `Transfer successful! Block index: ${result}`;
      
      // Reload balances
      await loadBalances();
      
      // Clear form
      transferAmount = '';
      recipientPrincipal = '';
    } catch (error: any) {
      transferError = `Transfer failed: ${error.message || error}`;
    } finally {
      isTransferring = false;
    }
  }

  onMount(async () => {
    if ($isConnected && $backendActor) {
      try {
        // tokenBackends = await $backendActor.list_token_backends();
        // minersList = await $backendActor.list_miners();
        await loadBalances();
      } catch (error) {
        console.error('Error fetching portfolio data:', error);
      } finally {
        isLoading = false;
      }
    }
  });

  function openMinerDetails(miner: any) {
    selectedMinerDetails = miner;
    showMinerDetails = true;
  }

  function closeMinerDetails() {
    showMinerDetails = false;
    selectedMinerDetails = null;
  }

  function handleMinerAction(action: string, minerId: string) {
    if (action === 'CONFIG') {
      const miner = minerData.find(m => m.id === minerId);
      if (miner) {
        openMinerDetails(miner);
      }
    } else {
      console.log(`${action} for miner ${minerId}`);
      alert(`${action} - Coming Soon!`);
    }
  }

  let topupAmount = 0;
  let selectedNewToken = '';
  let processingAction = false;

  async function handleTopup() {
    processingAction = true;
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert(`Topped up ${topupAmount} KONG`);
    processingAction = false;
  }

  async function handleTokenChange() {
    processingAction = true;
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert(`Changed mining token to ${selectedNewToken}`);
    processingAction = false;
  }
</script>

<div class="space-y-6">
  <div class="mb-6 text-xs text-cyan-400">┌─── PORTFOLIO_OVERVIEW ───┐</div>

  <!-- Portfolio Overview -->
  <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
    <div class="p-6 transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
      <h4 class="text-sm text-cyan-400/80">TOTAL_PORTFOLIO_VALUE</h4>
      <p class="mt-2 font-mono text-3xl text-cyan-300">
        ${totalPortfolioValue.toLocaleString()}
      </p>
    </div>
    
    <div class="p-6 transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
      <h4 class="text-sm text-cyan-400/80">KONG_BALANCE</h4>
      <p class="mt-2 font-mono text-3xl text-cyan-300">
        {kongBalance.toLocaleString()} KONG
      </p>
    </div>

    <div class="p-6 transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
      <h4 class="text-sm text-cyan-400/80">ACTIVE_MINERS</h4>
      <p class="mt-2 font-mono text-3xl text-cyan-300">
        {minersList.length}
      </p>
    </div>
  </div>

  <div class="mt-6 mb-6 text-xs text-cyan-400">┌─── ICP_BALANCES ───┐</div>

  <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    <!-- Protocol Balance -->
    <div class="p-6 transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
      <div class="flex items-center justify-between">
        <h4 class="text-sm text-cyan-400/80">PROTOCOL_ICP_BALANCE</h4>
        <button 
          on:click={loadBalances}
          class="px-3 py-1 text-xs transition-colors border rounded-sm text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20"
        >
          REFRESH
        </button>
      </div>
      <p class="mt-2 font-mono text-3xl text-cyan-300">
        {formatICP(protocolIcpBalance)} ICP
      </p>
      <p class="mt-2 text-sm text-cyan-400/60">
        These are your ICP funds held in the protocol
      </p>
    </div>

    <!-- Transfer Section -->
    <div class="p-6 transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
      <h4 class="mb-4 text-sm text-cyan-400/80">TRANSFER_ICP</h4>
      
      <div class="space-y-4">
        <div>
          <input
            type="number"
            bind:value={transferAmount}
            placeholder="Amount in ICP"
            class="w-full px-4 py-2 bg-black border rounded-md border-cyan-500/30 text-cyan-300 focus:border-cyan-400 focus:outline-none"
          />
        </div>
        
        <div>
          <input
            type="text"
            bind:value={recipientPrincipal}
            placeholder="Recipient Principal ID or Account ID"
            class="w-full px-4 py-2 bg-black border rounded-md border-cyan-500/30 text-cyan-300 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {#if transferError}
          <p class="text-sm text-red-400">{transferError}</p>
        {/if}

        {#if transferSuccess}
          <p class="text-sm text-emerald-400">{transferSuccess}</p>
        {/if}

        <button
          on:click={handleTransfer}
          disabled={isTransferring}
          class="w-full px-4 py-2 font-bold transition-colors border rounded-md text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTransferring ? 'PROCESSING...' : 'TRANSFER_ICP'}
        </button>
      </div>
    </div>
  </div>

  <div class="mt-6 mb-6 text-xs text-cyan-400">┌─── TOKEN_HOLDINGS ───┐</div>

  <!-- Token Holdings -->
  <div class="transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
    <div class="p-6">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left border-b border-cyan-500/40">
              <th class="p-3 text-cyan-400">TOKEN_ID</th>
              <th class="p-3 text-cyan-400">BALANCE</th>
              <th class="p-3 text-cyan-400">VALUE</th>
            </tr>
          </thead>
          <tbody>
            {#each tokenBalances as token}
              <tr class="transition-colors border-b border-cyan-500/30 hover:bg-cyan-500/5">
                <td class="p-3">
                  <div>
                    <div class="text-cyan-300">{token.name}</div>
                    <div class="text-sm text-cyan-400/70">{token.ticker}</div>
                  </div>
                </td>
                <td class="p-3 font-mono text-cyan-300">{token.balance.toLocaleString()}</td>
                <td class="p-3 font-mono text-cyan-300">${token.value.toLocaleString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="mt-6 mb-6 text-xs text-cyan-400">┌─── MINER_MANAGEMENT ───┐</div>

  <!-- Miner Management -->
  <div class="transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
    <div class="p-6">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left border-b border-cyan-500/40">
              <th class="p-3 text-cyan-400">MINER_ID</th>
              <th class="p-3 text-cyan-400">STATUS</th>
              <th class="p-3 text-cyan-400">HASH_RATE</th>
              <th class="p-3 text-cyan-400">UPTIME</th>
              <th class="p-3 text-cyan-400">REWARDS</th>
              <th class="p-3 text-cyan-400">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {#each minerData as miner}
              <tr 
                class="transition-colors border-b cursor-pointer border-cyan-500/30 hover:bg-cyan-500/5" 
                on:click={() => openMinerDetails(miner)}
              >
                <td class="p-3 font-mono text-cyan-300">{miner.id}</td>
                <td class="p-3">
                  <span class="px-2 py-1 text-xs font-mono rounded-sm {miner.status === 'ACTIVE' ? 'text-emerald-300 bg-emerald-500/20' : 'text-red-300 bg-red-500/20'}">
                    {miner.status}
                  </span>
                </td>
                <td class="p-3 font-mono text-cyan-300">{miner.hashRate}</td>
                <td class="p-3 font-mono text-cyan-300">{miner.uptime}</td>
                <td class="p-3 font-mono text-cyan-300">{miner.rewards}</td>
                <td class="p-3">
                  <div class="flex gap-2">
                    <button 
                      class="px-3 py-1 font-mono text-xs transition-colors border rounded-sm text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20 hover:border-cyan-500/60"
                      on:click|stopPropagation={() => handleMinerAction('STOP', miner.id)}>
                      STOP
                    </button>
                    <button 
                      class="px-3 py-1 font-mono text-xs transition-colors border rounded-sm text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20 hover:border-cyan-500/60"
                      on:click|stopPropagation={() => handleMinerAction('CONFIG', miner.id)}>
                      CONFIG
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="mt-6 mb-6 text-xs text-cyan-400">┌─── MINING_POOLS ───┐</div>

  <!-- Pools Section -->
  <div class="p-6 text-center transition-colors border rounded-sm border-cyan-500/40 bg-black/95 hover:border-cyan-500/60">
    <p class="text-cyan-400/80">FEATURE_STATUS: DEVELOPMENT_IN_PROGRESS</p>
    <p class="mt-2 text-cyan-300">Join mining pools to maximize your rewards.</p>
    <button class="px-6 py-2 mt-4 font-mono text-xs transition-colors border rounded-sm opacity-50 cursor-not-allowed text-cyan-300 border-cyan-500/40">
      INITIALIZE_POOLS
    </button>
  </div>

  <div class="mb-6 text-xs text-cyan-400">└────────────────────────┘</div>
</div>

<!-- Miner Details Modal -->
{#if showMinerDetails && selectedMinerDetails}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
    <div class="w-full max-w-3xl p-6 mx-4 space-y-6 border rounded-lg border-cyan-500/40 bg-black/95">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-cyan-300">MINER_DETAILS</h2>
        <button 
          class="p-2 transition-colors rounded-full hover:bg-cyan-500/20"
          on:click={closeMinerDetails}
        >
          <span class="text-cyan-400">✕</span>
        </button>
      </div>

      <!-- Miner Stats -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div class="p-4 border rounded-md border-cyan-500/30">
          <div class="text-sm text-cyan-400">STATUS</div>
          <div class="mt-1 text-lg text-cyan-300">{selectedMinerDetails.status}</div>
        </div>
        <div class="p-4 border rounded-md border-cyan-500/30">
          <div class="text-sm text-cyan-400">CURRENT_TOKEN</div>
          <div class="mt-1 text-lg text-cyan-300">{selectedMinerDetails.currentToken}</div>
        </div>
        <div class="p-4 border rounded-md border-cyan-500/30">
          <div class="text-sm text-cyan-400">KONG_STAKED</div>
          <div class="mt-1 text-lg text-cyan-300">{selectedMinerDetails.kongStaked} KONG</div>
        </div>
        <div class="p-4 border rounded-md border-cyan-500/30">
          <div class="text-sm text-cyan-400">LIFETIME_REWARDS</div>
          <div class="mt-1 text-lg text-cyan-300">{selectedMinerDetails.lifetimeRewards} KONG</div>
        </div>
        <div class="p-4 border rounded-md border-cyan-500/30">
          <div class="text-sm text-cyan-400">EFFICIENCY</div>
          <div class="mt-1 text-lg text-cyan-300">{selectedMinerDetails.efficiency}</div>
        </div>
        <div class="p-4 border rounded-md border-cyan-500/30">
          <div class="text-sm text-cyan-400">NEXT_REWARD</div>
          <div class="mt-1 text-lg text-cyan-300">{selectedMinerDetails.nextReward}</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Top-up KONG -->
        <div class="p-4 border rounded-md border-cyan-500/30">
          <h3 class="mb-4 text-lg font-bold text-cyan-300">TOP_UP_KONG</h3>
          <div class="space-y-4">
            <input 
              type="number" 
              bind:value={topupAmount}
              placeholder="Enter KONG amount"
              class="w-full px-4 py-2 bg-black border rounded-md border-cyan-500/30 text-cyan-300 focus:border-cyan-400 focus:outline-none"
            />
            <button 
              on:click={handleTopup}
              disabled={processingAction}
              class="w-full px-4 py-2 font-bold transition-colors border rounded-md text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20"
            >
              {processingAction ? 'PROCESSING...' : 'CONFIRM_TOPUP'}
            </button>
          </div>
        </div>

        <!-- Change Token -->
        <div class="p-4 border rounded-md border-cyan-500/30">
          <h3 class="mb-4 text-lg font-bold text-cyan-300">CHANGE_TOKEN</h3>
          <div class="space-y-4">
            <select 
              bind:value={selectedNewToken}
              class="w-full px-4 py-2 bg-black border rounded-md border-cyan-500/30 text-cyan-300 focus:border-cyan-400 focus:outline-none"
            >
              <option value="">Select Token</option>
              {#each availableTokens as token}
                <option value={token.ticker}>
                  {token.name} ({token.ticker}) - APY: {token.apy}
                </option>
              {/each}
            </select>
            <button 
              on:click={handleTokenChange}
              disabled={processingAction || !selectedNewToken}
              class="w-full px-4 py-2 font-bold transition-colors border rounded-md text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20"
            >
              {processingAction ? 'PROCESSING...' : 'CHANGE_TOKEN'}
            </button>
          </div>
        </div>
      </div>

      <!-- Performance Chart Placeholder -->
      <div class="p-4 border rounded-md border-cyan-500/30">
        <h3 class="mb-4 text-lg font-bold text-cyan-300">PERFORMANCE_METRICS</h3>
        <div class="h-48 text-center">
          <p class="pt-20 text-cyan-400/70">Interactive performance charts coming soon</p>
        </div>
      </div>
    </div>
  </div>
{/if}
