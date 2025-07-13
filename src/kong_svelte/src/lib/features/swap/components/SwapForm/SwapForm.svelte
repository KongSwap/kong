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
    onSwitchTokens?: () => void;
  }
  
  let {
    values,
    errors,
    isLoading,
    receiveAmount,
    onPayAmountChange,
    onPayTokenSelect,
    onReceiveTokenSelect,
    onSwitchTokens = () => {},
  }: Props = $props();
  
</script>

<div class="space-y-1 relative">
  <!-- Pay Token Input -->
  <div class="bg-kong-swap-input-bg rounded-2xl p-3 sm:p-4 transition-all duration-200">
    <TokenInput
      token={values.payToken}
      amount={values.payAmount}
      error={errors.payAmount}
      placeholder="0"
      isEditable={true}
      isLoading={false}
      label="Pay"
      onAmountChange={onPayAmountChange}
      onTokenSelect={onPayTokenSelect}
    />
  </div>
  
  <!-- Centered Token Switcher -->
  <div class="relative flex justify-center items-center h-0 z-10">
    <button
      onclick={onSwitchTokens}
      class="absolute w-8 h-8 sm:w-10 sm:h-10 bg-kong-bg-secondary border border-kong-border rounded-full flex items-center justify-center hover:bg-kong-bg-primary transition-all duration-200 translate-y-0.5 shadow-sm"
      aria-label="Switch tokens"
    >
      <Icon 
        icon="heroicons:arrow-path" 
        class="w-4 h-4 sm:w-5 sm:h-5 text-kong-text-primary transform rotate-90" 
      />
    </button>
  </div>
  
  <!-- Receive Token Input -->
  <div class="bg-kong-swap-input-bg rounded-2xl p-3 sm:p-4 transition-all duration-200">
    <TokenInput
      token={values.receiveToken}
      amount={receiveAmount}
      error={errors.receiveAmount}
      placeholder="0"
      isEditable={false}
      isLoading={isLoading}
      label="Receive"
      onAmountChange={() => {}}
      onTokenSelect={onReceiveTokenSelect}
    />
  </div>
  
  <!-- General Error -->
  {#if errors.general}
    <div class="mt-3 p-3 sm:p-4 bg-kong-semantic-error/5 border border-kong-semantic-error/20 rounded-xl">
      <p class="text-sm text-kong-semantic-error flex items-center space-x-2 font-medium">
        <Icon 
          icon="heroicons:exclamation-circle-solid" 
          class="w-4 h-4 flex-shrink-0" 
        />
        <span class="break-words">{errors.general}</span>
      </p>
    </div>
  {/if}
</div>


