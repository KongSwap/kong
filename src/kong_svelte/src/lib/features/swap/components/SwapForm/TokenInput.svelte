<script lang="ts">
  import type { SwapToken } from '../../types/swap.types';
  import { currentUserBalancesStore } from '$lib/stores/balancesStore';
  import { auth } from '$lib/stores/auth';
  import TokenSelectorModal from '../TokenSelectorModal.svelte';
  import BigNumber from 'bignumber.js';
  import Icon from '@iconify/svelte';
  import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
  
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
  
  // Get user balance
  let balance = $derived(
    !token || !$auth.isConnected ? null :
    !$currentUserBalancesStore?.[token.address] ? '0' :
    new BigNumber($currentUserBalancesStore[token.address].in_tokens.toString())
      .div(new BigNumber(10).pow(token.decimals))
      .toString()
  );

  $inspect(balance);
  
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
  
  function handleAmountInput(event: Event) {
    if (!isEditable) return;
    
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
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

<div class="token-input-container">
  <div class="token-input relative bg-kong-bg-tertiary/40 rounded-kong-roundness p-3 sm:p-4 transition-all duration-200 hover:bg-kong-bg-tertiary/50 focus-within:bg-kong-bg-tertiary/50 focus-within:ring-2 focus-within:ring-kong-primary/20 {error ? 'ring-2 ring-kong-error/40 hover:ring-kong-error/40' : ''}">
    <div class="flex items-start justify-between gap-2 sm:gap-3">
      <!-- Amount Input -->
      <div class="flex-1 min-w-0">
        {#if isLoading && !isEditable}
          <!-- Skeleton loader for loading quote -->
          <div class="flex items-center h-[32px] sm:h-[36px]">
            <div class="animate-pulse">
              <div class="h-6 sm:h-7 bg-kong-bg-secondary rounded w-24 sm:w-32"></div>
            </div>
          </div>
        {:else}
          <input
            type="text"
            inputmode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            {placeholder}
            value={amount || ''}
            oninput={handleAmountInput}
            readonly={!isEditable}
            disabled={isLoading}
            class="w-full bg-transparent text-xl sm:text-2xl font-semibold outline-none placeholder-kong-text-tertiary transition-colors
                   {!isEditable ? 'cursor-not-allowed text-kong-text-secondary' : 'text-kong-text-primary'}"
            aria-label="{label} amount"
          />
        {/if}
        
        {#if $auth.isConnected && token}
          <div class="mt-1 sm:mt-2">
            <span class="text-[10px] sm:text-xs text-kong-text-secondary">
              Balance: <span class="font-medium text-kong-text-primary">{formattedBalance()}</span>
            </span>
          </div>
        {/if}
      </div>
      
      <!-- Token Selector -->
      <div class="flex flex-col items-end gap-2">
        <button
          onclick={handleTokenClick}
          class="token-selector flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 bg-kong-bg-secondary hover:bg-kong-bg-primary rounded-kong-roundness transition-all duration-200 group min-w-[100px] sm:min-w-[120px]"
        >
        {#if token}
          <div class="flex items-center gap-1.5 sm:gap-2">
            {#if (token as any).logo_url}
              <img 
                src={(token as any).logo_url} 
                alt={token.symbol} 
                class="w-6 sm:w-7 h-6 sm:h-7 rounded-full ring-1 ring-kong-border/20 group-hover:ring-kong-primary/20 transition-all"
                onerror={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const fallback = document.getElementById(`token-fallback-${token.address}`);
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div id="token-fallback-{token.address}" class="w-6 sm:w-7 h-6 sm:h-7 bg-gradient-to-br from-kong-primary/20 to-kong-primary/10 rounded-full items-center justify-center" style="display: none;">
                <span class="text-[10px] sm:text-xs font-bold text-kong-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
              </div>
            {:else}
              <div class="w-6 sm:w-7 h-6 sm:h-7 bg-gradient-to-br from-kong-primary/20 to-kong-primary/10 rounded-full flex items-center justify-center">
                <span class="text-[10px] sm:text-xs font-bold text-kong-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
              </div>
            {/if}
            <span class="text-sm sm:text-base font-semibold text-kong-text-primary group-hover:text-kong-primary transition-colors">{token.symbol}</span>
          </div>
        {:else}
          <span class="text-sm sm:text-base font-medium text-kong-text-secondary group-hover:text-kong-text-primary transition-colors">Select Token</span>
        {/if}
          <Icon 
            icon="heroicons:chevron-down" 
            class="w-3.5 sm:w-4 h-3.5 sm:h-4 text-kong-text-tertiary group-hover:text-kong-primary transition-all duration-200 sm:group-hover:rotate-180" 
          />
        </button>
        
        {#if $auth.isConnected && token && isEditable && balance && balance !== '0'}
          <div class="flex items-center gap-1">
            <button
              onclick={() => handlePercentageClick(25)}
              class="text-[9px] sm:text-[10px] font-semibold text-kong-primary hover:text-kong-primary/80 transition-colors px-1 sm:px-1.5 py-0.5 rounded-full bg-kong-primary/10 hover:bg-kong-primary/20"
            >
              25%
            </button>
            <button
              onclick={() => handlePercentageClick(50)}
              class="text-[9px] sm:text-[10px] font-semibold text-kong-primary hover:text-kong-primary/80 transition-colors px-1 sm:px-1.5 py-0.5 rounded-full bg-kong-primary/10 hover:bg-kong-primary/20"
            >
              50%
            </button>
            <button
              onclick={() => handlePercentageClick(75)}
              class="text-[9px] sm:text-[10px] font-semibold text-kong-primary hover:text-kong-primary/80 transition-colors px-1 sm:px-1.5 py-0.5 rounded-full bg-kong-primary/10 hover:bg-kong-primary/20"
            >
              75%
            </button>
            <button
              onclick={() => handlePercentageClick(100)}
              class="text-[9px] sm:text-[10px] font-semibold text-kong-primary hover:text-kong-primary/80 transition-colors px-1 sm:px-1.5 py-0.5 rounded-full bg-kong-primary/10 hover:bg-kong-primary/20"
            >
              100%
            </button>
          </div>
        {/if}
      </div>
    </div>
    
  </div>
  
  {#if error}
    <p class="mt-2 text-sm text-kong-error flex items-center gap-1 animate-slideIn">
      <Icon 
        icon="heroicons-solid:exclamation-circle" 
        class="w-3 h-3" 
      />
      {error}
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
  .token-input-container {
    position: relative;
  }
  
  /* Remove spinner from number input */
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }
  
  
  /* Smooth number transitions */
  input {
    font-variant-numeric: tabular-nums;
    transition: color 0.2s ease;
  }
  
  /* Token selector hover effect - desktop only */
  @media (min-width: 640px) {
    .token-selector {
      position: relative;
      overflow: hidden;
    }
    
    .token-selector::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
      transition: left 0.5s ease;
    }
    
    .token-selector:hover::before {
      left: 100%;
    }
  }
  
  /* Focus glow effect - subtle on mobile */
  .token-input:focus-within {
    box-shadow: 0 0 0 2px rgba(var(--color-primary), 0.1);
  }
  
  /* Slide in animation */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-slideIn {
    animation: slideIn 0.2s ease-out;
  }
</style>