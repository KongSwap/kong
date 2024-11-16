<script lang="ts">
  import { Plus } from "lucide-svelte";
  import TokenQtyInput from "$lib/components/common/TokenQtyInput.svelte";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";

  export let token0: FE.Token | null = null;
  export let token1: FE.Token | null = null;
  export let amount0: string = "";
  export let amount1: string = "";
  export let loading: boolean = false;
  export let previewMode: boolean = false;
  export let error: string | null = null;
  export let statusSteps: Array<{ label: string; completed: boolean }> = [];
  export let token0Balance: string = "0";
  export let token1Balance: string = "0";
  export let onTokenSelect: (index: 0 | 1) => void;
  export let onInput: (index: 0 | 1, value: string) => void;
  export let onSubmit: () => void;
  export let onConfirm: () => void;
  export let onCancel: () => void;
  export let getCurrentStep: () => string;
  export let isProcessingOutput: boolean = false;
  export let showReview: boolean = false;

  $: hasInsufficientBalance = () => {
    if (!token0 || !token1 || !amount0 || !amount1) return false;
    
    const parsedAmount0 = parseTokenAmount(amount0, token0.decimals) - token0.fee;
    const parsedAmount1 = parseTokenAmount(amount1, token1.decimals) - token1.fee;
    const parsedBalance0 = BigInt(token0Balance);
    const parsedBalance1 = BigInt(token1Balance);

    return parsedAmount0 > parsedBalance0 || parsedAmount1 > parsedBalance1;
  };

  $: isValid = token0 && token1 && amount0 && amount1 && !error && !hasInsufficientBalance();
  $: insufficientBalanceError = hasInsufficientBalance() ? 
    `Insufficient balance for ${
      parseTokenAmount(amount0, token0?.decimals) > BigInt(token0Balance) ? token0?.symbol : token1?.symbol
    }` : null;
</script>

<div class="space-y-6">

    {#if error}
    <div class=" p-3 bg-red-500/30 border border-red-500/50 rounded-lg">
      <p class="text-red-300 text-sm">{error}</p>
    </div>
  {/if}

  {#if insufficientBalanceError}
    <div class="p-3 bg-red-500/30 border border-red-500/50 rounded-lg">
      <p class="text-red-300 text-sm">{insufficientBalanceError}</p>
    </div>
  {/if}

  
  <!-- Token 0 Input -->
  {#if token0}
    <TokenQtyInput
      token={token0}
      value={amount0}
      disabled={loading || (previewMode && isProcessingOutput)}
      on:input={(e) => onInput(0, e.detail.value)}
      onTokenSelect={() => onTokenSelect(0)}
      balance={token0Balance}
      onMaxClick={() => onInput(0, token0Balance)}
    />
  {:else}
    <button
      class="w-full p-4 border-2 border-white/10 rounded-lg text-white/50 hover:border-yellow-400"
      on:click={() => onTokenSelect(0)}
    >
      Select Token
    </button>
  {/if}

  <!-- Plus Icon -->
  <div class="flex justify-center">
    <div class="bg-white/5 p-2 rounded-full">
      <Plus class="w-6 h-6 text-white/50" />
    </div>
  </div>

  <!-- Token 1 Input -->
  {#if token1}
    <TokenQtyInput
      token={token1}
      value={amount1}
      disabled={loading || (previewMode && isProcessingOutput)}
      on:input={(e) => onInput(1, e.detail.value)}
      onTokenSelect={() => onTokenSelect(1)}
      balance={token1Balance}
      onMaxClick={() => onInput(1, token1Balance)}
    />
  {:else}
    <button
      class="w-full p-4 border-2 border-white/10 rounded-lg text-white/50 hover:border-yellow-400"
      on:click={() => onTokenSelect(1)}
    >
      Select Token
    </button>
  {/if}

  <!-- Review/Progress Section -->
  {#if showReview || previewMode}
    <div class="mt-4 p-4 bg-white/5 rounded-lg space-y-4">
      {#if showReview}
        <div class="space-y-4">
          <h3 class="font-medium text-white">Review Transaction</h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-white/80">You will add:</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-white/80">{amount0} {token0?.symbol}</span>
              <img
                src={token0?.logo}
                alt={token0?.symbol}
                class="w-6 h-6 rounded-full"
              />
            </div>
            <div class="flex justify-between items-center">
              <span class="text-white/80"
                >{amount1}
                {token1?.symbol}</span
              >
              <img
                src={token1?.logo}
                alt={token1?.symbol}
                class="w-6 h-6 rounded-full"
              />
            </div>
          </div>
          <div class="flex space-x-4">
            <button
              class="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              on:click={onCancel}
            >
              Cancel
            </button>
            <button
              class="flex-1 py-2 px-4 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300"
              on:click={onConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      {:else if previewMode}
        <div class="space-y-2">
          <h3 class="font-medium text-white">Transaction Progress</h3>
          <ul class="space-y-2">
            {#each statusSteps as step}
              <li class="flex items-center">
                <span class="mr-2">
                  {#if step.failed}
                    ❌
                  {:else if step.completed}
                    ✅
                  {:else}
                    ⏳
                  {/if}
                </span>
                <span class="text-white/80">{step.label}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Action Button -->
  {#if !showReview && !previewMode}
    <div class="flex space-x-4">
      <button
        class="flex-1 py-3 px-4 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={onSubmit}
        disabled={!isValid || loading || hasInsufficientBalance()}
      >
        {#if hasInsufficientBalance()}
          Insufficient Balance
        {:else}
          Review Transaction
        {/if}
      </button>
    </div>
  {/if}
</div>
