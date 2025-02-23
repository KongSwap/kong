# Create new file
<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  // Mock tokens for demo
  const tokens = [
    { id: "ICP", name: "Internet Computer", symbol: "ICP", decimals: 8, logo: "/icp.svg" },
    { id: "KONG", name: "Kong Protocol", symbol: "KONG", decimals: 8, logo: "/kong.svg" },
    { id: "PEPE", name: "Pepe", symbol: "PEPE", decimals: 8, logo: "/pepe.svg" },
    { id: "DOGE", name: "Dogecoin", symbol: "DOGE", decimals: 8, logo: "/doge.svg" }
  ];

  let fromToken = tokens[0];
  let toToken = tokens[1];
  let fromAmount = "";
  let toAmount = "";
  let loading = false;

  // Mock price calculation
  function calculatePrice() {
    if (!fromAmount || isNaN(parseFloat(fromAmount))) {
      toAmount = "";
      return;
    }
    
    // Mock exchange rate
    const rate = 1.5;
    toAmount = (parseFloat(fromAmount) * rate).toFixed(4);
  }

  function swapTokens() {
    [fromToken, toToken] = [toToken, fromToken];
    [fromAmount, toAmount] = [toAmount, fromAmount];
  }

  async function handleSwap() {
    if (!fromAmount || !toAmount) return;
    
    loading = true;
    try {
      // Mock swap delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Reset form
      fromAmount = "";
      toAmount = "";
    } finally {
      loading = false;
    }
  }

  $: fromAmount, calculatePrice();
</script>

<div class="container mx-auto px-4 py-8" in:fade={{ duration: 200 }}>
  <div class="max-w-lg mx-auto">
    <div class="card p-6 space-y-6">
      <h2 class="text-2xl font-bold text-center font-exo text-[rgb(var(--text-primary))]">Swap Tokens</h2>
      
      <!-- From Token -->
      <div class="space-y-2">
        <label class="text-sm text-[rgb(var(--text-secondary))]">From</label>
        <div class="flex items-center space-x-4">
          <select 
            class="input flex-1"
            bind:value={fromToken}
          >
            {#each tokens as token}
              <option value={token}>{token.symbol}</option>
            {/each}
          </select>
          <input
            type="number"
            class="input flex-1"
            placeholder="0.0"
            bind:value={fromAmount}
          />
        </div>
      </div>

      <!-- Swap Button -->
      <div class="flex justify-center">
        <button 
          class="btn btn-primary p-2"
          on:click={swapTokens}
        >
          ⇅
        </button>
      </div>

      <!-- To Token -->
      <div class="space-y-2">
        <label class="text-sm text-[rgb(var(--text-secondary))]">To</label>
        <div class="flex items-center space-x-4">
          <select 
            class="input flex-1"
            bind:value={toToken}
          >
            {#each tokens as token}
              <option value={token}>{token.symbol}</option>
            {/each}
          </select>
          <input
            type="number"
            class="input flex-1"
            placeholder="0.0"
            bind:value={toAmount}
            disabled
          />
        </div>
      </div>

      <!-- Exchange Rate -->
      {#if fromAmount && toAmount}
        <div class="text-sm text-[rgb(var(--text-secondary))] text-center">
          1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken.symbol}
        </div>
      {/if}

      <!-- Swap Button -->
      <button
        class="btn btn-primary w-full"
        disabled={loading || !fromAmount || !toAmount}
        on:click={handleSwap}
      >
        {#if loading}
          <div class="flex items-center justify-center">
            <div class="w-5 h-5 border-2 border-t-2 border-[rgb(var(--text-primary))] rounded-full border-t-transparent animate-spin mr-2"></div>
            Swapping...
          </div>
        {:else}
          Swap
        {/if}
      </button>
    </div>
  </div>
</div> 
