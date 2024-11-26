<script lang="ts">
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  let token0: any = null;
  let token1: any = null;
  let amount0 = "";
  let amount1 = "";
  let loading = false;
  let error: string | null = null;

  onMount(() => {
    // Check URL parameters for initial tokens
    const searchParams = $page.url.searchParams;
    const token0Address = searchParams.get("token0");
    const token1Address = searchParams.get("token1");

    if (token0Address && $formattedTokens) {
      token0 = $formattedTokens.find((t) => t.canister_id === token0Address);
    }
    if (token1Address && $formattedTokens) {
      token1 = $formattedTokens.find((t) => t.canister_id === token1Address);
    }
  });

  function handleTokenSelect() {
    // This will be implemented when we add token selection
  }

  function handleInput() {
    // This will be implemented for handling input changes
  }

  async function handleSubmit() {
    // This will be implemented for handling form submission
  }

  function handleBack() {
    goto("/earn");
  }
</script>

<div class="container">
  <div class="header">
    <button class="back-button" on:click={handleBack}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <span>Back to Pools</span>
    </button>
    <h1>Add Liquidity</h1>
  </div>

  <div class="form-container">
    <AddLiquidityForm
      {token0}
      {token1}
      {amount0}
      {amount1}
      {loading}
      previewMode={false}
      {error}
      token0Balance="0"
      token1Balance="0"
      onTokenSelect={handleTokenSelect}
      onInput={handleInput}
      onSubmit={handleSubmit}
    />
  </div>
</div>

<style lang="postcss">
  .container {
    @apply max-w-2xl mx-auto px-4 py-6 w-full;
  }

  .header {
    @apply mb-8 flex flex-col gap-4;
  }

  .back-button {
    @apply flex items-center gap-2 text-white/60 hover:text-white 
             transition-colors duration-200 w-fit;
  }

  h1 {
    @apply text-2xl font-semibold text-white;
  }

  .form-container {
    @apply bg-[#1a1b23]/60 border border-[#2a2d3d] rounded-xl p-6
             backdrop-blur-sm shadow-lg;
    box-shadow:
      0 32px 64px -16px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(96, 165, 250, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  @media (max-width: 640px) {
    .container {
      @apply px-2 py-4;
    }

    .header {
      @apply mb-4;
    }

    .form-container {
      @apply p-4;
    }
  }
</style>
