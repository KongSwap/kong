<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { canisters } from '$lib/config/auth.config';
  import type { CanisterType } from '$lib/config/auth.config';
  import { createAnonymousActorHelper } from '$lib/utils/actorUtils';
  import { Principal } from '@dfinity/principal';
  import PageWrapper from '$lib/components/layout/PageWrapper.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import LoadingIndicator from '$lib/components/common/LoadingIndicator.svelte';
  import { IcrcService } from '$lib/services/icrc/IcrcService';
  import { userTokens } from '$lib/stores/userTokens';
  import { get } from 'svelte/store';
  
  type SwapMode = 'SOL_TO_ICP' | 'ICP_TO_SOL' | 'SOL_TO_SPL';
  
  let isConnected = false;
  let loading = false;
  let solanaAddress = '';
  let userPrincipal = '';
  let userSolanaAddress = '';
  let currentWallet = '';
  
  // Swap mode
  let swapMode: SwapMode = 'SOL_TO_ICP';
  
  // Swap form fields
  let payToken = 'SOL';
  let payAmount = '';
  let receiveToken = 'ICP';
  let receiveAmount = '';
  let maxSlippage = '99.0';
  
  // Progress tracking
  let progress = {
    step: '',
    message: '',
    status: 'idle' as 'idle' | 'pending' | 'success' | 'error'
  };
  
  // Job polling
  let jobId: bigint | null = null;
  let isPolling = false;
  
  // Token decimals mapping
  const TOKEN_DECIMALS: Record<string, number> = {
    'SOL': 9,
    'ICP': 8,
    'SOL.SOL': 9,
    'SOL.USDC': 6,
    'SOL.USDT': 6,
    'CUSTOM': 9
  };
  
  onMount(async () => {
    const authClient = await auth.pnp.getAuthClient();
    isConnected = authClient.isAuthenticated();
    
    if (isConnected) {
      const principal = await authClient.getIdentity();
      userPrincipal = principal.getPrincipal().toString();
      currentWallet = auth.pnp.adapter?.id || '';
      
      // Check if connected with Phantom
      if (currentWallet === 'phantomSiws' || currentWallet === 'phantom') {
        try {
          const adapter = auth.pnp.adapter;
          userSolanaAddress = await adapter.getSolanaAddress();
        } catch (e) {
          console.error('Failed to get Solana address:', e);
        }
      }
    }
    
    getSolanaAddress();
    updateTokensForMode();
  });
  
  $: if (swapMode) {
    updateTokensForMode();
  }
  
  function updateTokensForMode() {
    switch (swapMode) {
      case 'SOL_TO_ICP':
        payToken = 'SOL';
        receiveToken = 'ICP';
        maxSlippage = '99.0';
        break;
      case 'ICP_TO_SOL':
        payToken = 'ICP';
        receiveToken = 'SOL';
        maxSlippage = '99.0';
        break;
      case 'SOL_TO_SPL':
        payToken = 'SOL.SOL';
        receiveToken = 'SOL.USDC';
        maxSlippage = '0.5';
        break;
    }
    payAmount = '';
    receiveAmount = '';
  }
  
  async function getActor() {
    if (isConnected) {
      return auth.pnp.getActor<CanisterType['KONG_SOLANA_BACKEND']>({
        canisterId: canisters.kongSolanaBackend.canisterId!,
        idl: canisters.kongSolanaBackend.idl,
        anon: false,
        requiresSigning: false,
      });
    } else {
      return createAnonymousActorHelper(
        canisters.kongSolanaBackend.canisterId!,
        canisters.kongSolanaBackend.idl
      );
    }
  }
  
  async function getSolanaAddress() {
    try {
      const actor = await getActor();
      const response = await actor.get_solana_address();
      
      if ('Ok' in response) {
        solanaAddress = response.Ok;
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  function getTokenDecimals(token: string): number {
    return TOKEN_DECIMALS[token] || 9;
  }
  
  function convertToAtomicUnits(amount: string, token: string): bigint {
    const decimals = getTokenDecimals(token);
    const multiplier = Math.pow(10, decimals);
    return BigInt(Math.floor(parseFloat(amount) * multiplier));
  }
  
  function updateProgress(step: string, message: string, status: 'pending' | 'success' | 'error') {
    progress = { step, message, status };
  }
  
  async function sendSolWithPhantom() {
    if (!userSolanaAddress || currentWallet !== 'phantomSiws') {
      throw new Error('Phantom wallet not connected');
    }
    
    const adapter = auth.pnp.adapter;
    if (!adapter.sendSol) {
      throw new Error('Phantom adapter does not support sending SOL');
    }
    
    // Send SOL to Kong's Solana address
    const txSignature = await adapter.sendSol(solanaAddress, parseFloat(payAmount));
    return txSignature;
  }
  
  // Create canonical message for signing
  function createCanonicalMessage(params: any): string {
    // Sort keys alphabetically for canonical ordering
    const sortedKeys = Object.keys(params).sort();
    const orderedParams: any = {};
    
    for (const key of sortedKeys) {
      orderedParams[key] = params[key];
    }
    
    return JSON.stringify(orderedParams);
  }
  
  async function executeSwap() {
    if (!payAmount || !payToken || !receiveToken) {
      updateProgress('validation', 'Please fill in all required fields', 'error');
      return;
    }
    
    if (swapMode === 'SOL_TO_ICP' && !userPrincipal) {
      updateProgress('validation', 'Please connect your wallet to get your IC Principal', 'error');
      return;
    }
    
    if (swapMode === 'ICP_TO_SOL' && !userSolanaAddress) {
      updateProgress('validation', 'Please enter your Solana address', 'error');
      return;
    }
    
    loading = true;
    updateProgress('start', 'Initializing swap...', 'pending');
    jobId = null;
    
    try {
      let payTxId = null;
      let signature = null;
      
      // Handle SOL transfer with Phantom if needed
      if (swapMode === 'SOL_TO_ICP') {
        updateProgress('transfer', 'Sending SOL with Phantom wallet...', 'pending');
        
        if (currentWallet === 'phantomSiws' || currentWallet === 'phantom') {
          try {
            const txSig = await sendSolWithPhantom();
            payTxId = txSig;
            updateProgress('transfer', `SOL sent! TX: ${txSig.slice(0, 8)}...`, 'success');
          } catch (e) {
            // Fallback to manual transfer
            updateProgress('transfer', 'Please manually send SOL to Kong address', 'error');
            throw new Error('Manual SOL transfer required: ' + e.message);
          }
        } else {
          updateProgress('transfer', 'Manual SOL transfer required', 'error');
          throw new Error('Please send SOL manually to: ' + solanaAddress);
        }
        
        // Create canonical message for signing
        const messageParams = {
          max_slippage: parseFloat(maxSlippage),
          pay_address: userSolanaAddress,
          pay_amount: convertToAtomicUnits(payAmount, payToken).toString(),
          pay_token: payToken,
          receive_address: userPrincipal,
          receive_amount: receiveAmount ? convertToAtomicUnits(receiveAmount, receiveToken).toString() : null,
          receive_token: receiveToken,
          referred_by: null,
          timestamp: BigInt(Date.now()).toString()
        };
        
        const message = createCanonicalMessage(messageParams);
        
        // Sign message with Phantom
        if (auth.pnp.adapter?.signMessage) {
          updateProgress('signing', 'Signing message with Phantom...', 'pending');
          signature = await auth.pnp.adapter.signMessage(message);
          updateProgress('signing', 'Message signed!', 'success');
        }
      }
      
      // Handle ICP approval if needed
      if (swapMode === 'ICP_TO_SOL') {
        updateProgress('approval', 'Checking ICP allowance...', 'pending');
        const tokenState = get(userTokens);
        const icpToken = tokenState.tokens.find(t => t.symbol === 'ICP');
        if (icpToken) {
          const payAmountAtomic = convertToAtomicUnits(payAmount, 'ICP');
          await IcrcService.checkAndRequestIcrc2Allowances(
            icpToken,
            payAmountAtomic,
            canisters.kongSolanaBackend.canisterId
          );
          updateProgress('approval', 'ICP approved!', 'success');
        }
      }
      
      updateProgress('swap', 'Calling swap canister...', 'pending');
      const actor = await getActor();
      const payAmountAtomic = convertToAtomicUnits(payAmount, payToken);
      const receiveAmountAtomic = receiveAmount ? convertToAtomicUnits(receiveAmount, receiveToken) : null;
      
      const payAddress = swapMode === 'ICP_TO_SOL' ? userPrincipal : userSolanaAddress;
      const receiveAddress = swapMode === 'SOL_TO_ICP' ? userPrincipal : userSolanaAddress;
      
      const timestamp = BigInt(Date.now());
      
      const swapArgs = {
        pay_token: payToken,
        pay_amount: payAmountAtomic,
        pay_address: payAddress ? [payAddress] : [],
        pay_tx_id: payTxId ? [{ TransactionHash: payTxId }] : [],
        receive_token: receiveToken,
        receive_amount: receiveAmountAtomic ? [receiveAmountAtomic] : [],
        receive_address: receiveAddress ? [receiveAddress] : [],
        max_slippage: [parseFloat(maxSlippage)],
        referred_by: [],
        timestamp: [timestamp],
        signature: signature ? [signature] : []
      };
      
      const response = await actor.swap(swapArgs);
      
      if ('Ok' in response) {
        if (response.Ok.job_id && response.Ok.job_id.length > 0) {
          jobId = response.Ok.job_id[0];
          updateProgress('queued', `Swap queued! Job ID: ${jobId}`, 'success');
          
          if (swapMode === 'ICP_TO_SOL') {
            await startJobPolling();
          }
        } else {
          updateProgress('complete', 'Swap completed successfully!', 'success');
        }
      } else {
        updateProgress('error', `Swap failed: ${response.Err}`, 'error');
      }
      
    } catch (error) {
      console.error('Error:', error);
      updateProgress('error', `Error: ${error}`, 'error');
    } finally {
      if (!isPolling) {
        loading = false;
      }
    }
  }
  
  async function startJobPolling() {
    if (!jobId) return;
    
    isPolling = true;
    const maxAttempts = 30;
    const pollInterval = 2000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      updateProgress('polling', `Checking swap status... (${attempt + 1}/${maxAttempts})`, 'pending');
      
      try {
        const actor = await getActor();
        const jobStatus = await actor.get_swap_job(jobId);
        
        if (jobStatus && jobStatus.length > 0) {
          const job = jobStatus[0];
          
          if ('Confirmed' in job.status || 'Submitted' in job.status) {
            updateProgress('complete', 'Swap confirmed!', 'success');
            if (job.solana_tx_signature_of_payout && job.solana_tx_signature_of_payout.length > 0) {
              const sig = job.solana_tx_signature_of_payout[0];
              updateProgress('complete', `Swap complete! TX: ${sig.slice(0, 8)}...${sig.slice(-8)}`, 'success');
            }
            break;
          } else if ('Failed' in job.status) {
            updateProgress('error', 'Swap failed!', 'error');
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Polling error:', error);
      }
    }
    
    isPolling = false;
    loading = false;
  }
</script>

<svelte:head>
  <title>Swap V2 - KongSwap</title>
  <meta name="description" content="Cross-chain swaps between Solana and Internet Computer" />
</svelte:head>

<PageWrapper page="/swap-v2-demo">
  <div class="max-w-lg mx-auto px-4 py-8">
    <Panel variant="solid" roundness="rounded-2xl" class="relative">
      <div class="space-y-6">
        <!-- Header with Mode Selector -->
        <div>
          <h1 class="text-2xl font-bold mb-4">Cross-Chain Swap</h1>
          
          <!-- Mode Pills -->
          <div class="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              on:click={() => swapMode = 'SOL_TO_ICP'}
              class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                {swapMode === 'SOL_TO_ICP' 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
            >
              SOL → ICP
            </button>
            <button
              on:click={() => swapMode = 'ICP_TO_SOL'}
              class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                {swapMode === 'ICP_TO_SOL' 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
            >
              ICP → SOL
            </button>
            <button
              on:click={() => swapMode = 'SOL_TO_SPL'}
              class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                {swapMode === 'SOL_TO_SPL' 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
            >
              SOL → SPL
            </button>
          </div>
        </div>
        
        <!-- Wallet Status -->
        {#if isConnected}
          <div class="text-xs text-gray-500 dark:text-gray-400">
            Connected: {currentWallet === 'phantomSiws' ? 'Phantom' : currentWallet}
            {#if userSolanaAddress}
              <br/>SOL: {userSolanaAddress.slice(0, 4)}...{userSolanaAddress.slice(-4)}
            {/if}
          </div>
        {/if}
        
        <!-- Solana Address Input (for ICP->SOL) -->
        {#if swapMode === 'ICP_TO_SOL' && !userSolanaAddress}
          <div>
            <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Your Solana Address
            </label>
            <input
              type="text"
              bind:value={userSolanaAddress}
              placeholder="Enter Solana wallet address"
              class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        {/if}
        
        <!-- Pay Amount -->
        <div>
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            You Pay
          </label>
          <div class="relative">
            <input
              type="number"
              bind:value={payAmount}
              placeholder="0.00"
              step="0.000001"
              class="w-full px-4 py-3 pr-16 text-xl rounded-xl border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 font-medium">
              {payToken.includes('.') ? payToken.split('.')[1] : payToken}
            </div>
          </div>
        </div>
        
        <!-- Receive Amount -->
        <div>
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            You Receive (estimated)
          </label>
          <div class="relative">
            <input
              type="number"
              bind:value={receiveAmount}
              placeholder="0.00"
              step="0.000001"
              class="w-full px-4 py-3 pr-16 text-xl rounded-xl border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 font-medium">
              {receiveToken.includes('.') ? receiveToken.split('.')[1] : receiveToken}
            </div>
          </div>
        </div>
        
        <!-- Slippage -->
        <div class="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <span class="text-sm text-gray-600 dark:text-gray-400">Max Slippage</span>
          <div class="flex items-center gap-2">
            <input
              type="number"
              bind:value={maxSlippage}
              step="0.1"
              class="w-20 px-3 py-1 text-sm text-center bg-white dark:bg-gray-700 
                rounded-lg border border-gray-300 dark:border-gray-600
                focus:ring-2 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-500">%</span>
          </div>
        </div>
        
        <!-- Progress Status -->
        {#if progress.status !== 'idle'}
          <div class="p-4 rounded-xl border-2 transition-all duration-300
            {progress.status === 'pending' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}
            {progress.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}
            {progress.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}">
            <div class="flex items-start gap-3">
              {#if progress.status === 'pending'}
                <LoadingIndicator size="sm" />
              {:else if progress.status === 'success'}
                <svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              {:else if progress.status === 'error'}
                <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              {/if}
              
              <div class="flex-1">
                <p class="font-medium text-sm
                  {progress.status === 'pending' ? 'text-blue-800 dark:text-blue-300' : ''}
                  {progress.status === 'success' ? 'text-green-800 dark:text-green-300' : ''}
                  {progress.status === 'error' ? 'text-red-800 dark:text-red-300' : ''}">
                  {progress.step.charAt(0).toUpperCase() + progress.step.slice(1)}
                </p>
                <p class="text-sm mt-1
                  {progress.status === 'pending' ? 'text-blue-700 dark:text-blue-400' : ''}
                  {progress.status === 'success' ? 'text-green-700 dark:text-green-400' : ''}
                  {progress.status === 'error' ? 'text-red-700 dark:text-red-400' : ''}">
                  {progress.message}
                </p>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Swap Button -->
        <Button
          variant="primary"
          size="lg"
          class="w-full"
          disabled={loading || !payAmount}
          on:click={executeSwap}
        >
          {#if loading}
            <LoadingIndicator size="sm" class="mr-2" />
            Processing...
          {:else}
            Swap Now
          {/if}
        </Button>
        
        <!-- Info -->
        <div class="text-xs text-center text-gray-500 dark:text-gray-400">
          {#if swapMode === 'SOL_TO_ICP'}
            {currentWallet === 'phantomSiws' ? 'SOL will be sent via Phantom' : 'Manual SOL transfer required'}
          {:else if swapMode === 'ICP_TO_SOL'}
            ICP approval will be requested
          {:else}
            Direct SPL token swap on Solana
          {/if}
        </div>
      </div>
    </Panel>
  </div>
</PageWrapper>