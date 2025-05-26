<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { canisters } from '$lib/config/auth.config';
  import type { CanisterType } from '$lib/config/auth.config';
  import { createAnonymousActorHelper } from '$lib/utils/actorUtils';
  import { Principal } from '@dfinity/principal';
  import LoadingIndicator from '$lib/components/common/LoadingIndicator.svelte';
  import { IcrcService } from '$lib/services/icrc/IcrcService';
  import { SolanaService } from '$lib/services/solana/SolanaService';
  import { userTokens } from '$lib/stores/userTokens';
  import { get } from 'svelte/store';
  
  type SwapMode = 'SOL_TO_ICP' | 'ICP_TO_SOL' | 'SOL_TO_SPL';
  
  let isConnected = $state(false);
  let loading = $state(false);
  let solanaAddress = $state(''); // Will be fetched from canister
  let userPrincipal = $state('');
  let userSolanaAddress = $state('');
  let currentWallet = $state('');
  let solanaCapabilities = $state({ canSendSol: false, canSignMessage: false, canGetAddress: false, walletType: null });
  let manualTransferInstructions: any = $state(null);
  
  // Swap mode
  let swapMode: SwapMode = $state('SOL_TO_ICP');
  
  // Swap form fields
  let payToken = $state('SOL');
  let payAmount = $state('');
  let receiveToken = $state('ICP');
  let receiveAmount = $state('');
  let maxSlippage = $state('99.0');
  
  // Progress tracking
  let progress = $state({
    step: '',
    message: '',
    status: 'idle' as 'idle' | 'pending' | 'success' | 'error'
  });
  
  // Job polling
  let jobId: bigint | null = $state(null);
  let isPolling = $state(false);
  
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
    isConnected = $auth?.isConnected || false;
    
    if (isConnected && $auth?.account?.owner) {
      // Get user principal from auth store
      userPrincipal = $auth.account.owner.toString();
      
      // Get wallet info
      currentWallet = auth.pnp.adapter?.id || '';
      
      // Get Solana capabilities
      solanaCapabilities = SolanaService.getSolanaCapabilities();
      
      // Only try to get address if wallet supports it and is already connected
      if (solanaCapabilities.canGetAddress) {
        // Use a non-reactive way to get the address
        const getSolanaAddressOnce = async () => {
          try {
            const address = await SolanaService.getUserSolanaAddress();
            if (address && address !== userSolanaAddress) {
              userSolanaAddress = address;
            }
          } catch (e) {
            console.error('Failed to get Solana address:', e);
          }
        };
        
        getSolanaAddressOnce();
      }
    } else {
      userPrincipal = '';
      userSolanaAddress = '';
      currentWallet = '';
    }
  });

  onMount(async () => {
    try {
      updateTokensForMode();
      
      // Fetch Kong's Solana address from canister
      updateProgress('init', 'Fetching Kong Solana address...', 'pending');
      try {
        solanaAddress = await SolanaService.getKongSolanaAddress();
        console.log('🔗 Fetched Kong Solana address from canister:', solanaAddress);
        updateProgress('init', 'Kong Solana address loaded', 'success');
      } catch (error) {
        console.error('Failed to fetch Kong Solana address:', error);
        updateProgress('init', `Failed to fetch Kong address: ${error.message}`, 'error');
        // Don't fail completely, but show the error
      }
    } catch (error) {
      console.error('Initialization error:', error);
      updateProgress('error', `Initialization error: ${error.message}`, 'error');
    }
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
    const txSignature = await SolanaService.sendSolWithWallet(solanaAddress, parseFloat(payAmount));
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
      let timestamp = Date.now(); // timestamp for message signing
      
      // Handle SOL transfer if needed
      if (swapMode === 'SOL_TO_ICP') {
        if (solanaCapabilities.canSendSol) {
          updateProgress('transfer', `Sending SOL with ${solanaCapabilities.walletType}...`, 'pending');
          try {
            const txSig = await sendSolWithWallet();
            payTxId = txSig;
            updateProgress('transfer', `SOL sent! TX: ${txSig.slice(0, 8)}...`, 'success');
          } catch (e) {
            // Check if this is a wallet connection issue
            const adapter = auth.pnp.adapter;
            const hasWalletAdapter = adapter?.id?.includes('phantom') || adapter?.id?.includes('solflare');
            
            if (hasWalletAdapter) {
              // Wallet was connected but transfer failed - likely connection issue
              updateProgress('transfer', 'Wallet connection lost - please reconnect', 'error');
              throw new Error('Lost connection to wallet. Please refresh the page and reconnect your Phantom/Solflare wallet.');
            } else {
              // Fallback to manual transfer for non-wallet users
              updateProgress('transfer', 'Automatic transfer failed - manual transfer required', 'error');
              showManualTransferInstructions();
              throw new Error('Manual SOL transfer required: ' + e.message);
            }
          }
        } else {
          // Check if user has a wallet adapter but can't send SOL (connection issue)
          const adapter = auth.pnp.adapter;
          const hasWalletAdapter = adapter?.id?.includes('phantom') || adapter?.id?.includes('solflare');
          
          if (hasWalletAdapter) {
            // User has wallet but can't send - connection issue
            updateProgress('transfer', 'Wallet connection lost', 'error');
            throw new Error('Lost connection to your wallet. Please refresh the page and reconnect your Phantom/Solflare wallet to continue.');
          } else {
            // No compatible wallet - show manual instructions
            updateProgress('transfer', 'Manual SOL transfer required', 'error');
            showManualTransferInstructions();
            throw new Error('Please send SOL manually to: ' + solanaAddress);
          }
        }
        
        // Create canonical message for signing - EXACT format as shell script  
        // Use the timestamp we declared above 
        const payAmountNat = convertToAtomicUnits(payAmount, payToken);
        
        // IMPORTANT: Shell script always calculates receive_amount, never null
        // Default to a reasonable conversion if user didn't specify
        const defaultReceiveAmount = receiveAmount || (parseFloat(payAmount) * 0.5).toString(); // 0.5 rate as in shell script
        const receiveAmountNat = convertToAtomicUnits(defaultReceiveAmount, receiveToken);
        
        const messageParams = {
          pay_token: payToken,
          pay_amount: parseInt(payAmountNat.toString()), // Parse as integer like shell script
          pay_address: userSolanaAddress,
          receive_token: receiveToken,
          receive_amount: parseInt(receiveAmountNat.toString()), // Always a number, never null
          receive_address: userPrincipal,
          max_slippage: parseFloat(maxSlippage), // Keep as float like shell script (99.0)
          timestamp: parseInt(timestamp.toString()), // Parse as integer
          referred_by: null
        };
        
        const message = SolanaService.createCanonicalMessage(messageParams);
        
        // Sign message with connected Solana wallet using the proven working method
        if (solanaCapabilities.canSignMessage) {
          updateProgress('signing', `Signing message with ${solanaCapabilities.walletType}...`, 'pending');
          try {
            // Use the raw message signing method (METHOD 2) - proven to work
            signature = await SolanaService.signMessageRaw(message);
            updateProgress('signing', 'Message signed successfully!', 'success');
            
            // Call swap with signed message
            updateProgress('swap', 'Submitting signed swap...', 'pending');
            const actor = await getActor();
            const payAmountAtomic = convertToAtomicUnits(payAmount, payToken);
            const receiveAmountAtomic = receiveAmount ? convertToAtomicUnits(receiveAmount, receiveToken) : null;
            
            const payAddress = swapMode === 'ICP_TO_SOL' ? userPrincipal : userSolanaAddress;
            const receiveAddress = swapMode === 'SOL_TO_ICP' ? userPrincipal : userSolanaAddress;
            
            const canisterTimestamp = BigInt(timestamp);
            
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
              timestamp: [canisterTimestamp],
              signature: [signature]
            };
            
            const response = await actor.swap(swapArgs);
            
            if ('Ok' in response) {
              updateProgress('success', 'Swap successful!', 'success');
              
              if (response.Ok.job_id && response.Ok.job_id.length > 0) {
                jobId = response.Ok.job_id[0];
                updateProgress('queued', `Swap queued! Job ID: ${jobId}`, 'success');
                
                // Only poll for ICP → SOL swaps (which use job queue)
                // SOL → ICP swaps complete immediately
                if (swapMode === 'ICP_TO_SOL') {
                  await startJobPolling();
                }
              } else {
                // SOL → ICP swaps complete immediately without job queue
                updateProgress('complete', 'Swap completed successfully!', 'success');
              }
            } else {
              updateProgress('error', `Swap failed: ${response.Err}`, 'error');
            }
            
          } catch (e) {
            console.error('Message signing failed:', e);
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
        
        // For ICP_TO_SOL, call swap directly since no signature needed
        updateProgress('swap', 'Calling swap canister...', 'pending');
        const actor = await getActor();
        const payAmountAtomic = convertToAtomicUnits(payAmount, payToken);
        const receiveAmountAtomic = receiveAmount ? convertToAtomicUnits(receiveAmount, receiveToken) : null;
        
        const payAddress = userPrincipal;
        const receiveAddress = userSolanaAddress;
        
        const canisterTimestamp = BigInt(Date.now());
        
        const swapArgs = {
          pay_token: payToken,
          pay_amount: payAmountAtomic,
          pay_address: payAddress ? [payAddress] : [],
          pay_tx_id: [],
          receive_token: receiveToken,
          receive_amount: receiveAmountAtomic ? [receiveAmountAtomic] : [],
          receive_address: receiveAddress ? [receiveAddress] : [],
          max_slippage: [parseFloat(maxSlippage)],
          referred_by: [],
          timestamp: [canisterTimestamp],
          signature: []
        };
        
        const response = await actor.swap(swapArgs);
        
        if ('Ok' in response) {
          if (response.Ok.job_id && response.Ok.job_id.length > 0) {
            jobId = response.Ok.job_id[0];
            updateProgress('queued', `Swap queued! Job ID: ${jobId}`, 'success');
            
            // Start fake progress steps for better UX (ICP → SOL takes ~20 seconds)
            await simulateSwapProgress();
            await startJobPolling();
          } else {
            updateProgress('complete', 'Swap completed successfully!', 'success');
          }
        } else {
          updateProgress('error', `Swap failed: ${response.Err}`, 'error');
        }
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
  
  // Job polling state for cool UI
  let pollAttempt = $state(0);
  let maxPollAttempts = $state(25); // 25 seconds max
  let jobDetails = $state(null);
  let pollingStartTime = $state(0);
  
  // Simulate realistic progress steps for ICP → SOL swaps
  async function simulateSwapProgress() {
    // Step 1: Verifying ICP payment (5 seconds)
    updateProgress('step1', '🔍 Canister verifying ICP payment...', 'pending');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 2: Processing signatures (3 seconds) 
    updateProgress('step2', '✍️ Verifying transaction signatures...', 'pending');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Preparing Solana payout (7 seconds)
    updateProgress('step3', '💰 Preparing SOL payout to your wallet...', 'pending');
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    // Step 4: Ready for real polling
    updateProgress('ready', '🚀 Broadcasting to Solana network...', 'pending');
  }
  
  async function startJobPolling() {
    if (!jobId) return;
    
    isPolling = true;
    pollAttempt = 0;
    maxPollAttempts = 25; // 25 seconds for 15-20 second swaps
    pollingStartTime = Date.now();
    const pollInterval = 1000; // 1 second intervals
    
    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      pollAttempt = attempt + 1;
      const elapsedSeconds = Math.floor((Date.now() - pollingStartTime) / 1000);
      
      updateProgress('polling', `Processing swap... ${elapsedSeconds}s elapsed`, 'pending');
      
      try {
        const actor = await getActor();
        const jobStatus = await actor.get_swap_job(jobId);
        
        if (jobStatus && jobStatus.length > 0) {
          const job = jobStatus[0];
          jobDetails = job;
          
          // Parse detailed job status
          const statusKey = Object.keys(job.status)[0];
          const statusValue = job.status[statusKey];
          
          if (statusKey === 'Confirmed') {
            updateProgress('complete', 'Swap confirmed on blockchain!', 'success');
            if (job.solana_tx_signature_of_payout && job.solana_tx_signature_of_payout.length > 0) {
              const sig = job.solana_tx_signature_of_payout[0];
              updateProgress('complete', `Swap complete! TX: ${sig.slice(0, 8)}...${sig.slice(-8)}`, 'success');
            }
            break;
          } else if (statusKey === 'Submitted') {
            updateProgress('submitted', `Transaction submitted to network (${elapsedSeconds}s)`, 'pending');
          } else if (statusKey === 'Processing') {
            updateProgress('processing', `Processing transaction... (${elapsedSeconds}s)`, 'pending');
          } else if (statusKey === 'Failed') {
            const errorMsg = statusValue || 'Unknown error';
            updateProgress('failed', `Swap failed: ${errorMsg}`, 'error');
            break;
          } else if (statusKey === 'Pending') {
            updateProgress('pending', `Queued for processing... (${elapsedSeconds}s)`, 'pending');
          } else {
            updateProgress('polling', `Status: ${statusKey} (${elapsedSeconds}s)`, 'pending');
          }
        } else {
          updateProgress('not-found', 'Job not found in queue', 'error');
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Polling error:', error);
        updateProgress('poll-error', `Poll error: ${error.message}`, 'error');
        break;
      }
    }
    
    // Timeout handling
    if (pollAttempt >= maxPollAttempts) {
      updateProgress('timeout', 'Swap is taking longer than expected, but may still complete', 'error');
    }
    
    isPolling = false;
    loading = false;
  }
</script>

<svelte:head>
  <title>Swap V2 - KongSwap</title>
  <meta name="description" content="Cross-chain swaps between Solana and Internet Computer" />
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900">
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-md mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Cross-Chain Swap
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Seamlessly swap between Solana and Internet Computer
        </p>
      </div>
      
      <!-- Main swap card -->
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="space-y-6">
        <!-- Mode Selector -->
        <div>
          <!-- Mode Pills -->
          <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
            <button
              onclick={() => { swapMode = 'SOL_TO_ICP'; updateTokensForMode(); }}
              class="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200
                {swapMode === 'SOL_TO_ICP' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600'}"
            >
              SOL → ICP
            </button>
            <button
              onclick={() => { swapMode = 'ICP_TO_SOL'; updateTokensForMode(); }}
              class="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200
                {swapMode === 'ICP_TO_SOL' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600'}"
            >
              ICP → SOL
            </button>
            <button
              onclick={() => { swapMode = 'SOL_TO_SPL'; updateTokensForMode(); }}
              class="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200
                {swapMode === 'SOL_TO_SPL' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600'}"
            >
              SOL → SPL
            </button>
          </div>
          
          <!-- Test Buttons for SOL Transfer -->
          {#if swapMode === 'SOL_TO_ICP' && isConnected}
            <div class="flex gap-2 mt-4">
              {#if solanaCapabilities.canSendSol}
                <button
                  onclick={async () => {
                    try {
                      const amount = payAmount || '0.01'; // Default to 0.01 SOL if no amount entered
                      updateProgress('transfer', `Sending ${amount} SOL with ${solanaCapabilities.walletType}...`, 'pending');
                      
                      const txSignature = await SolanaService.sendSolWithWallet(solanaAddress, parseFloat(amount));
                      updateProgress('transfer', `SOL sent! TX: ${txSignature.slice(0, 8)}...`, 'success');
                      
                    } catch (error) {
                      console.error('Wallet send error:', error);
                      updateProgress('transfer', `Failed to send SOL: ${error.message}`, 'error');
                    }
                  }}
                  class="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🚀 Send SOL with Wallet
                </button>
              {:else}
                <button
                  onclick={async () => {
                    try {
                      // Test wallet detection
                      const capabilities = SolanaService.getSolanaCapabilities();
                      console.log('Wallet capabilities:', capabilities);
                      
                      // Try to get address
                      const address = await SolanaService.getUserSolanaAddress();
                      console.log('User Solana address:', address);
                      
                      // Check window objects
                      console.log('Window phantom:', (window as any).phantom);
                      console.log('Window solana:', (window as any).solana);
                      console.log('Window solflare:', (window as any).solflare);
                      
                      updateProgress('test', `Wallet test complete - check console`, 'success');
                    } catch (error) {
                      console.error('Wallet test error:', error);
                      updateProgress('test', `Wallet test failed: ${error.message}`, 'error');
                    }
                  }}
                  class="flex-1 py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🧪 Test Wallet Detection
                </button>
              {/if}
              
                              <button
                  onclick={async () => {
                    try {
                      // First get Solana address from wallet if we don't have it
                      if (!userSolanaAddress) {
                        if ((window as any).phantom?.solana?.publicKey) {
                          userSolanaAddress = (window as any).phantom.solana.publicKey.toString();
                        } else if ((window as any).solflare?.publicKey) {
                          userSolanaAddress = (window as any).solflare.publicKey.toString();
                        } else if ((window as any).solana?.publicKey) {
                          userSolanaAddress = (window as any).solana.publicKey.toString();
                        }
                      }
                      
                      // Show a simple instruction
                      const amount = payAmount || '0.01'; // Default to 0.01 SOL if no amount entered
                      const message = `Please send ${amount} SOL to:\n\n${solanaAddress}\n\nThen return here and click Swap.`;
                      
                      // Copy address to clipboard
                      await navigator.clipboard.writeText(solanaAddress);
                      
                      alert(message + '\n\nAddress copied to clipboard!');
                      
                    } catch (error) {
                      console.error('Copy address error:', error);
                    }
                  }}
                  class="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📋 Copy Kong Address
                </button>
              
                                            <button
                onclick={async () => {
                  const url = `https://solscan.io/account/${solanaAddress}?cluster=devnet`;
                  window.open(url, '_blank');
                }}
                class="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🔍 View on Explorer
              </button>
            </div>
            
            <!-- Devnet SOL Faucet Button -->
            <div class="flex gap-2 mt-2">
              <button
                onclick={async () => {
                  try {
                    if (!userSolanaAddress) {
                      updateProgress('faucet', 'Please connect Solana wallet first', 'error');
                      return;
                    }
                    
                    updateProgress('faucet', 'Requesting devnet SOL from faucet...', 'pending');
                    const signature = await SolanaService.requestDevnetSol(userSolanaAddress);
                    updateProgress('faucet', `Devnet SOL received! TX: ${signature.slice(0, 8)}...`, 'success');
                  } catch (error) {
                    console.error('Faucet error:', error);
                    updateProgress('faucet', `Faucet failed: ${error.message}`, 'error');
                  }
                }}
                class="flex-1 py-2 px-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🚰 Get Devnet SOL
              </button>
            </div>
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
              onclick={async () => {
                try {
                  updateProgress('connect', 'Connecting to Solana wallet...', 'pending');
                  const address = await SolanaService.connectSolanaWallet();
                  userSolanaAddress = address || '';
                  updateProgress('connect', `Connected! Address: ${address?.slice(0, 8)}...`, 'success');
                  console.log('Connected Solana address:', address);
                } catch (e) {
                  console.error('Failed to connect Solana wallet:', e);
                  updateProgress('connect', `Connection failed: ${e.message}`, 'error');
                }
              }}
              class="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              🔗 Connect Solana Wallet
            </button>
            
            <button 
              onclick={() => {
                console.log('Adapter info:', {
                  id: auth.pnp.adapter?.id,
                  capabilities: solanaCapabilities
                });
              }}
              class="text-xs text-green-500 hover:text-green-700 underline ml-2"
            >
              🔍 Show Capabilities
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
        
        <!-- Show Kong Solana Address for Manual Transfer -->
        {#if swapMode === 'SOL_TO_ICP'}
          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Send SOL to Kong Address (Devnet):
                </p>
                {#if solanaAddress}
                  <p class="text-xs font-mono text-blue-800 dark:text-blue-200 break-all">
                    {solanaAddress}
                  </p>
                  <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    ✅ Fetched from canister
                  </p>
                {:else}
                  <div class="animate-pulse">
                    <div class="h-4 bg-blue-300 dark:bg-blue-600 rounded w-3/4 mb-2"></div>
                    <div class="h-3 bg-blue-300 dark:bg-blue-600 rounded w-1/2"></div>
                  </div>
                {/if}
              </div>
              {#if solanaAddress}
                <button
                  onclick={() => {
                    navigator.clipboard.writeText(solanaAddress);
                    alert('Address copied!');
                  }}
                  class="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  📋
                </button>
              {/if}
            </div>
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
                <LoadingIndicator size={16} />
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
                
                <!-- Cool Job Polling UI -->
                {#if jobId}
                  <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <!-- Job Header -->
                    <div class="flex items-center justify-between mb-3">
                      <div>
                        <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Job ID</p>
                        <code class="text-xs font-mono text-blue-600 dark:text-blue-400">{jobId}</code>
                      </div>
                      {#if !isPolling}
                        <button
                          onclick={async () => {
                            if (jobId) {
                              updateProgress('manual-poll', 'Checking job status...', 'pending');
                              try {
                                const actor = await getActor();
                                const jobStatus = await actor.get_swap_job(jobId);
                                
                                if (jobStatus && jobStatus.length > 0) {
                                  const job = jobStatus[0];
                                  jobDetails = job;
                                  const statusKey = Object.keys(job.status)[0];
                                  
                                  if (statusKey === 'Confirmed') {
                                    updateProgress('complete', 'Swap confirmed!', 'success');
                                  } else if (statusKey === 'Failed') {
                                    updateProgress('failed', 'Swap failed!', 'error');
                                  } else {
                                    updateProgress('manual-check', `Status: ${statusKey}`, 'pending');
                                  }
                                } else {
                                  updateProgress('not-found', 'Job not found', 'error');
                                }
                              } catch (error) {
                                updateProgress('poll-error', `Poll error: ${error.message}`, 'error');
                              }
                            }
                          }}
                          class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                          🔄 Refresh
                        </button>
                      {/if}
                    </div>

                    <!-- Progress Bar (when polling) -->
                    {#if isPolling}
                      <div class="mb-3">
                        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span>Processing...</span>
                          <span>{pollAttempt}/{maxPollAttempts}s</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div 
                            class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000 ease-out"
                            style="width: {Math.min((pollAttempt / maxPollAttempts) * 100, 100)}%"
                          ></div>
                        </div>
                      </div>
                    {/if}

                    <!-- Job Status Details -->
                    {#if jobDetails}
                      <div class="space-y-2">
                        {#if jobDetails.pay_tx_signature && jobDetails.pay_tx_signature.length > 0}
                          <div class="flex items-center justify-between py-1">
                            <span class="text-xs text-gray-600 dark:text-gray-400">SOL Transfer:</span>
                            <div class="flex items-center gap-1">
                              <span class="text-xs text-green-600 dark:text-green-400">✓</span>
                              <code class="text-xs font-mono text-gray-800 dark:text-gray-200">
                                {jobDetails.pay_tx_signature[0].slice(0, 8)}...
                              </code>
                            </div>
                          </div>
                        {/if}

                        {#if jobDetails.solana_tx_signature_of_payout && jobDetails.solana_tx_signature_of_payout.length > 0}
                          <div class="flex items-center justify-between py-1">
                            <span class="text-xs text-gray-600 dark:text-gray-400">ICP Payout:</span>
                            <div class="flex items-center gap-1">
                              <span class="text-xs text-green-600 dark:text-green-400">✓</span>
                              <code class="text-xs font-mono text-gray-800 dark:text-gray-200">
                                {jobDetails.solana_tx_signature_of_payout[0].slice(0, 8)}...
                              </code>
                            </div>
                          </div>
                        {/if}

                        <!-- Current Status Badge -->
                        {#if jobDetails.status}
                          {@const statusKey = Object.keys(jobDetails.status)[0]}
                          <div class="flex items-center justify-between py-1">
                            <span class="text-xs text-gray-600 dark:text-gray-400">Status:</span>
                            <span class="px-2 py-1 text-xs rounded-full font-medium
                              {statusKey === 'Confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
                              {statusKey === 'Submitted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : ''}
                              {statusKey === 'Processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : ''}
                              {statusKey === 'Pending' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' : ''}
                              {statusKey === 'Failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : ''}">
                              {statusKey}
                            </span>
                          </div>
                        {/if}

                        <!-- Animated Status Icons -->
                        {#if isPolling}
                          <div class="flex justify-center py-2">
                            <div class="flex items-center gap-2">
                              <!-- Spinning progress indicators -->
                              <div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              <span class="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {progress.step === 'submitted' ? 'Broadcasting...' : 
                                 progress.step === 'processing' ? 'Confirming...' : 
                                 'Monitoring...'}
                              </span>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Wallet Connection Issues -->
        {#if progress.status === 'error' && (progress.message.includes('Lost connection') || progress.message.includes('refresh'))}
          <div class="p-6 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <div class="flex items-start gap-3 mb-4">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 class="font-semibold text-red-800 dark:text-red-300 mb-2">Wallet Connection Lost</h3>
                <p class="text-sm text-red-700 dark:text-red-400 mb-4">
                  Your Phantom/Solflare wallet connection was lost. Please reconnect to continue with automatic SOL transfers.
                </p>
                
                <div class="space-y-2">
                  <button
                    onclick={async () => {
                      try {
                        updateProgress('reconnect', 'Reconnecting to wallet...', 'pending');
                        const address = await SolanaService.connectSolanaWallet();
                        userSolanaAddress = address || '';
                        // Update capabilities after reconnection
                        solanaCapabilities = SolanaService.getSolanaCapabilities();
                        updateProgress('reconnect', 'Wallet reconnected successfully!', 'success');
                      } catch (e) {
                        updateProgress('reconnect', `Failed to reconnect: ${e.message}`, 'error');
                      }
                    }}
                    class="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    🔗 Reconnect Wallet
                  </button>
                  
                  <button
                    onclick={() => window.location.reload()}
                    class="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    🔄 Refresh Page
                  </button>
                </div>
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
                onclick={hideManualTransferInstructions}
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
                onclick={() => navigator.clipboard.writeText(manualTransferInstructions.address)}
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
          onclick={() => executeSwap()}
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
          <div class="mb-1">
            🚧 <strong>Development Mode:</strong> Using Solana Devnet
          </div>
          {#if swapMode === 'SOL_TO_ICP'}
            {#if solanaCapabilities.canSendSol}
              Devnet SOL will be sent automatically via {solanaCapabilities.walletType}
            {:else}
              Manual devnet SOL transfer required to Kong address: {solanaAddress.slice(0, 8)}...
            {/if}
          {:else if swapMode === 'ICP_TO_SOL'}
            ICP approval will be requested, devnet SOL sent to your address
          {:else}
            Direct SPL token swap on Solana devnet
          {/if}
        </div>
      </div>
    </div>
  </div>
</main>