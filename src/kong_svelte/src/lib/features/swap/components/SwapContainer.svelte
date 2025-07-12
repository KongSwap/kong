<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { interpret } from '@xstate/fsm';
  import { swapMachine, getButtonTextFromState, isButtonDisabled } from '../services/SwapStateMachine';
  import { SwapOrchestrator } from '../services/SwapOrchestrator';
  import { useSwapForm } from '../hooks/useSwapForm.svelte';
  import SwapForm from './SwapForm/SwapForm.svelte';
  import SwapSummary from './SwapSummary/SwapSummary.svelte';
  import SwapConfirmationModal from './SwapConfirmationModal.svelte';
  import SwapSuccessModal from './SwapSuccessModal.svelte';
  import ErrorBoundary from './ErrorBoundary.svelte';
  import Card from '$lib/components/common/Card.svelte';
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
  let { widthFull = false } = $props<{ widthFull?: boolean }>();
  
  // Services
  const orchestrator = new SwapOrchestrator();
  const swapForm = useSwapForm();
  
  // State machine
  const service = interpret(swapMachine).start();
  let currentState = $state(service.state);
  let isLoading = $state(false);
  let quote = $state(null);
  let showConfirmation = $state(false);
  let showSuccess = $state(false);
  let successTxHash = $state('');
  
  // Derived values
  let buttonText = $derived(
    !$auth.isConnected ? 'Connect Wallet' :
    !swapForm.values.payToken || !swapForm.values.receiveToken ? 'Select Tokens' :
    !swapForm.values.payAmount || parseFloat(swapForm.values.payAmount) === 0 ? 'Enter Amount' :
    swapForm.errors.general ? 'Fix Errors' :
    swapForm.errors.payAmount ? 'Invalid Amount' :
    getButtonTextFromState(currentState.value)
  );
  
  let buttonDisabled = $derived(
    !$auth.isConnected ? false :
    !swapForm.isValid ? true :
    isButtonDisabled(currentState.value)
  );
  
  // Quote fetching
  async function fetchQuote() {
    if (!swapForm.values.payToken || !swapForm.values.receiveToken || !swapForm.values.payAmount) {
      return;
    }
    
    isLoading = true;
    
    try {
      const quoteResult = await orchestrator.getQuote({
        payToken: swapForm.values.payToken,
        receiveToken: swapForm.values.receiveToken,
        payAmount: swapForm.values.payAmount,
        slippage: $settingsStore.max_slippage || 1,
      });
      
      if (quoteResult) {
        quote = quoteResult;
        swapForm.setReceiveAmount(quoteResult.receiveAmount);
        service.send({ type: 'QUOTE_SUCCESS', quote: quoteResult });
      }
    } catch (error) {
      console.error('Quote error:', error);
      service.send({ type: 'QUOTE_ERROR', error: error.message });
    } finally {
      isLoading = false;
    }
  }
  
  // Debounced quote fetching
  let quoteTimeout: NodeJS.Timeout;
  function debouncedFetchQuote() {
    clearTimeout(quoteTimeout);
    quoteTimeout = setTimeout(fetchQuote, 500);
  }
  
  // Event handlers
  async function handlePayAmountChange(amount: string) {
    swapForm.setPayAmount(amount);
    
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
    
    // Notify state machine of token selection
    if (swapForm.values.receiveToken) {
      service.send({ type: 'SELECT_TOKENS' });
    }
    
    if (swapForm.values.payAmount && swapForm.values.receiveToken) {
      debouncedFetchQuote();
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
    swapForm.switchTokens();
    if (swapForm.values.payAmount) {
      debouncedFetchQuote();
    }
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
    switch (currentState.value) {
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
    
    try {
      const result = await orchestrator.executeSwap({
        payToken: swapForm.values.payToken!,
        payAmount: swapForm.values.payAmount,
        receiveToken: swapForm.values.receiveToken!,
        slippage: $settingsStore.max_slippage || 1,
      });
      
      if (result.success && result.data) {
        service.send({ type: 'SUCCESS', txHash: result.data.txHash });
        successTxHash = result.data.txHash;
        showSuccess = true;
        
        // Reset form after successful swap
        setTimeout(() => {
          swapForm.reset();
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
  
  function handleSuccessClose() {
    showSuccess = false;
    swapForm.reset();
    service.send({ type: 'RESET' });
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
    setTimeout(async () => {
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
    service.stop();
    clearTimeout(quoteTimeout);
  });
</script>

<ErrorBoundary>
  <div class="swap-container {widthFull ? 'w-full' : 'max-w-full sm:max-w-[440px]'} mx-auto px-4 sm:px-0">
    <Card className="relative overflow-hidden shadow-sm">
      <!-- Background gradient effect - more subtle -->
      <div class="absolute inset-0 bg-gradient-to-br from-kong-primary/3 to-transparent pointer-events-none"></div>
      
      <!-- Header with settings - mobile optimized -->
      <div class="flex items-center justify-between p-4 sm:p-6 pb-2 sm:pb-2">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-kong-text-primary">Swap</h2>
          <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5">Trade tokens instantly</p>
        </div>
        
        <!-- Settings button -->
        <button
          class="p-2 rounded-full hover:bg-kong-bg-tertiary/50 transition-colors group"
          aria-label="Swap settings"
          onclick={() => {
            // TODO: Implement settings modal
          }}
        >
          <Icon 
            icon="heroicons:cog-6-tooth" 
            class="w-5 h-5 text-kong-text-secondary group-hover:text-kong-text-primary transition-colors" 
          />
        </button>
      </div>
      
      <div class="p-4 sm:p-6 pt-3 sm:pt-4">
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
        
        {#if quote && currentState.value === 'ready'}
          <div class="mt-3 sm:mt-4 animate-slideIn">
            <SwapSummary
              {quote}
              payToken={swapForm.values.payToken}
              receiveToken={swapForm.values.receiveToken}
            />
          </div>
        {/if}
        
        <button
          class="swap-button w-full mt-4 sm:mt-6 px-4 sm:px-6 py-3 sm:py-4 rounded-kong-roundness font-medium sm:font-semibold text-base sm:text-lg transition-all duration-200 transform relative overflow-hidden
                 {buttonDisabled 
                   ? 'bg-kong-bg-tertiary text-kong-text-tertiary cursor-not-allowed' 
                   : 'bg-kong-primary hover:bg-kong-primary/90 text-white shadow-sm hover:shadow-md active:scale-[0.98]'}"
          disabled={buttonDisabled}
          onclick={handleButtonClick}
        >
          <span class="relative z-10">
            {#if isLoading}
              <span class="inline-flex items-center gap-2">
                <Icon 
                  icon="eos-icons:loading" 
                  class="animate-spin h-4 sm:h-5 w-4 sm:w-5" 
                />
                <span>Getting best price...</span>
              </span>
            {:else}
              {buttonText}
            {/if}
          </span>
        </button>
        
        {#if currentState.context.error}
          <div class="mt-3 sm:mt-4 p-3 sm:p-4 bg-kong-error/10 border border-kong-error/20 rounded-kong-roundness animate-shake">
            <p class="text-xs sm:text-sm text-kong-error flex items-center gap-2">
              <Icon 
                icon="heroicons:exclamation-circle" 
                class="w-4 h-4 flex-shrink-0" 
              />
              <span>{currentState.context.error}</span>
            </p>
          </div>
        {/if}
        
      </div>
    </Card>
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
  
  {#if showSuccess}
    <SwapSuccessModal
      payToken={swapForm.values.payToken}
      payAmount={swapForm.values.payAmount}
      receiveToken={swapForm.values.receiveToken}
      receiveAmount={swapForm.values.receiveAmount}
      txHash={successTxHash}
      onClose={handleSuccessClose}
    />
  {/if}
</ErrorBoundary>

<style>
  .swap-container {
    position: relative;
  }
  
  /* Custom animations */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
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
      transform: translateX(-2px);
    }
    20%, 40%, 60%, 80% {
      transform: translateX(2px);
    }
  }
  
  .animate-slideIn {
    animation: slideIn 0.3s ease-out;
  }
  
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
  
  /* Button hover effects - desktop only */
  @media (min-width: 640px) {
    .swap-button:not(:disabled):hover {
      transform: translateY(-1px);
    }
  }
  
  .swap-button:not(:disabled):active {
    transform: scale(0.98);
  }
  
  /* Gradient text for loading state */
  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>