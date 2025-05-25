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
  import { SolanaService } from '$lib/services/solana/SolanaService';
  import { userTokens } from '$lib/stores/userTokens';
  import { get } from 'svelte/store';
  
  type SwapMode = 'SOL_TO_ICP' | 'ICP_TO_SOL' | 'SOL_TO_SPL';
  
  let isConnected = false;
  let loading = false;
  let solanaAddress = '';
  let userPrincipal = '';
  let userSolanaAddress = '';
  let currentWallet = '';
  let solanaCapabilities = { canSendSol: false, canSignMessage: false, canGetAddress: false, walletType: null };
  let manualTransferInstructions: any = null;
  
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
  
  // Watch for auth changes
  $effect(() => {
    console.log('🔍 SwapV2: Auth effect triggered');
    console.log('🔍 SwapV2: Auth state:', $auth);
    console.log('🔍 SwapV2: Auth account:', $auth?.account);
    console.log('🔍 SwapV2: Auth isConnected:', $auth?.isConnected);
    
    isConnected = $auth?.isConnected || false;
    console.log('🔍 SwapV2: Updated isConnected:', isConnected);
    
    if (isConnected && $auth?.account?.owner) {
      console.log('✅ SwapV2: User is connected, getting details...');
      
      // Get user principal from auth store
      userPrincipal = $auth.account.owner.toString();
      console.log('✅ SwapV2: User principal from auth store:', userPrincipal);
      
      // Get wallet info and debug adapter details
      currentWallet = auth.pnp.adapter?.id || '';
      console.log('🔍 SwapV2: Current wallet:', currentWallet);
      console.log('🔍 SwapV2: Full auth.pnp object:', auth.pnp);
      console.log('🔍 SwapV2: Auth adapter:', auth.pnp.adapter);
      console.log('🔍 SwapV2: Adapter methods:', auth.pnp.adapter ? Object.keys(auth.pnp.adapter) : 'No adapter');
      console.log('🔍 SwapV2: Is Phantom?', currentWallet.includes('phantom'));
      
      // Check for Solana-specific methods
      if (auth.pnp.adapter) {
        console.log('🔍 SwapV2: getSolanaAddress method exists?', typeof auth.pnp.adapter.getSolanaAddress);
        console.log('🔍 SwapV2: sendSol method exists?', typeof auth.pnp.adapter.sendSol);
        console.log('🔍 SwapV2: signMessage method exists?', typeof auth.pnp.adapter.signMessage);
        
        // Check nested adapter
        const nestedAdapter = auth.pnp.adapter.adapter;
        console.log('🔍 SwapV2: Nested adapter:', nestedAdapter);
        if (nestedAdapter) {
          console.log('🔍 SwapV2: Nested getSolanaAddress method exists?', typeof nestedAdapter.getSolanaAddress);
          console.log('🔍 SwapV2: Nested sendSol method exists?', typeof nestedAdapter.sendSol);
          console.log('🔍 SwapV2: Nested signMessage method exists?', typeof nestedAdapter.signMessage);
        }
      }
      
      // Get Solana capabilities and user address
      console.log('🔍 SwapV2: Getting Solana capabilities...');
      solanaCapabilities = SolanaService.getSolanaCapabilities();
      console.log('✅ SwapV2: Solana capabilities:', solanaCapabilities);
      
      if (solanaCapabilities.canGetAddress) {
        console.log('🔍 SwapV2: Attempting to get user Solana address...');
        SolanaService.getUserSolanaAddress().then(address => {
          userSolanaAddress = address || '';
          console.log('✅ SwapV2: User Solana address:', userSolanaAddress);
        }).catch(e => {
          console.error('❌ SwapV2: Failed to get Solana address:', e);
        });
      } else {
        console.log('⚠️ SwapV2: Wallet cannot get Solana address');
        console.log('🔍 SwapV2: Capabilities breakdown:', {
          hasAdapter: !!auth.pnp.adapter,
          adapterId: auth.pnp.adapter?.id,
          hasSolanaMethod: !!auth.pnp.adapter?.getSolanaAddress
        });
      }
    } else {
      console.log('⚠️ SwapV2: User not connected');
      userPrincipal = '';
      userSolanaAddress = '';
      currentWallet = '';
    }
  });

  onMount(async () => {
    console.log('🚀 SwapV2: Starting onMount');
    
    try {
      console.log('🔍 SwapV2: Getting Kong Solana address...');
      await getSolanaAddress();
      
      console.log('🔍 SwapV2: Updating tokens for mode...');
      updateTokensForMode();
      
      console.log('✅ SwapV2: onMount completed successfully');
    } catch (error) {
      console.error('❌ SwapV2: Error in onMount:', error);
      updateProgress('error', `Initialization error: ${error.message}`, 'error');
    }
  });
  
  // Watch for swap mode changes
  $effect(() => {
    console.log('🔍 SwapV2: Swap mode changed to:', swapMode);
    updateTokensForMode();
  });
  
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
        maxSlippage = '99.0';
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
    console.log('🔍 SwapV2: Getting Kong Solana address...');
    try {
      solanaAddress = await SolanaService.getKongSolanaAddress();
      console.log('✅ SwapV2: Kong Solana address:', solanaAddress);
    } catch (error) {
      console.error('❌ SwapV2: Error getting Kong Solana address:', error);
      updateProgress('error', 'Failed to get Kong Solana address', 'error');
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
  
  async function sendSolWithWallet() {
    if (!solanaCapabilities.canSendSol) {
      throw new Error('Connected wallet does not support sending SOL');
    }
    
    if (!userSolanaAddress) {
      throw new Error('User Solana address not available');
    }
    
    // Send SOL to Kong's Solana address
    const txSignature = await SolanaService.sendSolWithPhantom(solanaAddress, parseFloat(payAmount));
    return txSignature;
  }
  
  function showManualTransferInstructions() {
    manualTransferInstructions = SolanaService.createManualTransferInstructions(
      solanaAddress,
      parseFloat(payAmount)
    );
  }
  
  function hideManualTransferInstructions() {
    manualTransferInstructions = null;
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
      
      // Handle SOL transfer if needed
      if (swapMode === 'SOL_TO_ICP') {
        if (solanaCapabilities.canSendSol) {
          updateProgress('transfer', `Sending SOL with ${solanaCapabilities.walletType}...`, 'pending');
          try {
            const txSig = await sendSolWithWallet();
            payTxId = txSig;
            updateProgress('transfer', `SOL sent! TX: ${txSig.slice(0, 8)}...`, 'success');
          } catch (e) {
            // Fallback to manual transfer
            updateProgress('transfer', 'Automatic transfer failed - manual transfer required', 'error');
            showManualTransferInstructions();
            throw new Error('Manual SOL transfer required: ' + e.message);
          }
        } else {
          updateProgress('transfer', 'Manual SOL transfer required', 'error');
          showManualTransferInstructions();
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
        
        const message = SolanaService.createCanonicalMessage(messageParams);
        
        // Sign message with connected Solana wallet
        if (solanaCapabilities.canSignMessage) {
          updateProgress('signing', `Signing message with ${solanaCapabilities.walletType}...`, 'pending');
          try {
            signature = await SolanaService.signMessage(message);
            updateProgress('signing', 'Message signed!', 'success');
          } catch (e) {
            console.warn('Message signing failed:', e);
            updateProgress('signing', 'Message signing failed - continuing without signature', 'error');
          }
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
          
          <!-- Test Send SOL Button -->
          {#if swapMode === 'SOL_TO_ICP' && isConnected}
            <button
              on:click={async () => {
                console.log('🧪 TEST SEND: Attempting to trigger Solana transfer...');
                
                try {
                  // Try different ways to access Solana wallet
                  if (window.phantom?.solana) {
                    console.log('🧪 TEST SEND: Found window.phantom.solana');
                    console.log('🧪 TEST SEND: Phantom methods:', Object.keys(window.phantom.solana));
                    
                    if (window.phantom.solana.publicKey) {
                      console.log('🧪 TEST SEND: Phantom address:', window.phantom.solana.publicKey.toString());
                      userSolanaAddress = window.phantom.solana.publicKey.toString();
                    }
                  }
                  
                  if (window.solflare) {
                    console.log('🧪 TEST SEND: Found window.solflare');
                    console.log('🧪 TEST SEND: Solflare methods:', Object.keys(window.solflare));
                    
                    if (window.solflare.publicKey) {
                      console.log('🧪 TEST SEND: Solflare address:', window.solflare.publicKey.toString());
                      userSolanaAddress = window.solflare.publicKey.toString();
                    }
                  }
                  
                  if (window.solana) {
                    console.log('🧪 TEST SEND: Found window.solana');
                    console.log('🧪 TEST SEND: Solana methods:', Object.keys(window.solana));
                    
                    if (window.solana.publicKey) {
                      console.log('🧪 TEST SEND: Generic Solana address:', window.solana.publicKey.toString());
                      userSolanaAddress = window.solana.publicKey.toString();
                    }
                  }
                  
                  // Try to open a Solana transfer URL
                  const transferUrl = `https://phantom.app/ul/browse/https://solscan.io/account/${solanaAddress}?cluster=mainnet-beta`;
                  console.log('🧪 TEST SEND: Opening transfer URL:', transferUrl);
                  window.open(transferUrl, '_blank');
                  
                } catch (error) {
                  console.error('🧪 TEST SEND: Error:', error);
                }
              }}
              class="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              🧪 Test Send SOL
            </button>
          {/if}
        </div>
        
        <!-- Wallet Status -->
        {#if isConnected}
          <div class="text-xs text-gray-500 dark:text-gray-400">
            Connected: {solanaCapabilities.walletType || currentWallet}
            {#if userSolanaAddress}
              <br/>SOL: {userSolanaAddress.slice(0, 4)}...{userSolanaAddress.slice(-4)}
            {:else}
              <br/>No Solana address detected
            {/if}
            {#if solanaCapabilities.canSendSol}
              <br/>✓ Can send SOL automatically
            {:else}
              <br/>❌ Cannot send SOL automatically
            {/if}
            
            <!-- Debug buttons for testing -->
            <br/>
            <button 
              on:click={async () => {
                console.log('🧪 MANUAL TEST: Testing Solana address fetch...');
                console.log('🧪 MANUAL TEST: Current adapter:', auth.pnp.adapter);
                console.log('🧪 MANUAL TEST: Adapter properties:', auth.pnp.adapter ? Object.getOwnPropertyNames(auth.pnp.adapter) : 'No adapter');
                console.log('🧪 MANUAL TEST: Adapter prototype:', auth.pnp.adapter ? Object.getPrototypeOf(auth.pnp.adapter) : 'No adapter');
                
                if (auth.pnp.adapter) {
                  // Test direct method calls
                  console.log('🧪 MANUAL TEST: Direct getSolanaAddress:', auth.pnp.adapter.getSolanaAddress);
                  if (typeof auth.pnp.adapter.getSolanaAddress === 'function') {
                    try {
                      const directResult = await auth.pnp.adapter.getSolanaAddress();
                      console.log('🧪 MANUAL TEST: Direct call result:', directResult);
                      userSolanaAddress = directResult || '';
                    } catch (e) {
                      console.error('🧪 MANUAL TEST: Direct call error:', e);
                    }
                  }
                }
                
                try {
                  const address = await SolanaService.getUserSolanaAddress();
                  console.log('🧪 MANUAL TEST: Service result:', address);
                  userSolanaAddress = address || '';
                } catch (e) {
                  console.error('🧪 MANUAL TEST: Service error:', e);
                }
              }}
              class="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              🧪 Test Solana Address
            </button>
            
            <button 
              on:click={() => {
                console.log('🧪 ADAPTER DUMP:');
                console.log('- adapter:', auth.pnp.adapter);
                console.log('- adapter id:', auth.pnp.adapter?.id);
                console.log('- all adapter properties:', auth.pnp.adapter ? Object.keys(auth.pnp.adapter) : 'none');
                console.log('- all adapter methods:', auth.pnp.adapter ? Object.getOwnPropertyNames(auth.pnp.adapter).filter(name => typeof auth.pnp.adapter[name] === 'function') : 'none');
              }}
              class="text-xs text-green-500 hover:text-green-700 underline ml-2"
            >
              🔍 Dump Adapter
            </button>
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
        
        <!-- Manual Transfer Instructions -->
        {#if manualTransferInstructions}
          <div class="p-6 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
            <div class="flex items-start justify-between mb-4">
              <h3 class="font-semibold text-orange-800 dark:text-orange-300">{manualTransferInstructions.title}</h3>
              <button 
                on:click={hideManualTransferInstructions}
                class="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="space-y-3">
              {#each manualTransferInstructions.instructions as instruction}
                <p class="text-sm text-orange-700 dark:text-orange-400">{instruction}</p>
              {/each}
              
              <div class="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">Send to address:</p>
                <code class="text-sm font-mono break-all text-gray-900 dark:text-gray-100">{manualTransferInstructions.address}</code>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">Amount: {manualTransferInstructions.amount} SOL</p>
              </div>
              
              <button
                on:click={() => navigator.clipboard.writeText(manualTransferInstructions.address)}
                class="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200"
              >
                📋 Copy address to clipboard
              </button>
            </div>
          </div>
        {/if}
        
        <!-- Swap Button -->
        <button
          class="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 
            {loading || !payAmount 
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]'}"
          disabled={loading || !payAmount}
          on:click={executeSwap}
        >
          <div class="flex items-center justify-center gap-3">
            {#if loading}
              <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Processing Swap...</span>
            {:else}
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Swap {payToken === 'SOL.SOL' ? 'SOL' : payToken} → {receiveToken === 'SOL.SOL' ? 'SOL' : receiveToken}</span>
            {/if}
          </div>
        </button>
        
        <!-- Info -->
        <div class="text-xs text-center text-gray-500 dark:text-gray-400">
          {#if swapMode === 'SOL_TO_ICP'}
            {#if solanaCapabilities.canSendSol}
              SOL will be sent automatically via {solanaCapabilities.walletType}
            {:else}
              Manual SOL transfer required to Kong address: {solanaAddress.slice(0, 8)}...
            {/if}
          {:else if swapMode === 'ICP_TO_SOL'}
            ICP approval will be requested, SOL sent to your address
          {:else}
            Direct SPL token swap on Solana network
          {/if}
        </div>
      </div>
    </Panel>
  </div>
</PageWrapper>