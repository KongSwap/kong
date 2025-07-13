<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { interpret } from '@xstate/fsm';
  import { swapMachine, getButtonTextFromState, isButtonDisabled } from '../services/SwapStateMachine';
  import { SwapOrchestrator } from '../services/SwapOrchestrator';
  import { useSwapForm } from '../hooks/useSwapForm.svelte';
  import SwapForm from './SwapForm/SwapForm.svelte';
  // Removed unused SwapSummary import
  import SwapConfirmationModal from './SwapConfirmationModal.svelte';
  import ErrorBoundary from './ErrorBoundary.svelte';
  // Removed unused Card import
  import { auth } from '$lib/stores/auth';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { walletProviderStore } from '$lib/stores/walletProviderStore';
  import type { SwapToken } from '../types/swap.types';
  import { userTokens } from '$lib/stores/userTokens';
  import { DEFAULT_TOKENS } from '$lib/constants/canisterConstants';
  import { get } from 'svelte/store';
  import Icon from '@iconify/svelte';
  import { loadBalances } from '$lib/stores/balancesStore';
  
  // Props
  let { } = $props();
  
  // Services
  const orchestrator = new SwapOrchestrator();
  const swapForm = useSwapForm();
  
  // State machine
  const service = interpret(swapMachine).start();
  let currentState = $state(service.state);
  let isLoading = $state(false);
  let quote = $state(null);
  let showConfirmation = $state(false);
  let successTxHash = $state('');
  let isSwapping = $state(false);
  
  // Track all timeouts for cleanup
  const timeouts = new Set<NodeJS.Timeout>();
  let quoteAbortController: AbortController | null = null;
  let swapAbortController: AbortController | null = null;
  
  // Helper function to create managed timeouts
  function createTimeout(fn: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(() => {
      timeouts.delete(timeout);
      fn();
    }, delay);
    timeouts.add(timeout);
    return timeout;
  }
  
  // Helper to clear a specific timeout
  function clearManagedTimeout(timeout: NodeJS.Timeout | undefined) {
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(timeout);
    }
  }
  
  // Performance monitoring in dev
  if (import.meta.env.DEV) {
    $effect(() => {
      console.log(`[SwapContainer] Active timeouts: ${timeouts.size}`);
    });
  }
  
  // Derived values
  let buttonText = $derived(
    // Handle initialization state - if auth is undefined, show loading
    $auth.isConnected === undefined ? 'Loading...' :
    // If explicitly not connected
    $auth.isConnected === false ? 'Connect Wallet' :
    // If connected, check form state
    !swapForm.values.payToken || !swapForm.values.receiveToken ? 'Select Tokens' :
    !swapForm.values.payAmount || parseFloat(swapForm.values.payAmount) === 0 ? 'Enter Amount' :
    swapForm.errors.payAmount === 'Insufficient balance' ? 'Insufficient Balance' :
    swapForm.errors.payAmount === 'Insufficient balance for fees' ? 'Insufficient for Gas' :
    swapForm.errors.payAmount?.includes('Warning') ? getButtonTextFromState(currentState?.value || 'idle') :
    swapForm.errors.general ? 'Fix Errors' :
    swapForm.errors.payAmount ? 'Invalid Amount' :
    getButtonTextFromState(currentState?.value || 'idle') || 'Swap'
  );
  
  let buttonDisabled = $derived(
    !$auth.isConnected ? false :
    swapForm.errors.payAmount === 'Insufficient balance' ? true :
    swapForm.errors.payAmount === 'Insufficient balance for fees' ? true :
    !swapForm.isValid ? true :
    isButtonDisabled(currentState?.value || 'idle')
  );
  
  // Quote fetching
  async function fetchQuote() {
    if (!swapForm.values.payToken || !swapForm.values.receiveToken || !swapForm.values.payAmount) {
      return;
    }
    
    // Cancel previous request if any
    if (quoteAbortController) {
      quoteAbortController.abort();
    }
    
    quoteAbortController = new AbortController();
    isLoading = true;
    
    try {
      const quoteResult = await orchestrator.getQuote({
        payToken: swapForm.values.payToken,
        receiveToken: swapForm.values.receiveToken,
        payAmount: swapForm.values.payAmount,
        slippage: $settingsStore.max_slippage || 1,
      }, { signal: quoteAbortController.signal });
      
      if (quoteResult) {
        quote = quoteResult;
        swapForm.setReceiveAmount(quoteResult.receiveAmount);
        service.send({ type: 'QUOTE_SUCCESS', quote: quoteResult });
      }
    } catch (error) {
      // Ignore abort errors
      if (error.name !== 'AbortError') {
        console.error('Quote error:', error);
        service.send({ type: 'QUOTE_ERROR', error: error.message });
      }
    } finally {
      isLoading = false;
    }
  }
  
  // Debounced quote fetching
  let quoteTimeout: NodeJS.Timeout | undefined;
  function debouncedFetchQuote() {
    clearManagedTimeout(quoteTimeout);
    quoteTimeout = createTimeout(fetchQuote, 500);
  }
  
  // Track needs allowance state
  let needsAllowance = $state(false);
  
  // Event handlers
  async function handlePayAmountChange(amount: string) {
    swapForm.setPayAmount(amount, needsAllowance);
    
    // Transition state machine when amount is entered
    if (amount && parseFloat(amount) > 0) {
      service.send({ type: 'UPDATE_AMOUNT', amount, field: 'pay' });
    } else if (!amount || parseFloat(amount) === 0) {
      // Reset to idle if amount is cleared
      service.send({ type: 'RESET' });
    }
    
    if (amount && swapForm.values.payToken && swapForm.values.receiveToken) {
      debouncedFetchQuote();
    }
  }
  
  function handlePayTokenSelect(token: SwapToken) {
    swapForm.setPayToken(token);
    
    // Check if this is an ICRC-2 token that might need allowance
    if (token.standards?.includes('ICRC-2')) {
      // We'll check allowance when the user initiates the swap
      needsAllowance = false; // Reset for now
    }
    
    // Notify state machine of token selection
    if (swapForm.values.receiveToken) {
      service.send({ type: 'SELECT_TOKENS' });
    }
    
    if (swapForm.values.payAmount && swapForm.values.receiveToken) {
      debouncedFetchQuote();
    }
    
    // Re-validate amount with new token
    if (swapForm.values.payAmount) {
      swapForm.setPayAmount(swapForm.values.payAmount, needsAllowance);
    }
  }
  
  function handleReceiveTokenSelect(token: SwapToken) {
    swapForm.setReceiveToken(token);
    
    // Notify state machine of token selection
    if (swapForm.values.payToken) {
      service.send({ type: 'SELECT_TOKENS' });
    }
    
    if (swapForm.values.payAmount && swapForm.values.payToken) {
      debouncedFetchQuote();
    }
  }
  
  function handleSwitchTokens() {
    // Start animation
    isSwapping = true;
    
    // Complete the swap at 50% of animation for perfect synchronization
    createTimeout(() => {
      swapForm.switchTokens();
      if (swapForm.values.payAmount) {
        debouncedFetchQuote();
      }
      
      // End animation after full duration + small buffer
      createTimeout(() => {
        isSwapping = false;
      }, 150); // Animation completes at 300ms, small buffer for cleanup
    }, 150); // 50% of 300ms animation duration - perfect sync point
  }
  
  async function handleButtonClick() {
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }
    
    const isFormValid = await swapForm.validateForm();
    if (!isFormValid) {
      return;
    }
    
    // Handle different states
    switch (currentState?.value || 'idle') {
      case 'idle':
        // If we're in idle but have valid form, fetch quote
        if (swapForm.values.payToken && swapForm.values.receiveToken && swapForm.values.payAmount) {
          fetchQuote();
        }
        break;
      case 'ready':
        service.send({ type: 'INITIATE_SWAP' });
        showConfirmation = true;
        break;
      case 'error':
        service.send({ type: 'RETRY' });
        break;
      case 'quoting':
        // Do nothing while quoting
        break;
    }
  }
  
  async function handleSwapConfirm() {
    showConfirmation = false;
    service.send({ type: 'CONFIRM' });
    
    // Create new abort controller for swap execution
    swapAbortController = new AbortController();
    
    try {
      const result = await orchestrator.executeSwap({
        payToken: swapForm.values.payToken!,
        payAmount: swapForm.values.payAmount,
        receiveToken: swapForm.values.receiveToken!,
        slippage: $settingsStore.max_slippage || 1,
      }, { signal: swapAbortController.signal });
      
      if (result.success && result.data) {
        service.send({ type: 'SUCCESS', txHash: result.data.txHash });
        successTxHash = result.data.txHash;
        
        // Trigger banana explosion!
        triggerBananaExplosion();
        
        // Reset only amounts after successful swap, keep tokens selected
        createTimeout(() => {
          swapForm.setPayAmount('');
          swapForm.setReceiveAmount('');
          service.send({ type: 'RESET' });
        }, 3000);
      } else {
        const errorMessage = result.error || result.errors?.join(', ') || 'Swap failed';
        service.send({ type: 'FAILURE', error: errorMessage });
      }
    } catch (error) {
      service.send({ type: 'FAILURE', error: error.message });
    }
  }
  
  function handleSwapCancel() {
    showConfirmation = false;
    service.send({ type: 'CANCEL' });
  }
  
  // Banana explosion animation
  function triggerBananaExplosion() {
    // Dynamic import of canvas-confetti
    import('canvas-confetti').then(confetti => {
      const myConfetti = confetti.default;
      
      // Create custom banana shape - BIGGER BANANAS!
      const bananaShape = myConfetti.shapeFromText({ text: '🍌', scalar: 4 });
      
      const count = 100;
      const defaults = {
        origin: { y: 0.6 },
        gravity: 0.8,
        shapes: [bananaShape],
        scalar: 3
      };
      
      function fireBananas(particleRatio: number, opts: any) {
        myConfetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      }
      
      // Multiple banana bursts with different colors for variety
      fireBananas(0.4, {
        spread: 60,
        startVelocity: 45,
        colors: ['#FFD700', '#FFED4A', '#F7E98E']
      });
      
      createTimeout(() => {
        fireBananas(0.3, {
          spread: 80,
          startVelocity: 35,
          colors: ['#FFD700', '#FFED4A', '#F7E98E']
        });
      }, 200);
      
      createTimeout(() => {
        fireBananas(0.3, {
          spread: 100,
          startVelocity: 25,
          decay: 0.9,
          colors: ['#FFD700', '#FFED4A', '#F7E98E']
        });
      }, 400);
    });
  }
  
  // Subscribe to state changes
  $effect(() => {
    const subscription = service.subscribe((state) => {
      currentState = state;
    });
    
    return () => subscription.unsubscribe();
  });
  
  // Set default tokens on mount
  onMount(() => {
    // Small delay to ensure stores are initialized
    createTimeout(async () => {
      // Ensure tokens are initialized first
      await userTokens.ensureInitialized();
      
      // Load balances if user is connected
      if ($auth.isConnected && $auth.account?.owner) {
        const userTokensState = get(userTokens);
        const tokens = Array.from(userTokensState.tokenData.values());
        if (tokens.length > 0) {
          await loadBalances(tokens, $auth.account.owner, false);
        }
      }
      
      // Check if userTokens store has tokens
      const userTokensState = get(userTokens);
      const tokens = userTokensState.tokenData;
      if (tokens.size > 0 && !swapForm.values.payToken && !swapForm.values.receiveToken) {
        // Find ICP token
        const icpToken = Array.from(tokens.values()).find(
          token => token.address === DEFAULT_TOKENS.icp
        );
        
        // Find KONG token
        const kongToken = Array.from(tokens.values()).find(
          token => token.address === DEFAULT_TOKENS.kong
        );
        
        // Set defaults if found
        if (icpToken) {
          swapForm.setPayToken(icpToken as any as SwapToken);
        }
        if (kongToken) {
          swapForm.setReceiveToken(kongToken as any as SwapToken);
        }
        
        // Notify state machine if both tokens are set
        if (icpToken && kongToken) {
          service.send({ type: 'SELECT_TOKENS' });
        }
      }
    }, 100);
  });
  
  // Cleanup
  onDestroy(() => {
    // Stop the state machine service
    service.stop();
    
    // Clear all managed timeouts
    timeouts.forEach(timeout => clearTimeout(timeout));
    timeouts.clear();
    
    // Clear any remaining quote timeout
    clearManagedTimeout(quoteTimeout);
    
    // Cancel any pending requests
    if (quoteAbortController) {
      quoteAbortController.abort();
      quoteAbortController = null;
    }
    
    if (swapAbortController) {
      swapAbortController.abort();
      swapAbortController = null;
    }
  });
</script>

<ErrorBoundary>
  <div class="mx-auto bg-transparent w-[460px] px-3 sm:px-4 md:px-0 relative z-10">
    <!-- Glow element positioned behind the container -->
    <div class="absolute inset-0 rounded-swap-container-roundness glow-background pointer-events-none"></div>
    
    <div class="relative shadow hover:shadow-lg transition-all duration-200 min-w-[320px] rounded-swap-container-roundness swap-container-solid">

      
      <div class="px-3 sm:px-4 pb-4 pt-4 space-y-4" class:swapping-container={isSwapping}>
        <SwapForm
          values={swapForm.values}
          errors={swapForm.errors}
          {isLoading}
          onPayAmountChange={handlePayAmountChange}
          onPayTokenSelect={handlePayTokenSelect}
          onReceiveTokenSelect={handleReceiveTokenSelect}
          onSwitchTokens={handleSwitchTokens}
          receiveAmount={swapForm.values.receiveAmount}
        />
        
        {#if quote && currentState?.value === 'ready'}
          <div class="p-3 bg-kong-swap-input-bg/50 rounded-xl animate-slideIn">
            <div class="flex items-center justify-between text-sm space-y-1">
              <!-- Rate -->
              <div class="flex items-center space-x-2">
                <span class="text-xs sm:text-sm text-kong-text-secondary">Rate:</span>
                <span class="text-xs sm:text-sm text-kong-text-primary font-medium">
                  1:{(parseFloat(quote.receiveAmount) / parseFloat(swapForm.values.payAmount)).toFixed(4)}
                </span>
              </div>
              
              <!-- Price Impact -->
              {#if quote.priceImpact}
                <div class="flex items-center space-x-2">
                  <span class="text-xs sm:text-sm text-kong-text-secondary">Impact:</span>
                  <span class="text-xs sm:text-sm font-medium {parseFloat(quote.priceImpact) > 5 ? 'text-kong-semantic-error' : parseFloat(quote.priceImpact) > 3 ? 'text-kong-semantic-warning' : 'text-kong-text-primary'}">
                    {quote.priceImpact}%
                  </span>
                </div>
              {/if}
              
              <!-- Fees -->
              <div class="flex items-center space-x-2">
                <span class="text-xs sm:text-sm text-kong-text-secondary">Fee:</span>
                <span class="text-xs sm:text-sm text-kong-text-primary font-medium flex items-center gap-1">
                  ${(() => {
                    let totalFeesUSD = 0;
                    
                    // Calculate gas fees in USD
                    if (quote.gasFees) {
                      for (const fee of quote.gasFees) {
                        const token = fee.token === swapForm.values.payToken?.address ? swapForm.values.payToken : swapForm.values.receiveToken;
                        if (token?.metrics?.price) {
                          totalFeesUSD += parseFloat(fee.amount) * parseFloat(token.metrics.price);
                        }
                      }
                    }
                    
                    // Calculate LP fees in USD
                    if (quote.lpFees) {
                      for (const fee of quote.lpFees) {
                        const token = fee.token === swapForm.values.payToken?.address ? swapForm.values.payToken : swapForm.values.receiveToken;
                        if (token?.metrics?.price) {
                          totalFeesUSD += parseFloat(fee.amount) * parseFloat(token.metrics.price);
                        }
                      }
                    }
                    
                    return totalFeesUSD.toFixed(2);
                  })()}
                </span>
              </div>
            </div>
          </div>
        {/if}
        
        <button
          class="w-full h-14 sm:h-16 px-6 text-base sm:text-lg font-semibold rounded-2xl transition-all duration-200 relative overflow-hidden touch-manipulation
                 {buttonDisabled 
                   ? (swapForm.errors.payAmount?.includes('Insufficient') 
                     ? 'bg-kong-swap-button-error-bg cursor-not-allowed' 
                     : 'bg-kong-swap-button-disabled-bg cursor-not-allowed')
                   : 'bg-kong-swap-button-bg hover:bg-kong-swap-button-hover-bg active:scale-[0.98]'}"
          disabled={buttonDisabled}
          onclick={handleButtonClick}
        >
          <span class="relative z-10 flex items-center justify-center space-x-2 font-semibold
                       {buttonDisabled && !swapForm.errors.payAmount?.includes('Insufficient') 
                         ? 'text-kong-text-disabled' 
                         : 'text-white'}">
            {#if isLoading}
              <Icon 
                icon="eos-icons:loading" 
                class="animate-spin h-5 w-5 {buttonDisabled && !swapForm.errors.payAmount?.includes('Insufficient') ? 'text-kong-text-disabled' : 'text-white'}" 
              />
              <span class="{buttonDisabled && !swapForm.errors.payAmount?.includes('Insufficient') ? 'text-kong-text-primary/50' : 'text-white'}">Fetching best price...</span>
            {:else}
              <span class="{buttonDisabled && !swapForm.errors.payAmount?.includes('Insufficient') ? 'text-kong-text-primary/50' : 'text-white'}">{buttonText || 'Swap'}</span>
            {/if}
          </span>
        </button>
        
        {#if currentState?.context?.error}
          <div class="p-3 bg-kong-semantic-error/5 border border-kong-semantic-error/10 rounded-xl animate-shake">
            <p class="text-sm text-kong-semantic-error flex items-center space-x-2">
              <Icon 
                icon="heroicons:exclamation-circle-solid" 
                class="w-4 h-4 flex-shrink-0" 
              />
              <span>{currentState?.context?.error}</span>
            </p>
          </div>
        {/if}
        
      </div>
    </div>
  </div>
  
  {#if showConfirmation}
    <SwapConfirmationModal
      payToken={swapForm.values.payToken}
      payAmount={swapForm.values.payAmount}
      receiveToken={swapForm.values.receiveToken}
      receiveAmount={swapForm.values.receiveAmount}
      {quote}
      onConfirm={handleSwapConfirm}
      onCancel={handleSwapCancel}
    />
  {/if}
  
</ErrorBoundary>

<style>
  
  /* Modern animations */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes shake {
    0%, 100% {
      transform: translateX(0);
    }
    10%, 30%, 50%, 70%, 90% {
      transform: translateX(-1px);
    }
    20%, 40%, 60%, 80% {
      transform: translateX(1px);
    }
  }
  
  .animate-slideIn {
    animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .animate-shake {
    animation: shake 0.4s ease-in-out;
  }
  
  /* Swap animation container - optimized for performance */
  .swapping-container {
    overflow: visible !important;
  }
  
  /* Textured swap container background */
  .swap-container-solid {
    background-color: rgb(var(--bg-primary)) !important;
    position: relative;
    overflow: visible; /* Allow glow to show outside */
    /* Add immediate visible noise texture */
    background-image: 
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E");
    background-size: 180px 180px;
    /* No transitions needed - all effects handled by parent wrapper */
  }

  /* Base background layer */
  .swap-container-solid::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgb(var(--swap-container-bg, var(--bg-secondary))) !important;
    border-radius: inherit;
    z-index: -2;
    opacity: 1 !important;
  }
  
  /* Noise texture layer */
  .swap-container-solid::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      /* Primary noise pattern */
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 1px,
        rgba(255,255,255,0.05) 1px,
        rgba(255,255,255,0.05) 2px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 1px,
        rgba(255,255,255,0.05) 1px,
        rgba(255,255,255,0.05) 2px
      ),
      /* Diagonal noise for complexity */
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(255,255,255,0.08) 2px,
        rgba(255,255,255,0.08) 3px
      ),
      /* Dot pattern overlay */
      radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 0.5px, transparent 1px),
      /* Random dots for organic noise */
      radial-gradient(circle at 7px 3px, rgba(255,255,255,0.1) 0.5px, transparent 1px),
      radial-gradient(circle at 12px 8px, rgba(255,255,255,0.1) 0.5px, transparent 1px),
      radial-gradient(circle at 4px 11px, rgba(255,255,255,0.1) 0.5px, transparent 1px);
    background-size: 
      3px 3px,
      3px 3px,
      6px 6px,
      12px 12px,
      15px 15px,
      15px 15px,
      15px 15px;
    background-position: 
      0 0,
      0 0,
      0 0,
      0 0,
      0 0,
      5px 2px,
      8px 7px;
    border-radius: inherit;
    z-index: -1;
    opacity: 1;
    animation: textureFloat 30s ease-in-out infinite;
  }
  
  /* Subtle floating animation for texture */
  @keyframes textureFloat {
    0%, 100% {
      transform: translate(0, 0);
    }
    25% {
      transform: translate(1px, -1px);
    }
    50% {
      transform: translate(-1px, 1px);
    }
    75% {
      transform: translate(1px, 1px);
    }
  }
  
  /* Accessibility: Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .swap-container-solid::after {
      animation: none;
    }
  }
  
  
</style>