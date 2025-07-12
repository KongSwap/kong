<script lang="ts">
  import TokenInput from './TokenInput.svelte';
  import type { SwapFormValues, SwapFormErrors, SwapToken } from '../../types/swap.types';
  import Icon from '@iconify/svelte';
  
  interface Props {
    values: SwapFormValues;
    errors: SwapFormErrors;
    isLoading: boolean;
    receiveAmount: string;
    onPayAmountChange: (amount: string) => void;
    onPayTokenSelect: (token: SwapToken) => void;
    onReceiveTokenSelect: (token: SwapToken) => void;
    onSwitchTokens: () => void;
  }
  
  let {
    values,
    errors,
    isLoading,
    receiveAmount,
    onPayAmountChange,
    onPayTokenSelect,
    onReceiveTokenSelect,
    onSwitchTokens,
  }: Props = $props();
</script>

<div class="swap-form space-y-1">
  <!-- Pay Token Input -->
  <div class="swap-input-group">
    <label class="block text-xs font-semibold text-kong-text-secondary mb-2 uppercase tracking-wider opacity-70">
      You Pay
    </label>
    <TokenInput
      token={values.payToken}
      amount={values.payAmount}
      error={errors.payAmount}
      placeholder="0.00"
      isEditable={true}
      onAmountChange={onPayAmountChange}
      onTokenSelect={onPayTokenSelect}
      label="Pay"
    />
  </div>
  
  <!-- Switch Button -->
  <div class="relative h-8 sm:h-10 flex items-center justify-center -my-3">
    <div class="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-kong-border/20 to-transparent"></div>
    <button
      onclick={onSwitchTokens}
      class="swap-switch-button relative z-10 p-2 bg-kong-bg-primary hover:bg-kong-bg-secondary border border-kong-border/20 hover:border-kong-primary/40 rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 group"
      aria-label="Switch tokens"
    >
      <Icon 
        icon="heroicons:arrows-up-down" 
        class="w-4 h-4 text-kong-text-secondary group-hover:text-kong-primary transition-all duration-300 group-hover:rotate-180" 
      />
    </button>
  </div>
  
  <!-- Receive Token Input -->
  <div class="swap-input-group">
    <div class="flex items-center justify-between mb-2">
      <label class="text-xs font-semibold text-kong-text-secondary uppercase tracking-wider opacity-70">
        You Receive
      </label>
      {#if isLoading}
        <span class="text-xs text-kong-primary animate-pulse">
          Calculating...
        </span>
      {/if}
    </div>
    <TokenInput
      token={values.receiveToken}
      amount={receiveAmount}
      error={errors.receiveAmount}
      placeholder="0.00"
      isEditable={false}
      isLoading={isLoading}
      onTokenSelect={onReceiveTokenSelect}
      label="Receive"
    />
  </div>
  
  <!-- General Error -->
  {#if errors.general}
    <div class="mt-3 p-3 bg-kong-error/10 border border-kong-error/20 rounded-kong-roundness backdrop-blur-sm">
      <p class="text-sm text-kong-error flex items-center gap-2">
        <Icon 
          icon="heroicons:exclamation-circle" 
          class="w-4 h-4 flex-shrink-0" 
        />
        {errors.general}
      </p>
    </div>
  {/if}
</div>

<style>
  .swap-form {
    width: 100%;
  }
  
  .swap-input-group {
    transition: all 0.2s ease;
  }
  
  .swap-switch-button {
    box-shadow: inset 0 0 0 1px rgba(26, 143, 227, 0.1);
    backdrop-filter: blur(8px);
  }
  
  .swap-switch-button:hover {
    box-shadow: 
      inset 0 0 0 1px rgba(26, 143, 227, 0.2),
      0 0 20px -5px rgba(26, 143, 227, 0.3);
  }
  
  .swap-switch-button:active {
    box-shadow: inset 0 0 0 1px rgba(26, 143, 227, 0.3);
  }
</style>