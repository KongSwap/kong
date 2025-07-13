<script lang="ts">
  import type { SwapToken } from '../../types/swap.types';
  import { currentUserBalancesStore } from '$lib/stores/balancesStore';
  import { auth } from '$lib/stores/auth';
  import TokenSelectorModal from '../TokenSelectorModal.svelte';
  import BigNumber from 'bignumber.js';
  import Icon from '@iconify/svelte';
  import { autoFitText } from '$lib/actions/autoFitText';
  // Removed unused import
  
  interface Props {
    token: SwapToken | null;
    amount: string;
    error?: string;
    placeholder?: string;
    isEditable?: boolean;
    isLoading?: boolean;
    label: string;
    onAmountChange?: (amount: string) => void;
    onTokenSelect: (token: SwapToken) => void;
  }
  
  let {
    token = null,
    amount = '',
    error = '',
    placeholder = '0.00',
    isEditable = true,
    isLoading = false,
    label,
    onAmountChange,
    onTokenSelect,
  }: Props = $props();
  
  let showTokenSelector = $state(false);
  let isFocused = $state(false);
  
  // Token switching animation state
  let isTokenSwitching = $state(false);
  let previousToken = $state(token);
  
  $effect(() => {
    if (previousToken?.address !== token?.address) {
      isTokenSwitching = true;
      previousToken = token;
      
      // Reset after animation
      setTimeout(() => {
        isTokenSwitching = false;
      }, 150);
    }
  });
  
  // Get user balance
  let balance = $derived(
    !token || !$auth.isConnected ? null :
    !$currentUserBalancesStore?.[token.address] ? '0' :
    new BigNumber($currentUserBalancesStore[token.address].in_tokens.toString())
      .div(new BigNumber(10).pow(token.decimals))
      .toString()
  );

  $inspect(balance);
  
  // Get USD value of input amount
  let usdValue = $derived(() => {
    if (!token || !amount || !$currentUserBalancesStore?.[token.address]) return null;
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum === 0) return null;
    
    const tokenBalance = $currentUserBalancesStore[token.address];
    const balanceUSD = parseFloat(tokenBalance.in_usd);
    const balanceTokens = new BigNumber(tokenBalance.in_tokens.toString())
      .div(new BigNumber(10).pow(token.decimals))
      .toNumber();
    
    if (balanceTokens === 0) return null;
    
    // Calculate price per token and then total USD value
    const pricePerToken = balanceUSD / balanceTokens;
    const totalUSD = amountNum * pricePerToken;
    
    // Format USD value
    if (totalUSD < 0.01) return "< $0.01";
    if (totalUSD < 1) return `$${totalUSD.toFixed(3)}`;
    if (totalUSD < 100) return `$${totalUSD.toFixed(2)}`;
    if (totalUSD < 1000) return `$${totalUSD.toFixed(2)}`;
    return `$${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });
  
  // Format balance for display - show with commas and all significant decimals
  let formattedBalance = $derived(() => {
    if (!balance || balance === '0') return '0';
    
    const balanceBN = new BigNumber(balance);
    
    // Split into integer and decimal parts
    const parts = balanceBN.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Format integer part with commas
    const formattedInteger = new BigNumber(integerPart).toFormat(0);
    
    if (!decimalPart) {
      return formattedInteger;
    }
    
    // Remove trailing zeros from decimal part
    const trimmedDecimal = decimalPart.replace(/0+$/, '');
    
    if (!trimmedDecimal) {
      return formattedInteger;
    }
    
    return `${formattedInteger}.${trimmedDecimal}`;
  });
  
  // Format amount with commas for display when not focused
  function formatAmountWithCommas(value: string): string {
    if (!value || value === '0' || value === '') return value;
    
    try {
      const num = new BigNumber(value);
      if (num.isNaN()) return value;
      
      // Split into integer and decimal parts
      const parts = num.toString().split('.');
      const integerPart = parts[0];
      const decimalPart = parts[1];
      
      // Format integer part with commas
      const formattedInteger = new BigNumber(integerPart).toFormat(0);
      
      if (!decimalPart) {
        return formattedInteger;
      }
      
      return `${formattedInteger}.${decimalPart}`;
    } catch {
      return value;
    }
  }
  
  // Display value - formatted when not focused, raw when focused
  let displayAmount = $derived(
    isFocused ? amount : formatAmountWithCommas(amount)
  );
  
  // No need to manually trigger updates - the action watches for value changes
  
  function handleAmountInput(event: Event) {
    if (!isEditable) return;
    
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    // Remove commas for processing
    value = value.replace(/,/g, '');
    
    // Allow only numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : sanitized;
    
    // Call the change handler with formatted value
    onAmountChange?.(formatted);
  }
  
  function handleFocus() {
    isFocused = true;
  }
  
  function handleBlur() {
    isFocused = false;
  }
  
  function handlePercentageClick(percentage: number) {
    if (!isEditable || !balance || !token) return;
    
    const balanceBN = new BigNumber(balance);
    
    let finalAmount: BigNumber;
    
    // For pay token and 100%, subtract gas fees
    if (label === 'Pay' && token && percentage === 100) {
      const feeBN = new BigNumber(token.fee_fixed)
        .div(new BigNumber(10).pow(token.decimals));
      
      const maxAmount = balanceBN.minus(feeBN.times(2)); // Account for approval + transfer
      finalAmount = BigNumber.maximum(maxAmount, 0);
    } else {
      // Calculate percentage of balance
      finalAmount = balanceBN.times(percentage).div(100);
    }
    
    // Format to token's decimal places, removing trailing zeros
    const formatted = finalAmount.toFixed(token.decimals);
    const trimmed = formatted.replace(/\.?0+$/, '');
    
    onAmountChange?.(trimmed);
  }
  
  function handleTokenClick() {
    showTokenSelector = true;
  }
  
  function handleTokenSelected(selectedToken: SwapToken) {
    onTokenSelect(selectedToken);
    showTokenSelector = false;
  }
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <label class="text-sm sm:text-base font-medium text-kong-text-secondary">{label}</label>
    {#if $auth.isConnected && token && isEditable && balance && balance !== '0'}
      <div class="flex items-center space-x-1">
        <!-- Mobile: Show only 50% and MAX -->
        <div class="flex sm:hidden items-center space-x-1">
          <button
            onclick={() => handlePercentageClick(50)}
            class="px-2 py-1 text-xs font-medium text-kong-text-secondary hover:text-kong-brand-primary hover:bg-kong-bg-tertiary/50 rounded-md transition-all duration-200"
          >
            50%
          </button>
          <button
            onclick={() => handlePercentageClick(100)}
            class="px-2 py-1 text-xs font-medium text-kong-text-secondary hover:text-kong-brand-primary hover:bg-kong-bg-tertiary/50 rounded-md transition-all duration-200"
          >
            MAX
          </button>
        </div>
        
        <!-- Desktop: Show all buttons -->
        <div class="hidden sm:flex items-center space-x-1">
          <button
            onclick={() => handlePercentageClick(25)}
            class="px-2 py-1 text-xs font-medium text-kong-text-secondary hover:text-kong-brand-primary hover:bg-kong-bg-tertiary/50 rounded-md transition-all duration-200"
          >
            25%
          </button>
          <button
            onclick={() => handlePercentageClick(50)}
            class="px-2 py-1 text-xs font-medium text-kong-text-secondary hover:text-kong-brand-primary hover:bg-kong-bg-tertiary/50 rounded-md transition-all duration-200"
          >
            50%
          </button>
          <button
            onclick={() => handlePercentageClick(75)}
            class="px-2 py-1 text-xs font-medium text-kong-text-secondary hover:text-kong-brand-primary hover:bg-kong-bg-tertiary/50 rounded-md transition-all duration-200"
          >
            75%
          </button>
          <button
            onclick={() => handlePercentageClick(100)}
            class="px-2 py-1 text-xs font-medium text-kong-text-secondary hover:text-kong-brand-primary hover:bg-kong-bg-tertiary/50 rounded-md transition-all duration-200"
          >
            MAX
          </button>
        </div>
      </div>
    {/if}
  </div>
  
  <div class="relative transition-all duration-200">
    <div class="flex items-center justify-between space-x-3">
      <!-- Amount Input -->
      <div class="flex-1 min-w-0">
        {#if isLoading && !isEditable}
          <!-- Skeleton loader for loading quote -->
          <div class="flex items-center h-9 sm:h-10">
            <div class="animate-pulse">
              <div class="h-6 sm:h-7 w-24 sm:w-32 bg-kong-bg-tertiary rounded-lg"></div>
            </div>
          </div>
        {:else}
          <input
            type="text"
            inputmode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            {placeholder}
            value={displayAmount}
            oninput={handleAmountInput}
            onfocus={handleFocus}
            onblur={handleBlur}
            readonly={!isEditable}
            disabled={isLoading}
            use:autoFitText={{
              minFontSize: 14,
              maxFontSize: 48,
              baseSizes: {
                default: '1.25rem',  // text-xl
                sm: '1.5rem',        // sm:text-2xl  
                md: '1.875rem'       // md:text-3xl
              },
              debug: false // Set to true to see debug logs
            }}
            class="w-full bg-transparent font-medium outline-none placeholder-kong-text-tertiary/50 transition-colors h-9 sm:h-10 leading-none tabular-nums
                   {!isEditable ? 'cursor-not-allowed text-kong-text-secondary' : 'text-kong-text-primary'}"
            aria-label="{label} amount"
          />
        {/if}
        
      </div>
      
      <!-- Token Selector -->
      <div class="flex justify-end min-w-[100px] sm:min-w-[120px]">
        <button
          onclick={handleTokenClick}
          class="flex items-center space-x-2 bg-kong-swap-container-bg hover:bg-kong-bg-secondary hover:shadow-md hover:scale-[1.02] active:scale-[0.98] rounded-full transition-all duration-200 whitespace-nowrap shadow-sm px-3 py-2 sm:px-4 sm:py-2.5 border border-transparent hover:border-kong-border-light/30 {isTokenSwitching ? 'opacity-50' : ''}">
        {#if token}
          <div class="flex items-center space-x-2">
            {#if (token as any).logo_url}
              <img 
                src={(token as any).logo_url} 
                alt={token.symbol} 
                class="w-6 h-6 sm:w-7 sm:h-7 rounded-full"
                onerror={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const fallback = document.getElementById(`token-fallback-${token.address}`);
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div id="token-fallback-{token.address}" class="w-6 h-6 sm:w-7 sm:h-7 bg-kong-brand-primary/10 rounded-full items-center justify-center hidden" style="display: none;">
                <span class="text-xs font-semibold text-kong-brand-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
              </div>
            {:else}
              <div class="w-6 h-6 sm:w-7 sm:h-7 bg-kong-brand-primary/10 rounded-full flex items-center justify-center">
                <span class="text-xs font-semibold text-kong-brand-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
              </div>
            {/if}
            <span class="text-sm sm:text-base font-semibold text-kong-text-primary">{token.symbol}</span>
          </div>
        {:else}
          <span class="text-sm sm:text-base font-semibold text-kong-text-secondary">Select token</span>
        {/if}
          <Icon 
            icon="heroicons:chevron-down" 
            class="w-4 h-4 text-kong-text-secondary" 
          />
        </button>
      </div>
    </div>
  </div>
  
  <!-- USD value and Balance below input -->
  {#if ($auth.isConnected && token) || usdValue()}
    <div class="flex items-center justify-between px-1">
      {#if usdValue()}
        <span class="text-xs sm:text-sm text-kong-text-secondary/60">
          {usdValue()}
        </span>
      {:else}
        <span></span>
      {/if}
      
      {#if $auth.isConnected && token}
        <span class="text-xs sm:text-sm text-kong-text-secondary/70">
          {formattedBalance()} {token.symbol}
        </span>
      {/if}
    </div>
  {/if}
  
  {#if error}
    <p class="text-sm flex items-center space-x-2
              {error.includes('Warning') ? 'text-kong-semantic-warning' : 'text-kong-semantic-error'}">
      <Icon 
        icon={error.includes('Warning') ? 'heroicons:exclamation-triangle-solid' : 'heroicons:exclamation-circle-solid'}
        class="w-4 h-4 flex-shrink-0" 
      />
      <span>{error}</span>
    </p>
  {/if}
</div>

{#if showTokenSelector}
  <TokenSelectorModal
    currentToken={token}
    excludeToken={null}
    onSelect={handleTokenSelected}
    onClose={() => showTokenSelector = false}
  />
{/if}

<style>
  /* Remove spinner from number input */
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }
</style>