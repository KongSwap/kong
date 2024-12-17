<script lang="ts">
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import {
    formatTokenAmount,
    parseTokenAmount,
  } from "$lib/utils/numberFormatUtils";
  import Portal from "svelte-portal";
  import TokenSelectorDropdown from "$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte";
  import { PoolService } from "$lib/services/pools/PoolService";
  import LiquidityPanel from "./LiquidityPanel.svelte";
  import { addLiquidityStore } from "$lib/services/pools/addLiquidityStore";
  import { goto } from "$app/navigation";
  import { tokenStore } from "$lib/services/tokens";
  import { auth } from "$lib/services/auth";

  export let token0: FE.Token | null = null;
  export let token1: FE.Token | null = null;
  export let amount0: string = "0";
  export let amount1: string = "0";
  export const token0Balance: string = "0";
  export const token1Balance: string = "0";

  let loading = false;
  let error: string | null = null;

  interface Panel {
    id: 0 | 1;
    type: "pay" | "receive";
    title: string;
  }

  let panels: Panel[] = [
    {
      id: 0,
      type: "pay",
      title: "Token 1",
    },
    {
      id: 1,
      type: "receive",
      title: "Token 2",
    },
  ];

  async function handleInput(index: 0 | 1, event: CustomEvent) {
    console.log("handleInput called with:", {
      index,
      event,
      detail: event.detail,
    });

    const input = event.detail?.value;
    console.log("Got input value:", input);

    if (!input) {
      if (index === 0) amount0 = "0";
      else amount1 = "0";
      return;
    }

    // Update the amount immediately
    if (index === 0) {
      amount0 = input;
      console.log("Set amount0 to:", amount0);
    } else {
      amount1 = input;
      console.log("Set amount1 to:", amount1);
    }

    // Only calculate if we have both tokens and input is not empty
    if (token0 && token1 && input !== "") {
      try {
        console.log("Starting calculation with tokens:", { token0, token1 });
        const parsedAmount = parseTokenAmount(
          input,
          index === 0 ? token0.decimals : token1.decimals,
        );
        console.log("Parsed amount:", parsedAmount.toString());

        // Log which token we're calculating from/to
        console.log(
          "Calculating from:",
          index === 0 ? token0.token : token1.token,
        );
        console.log(
          "Calculating to:",
          index === 0 ? token1.token : token0.token,
        );

        const result = await PoolService.calculateLiquidityAmounts(
          index === 0 ? token0.token : token1.token,
          parsedAmount,
          index === 0 ? token1.token : token0.token,
        );

        console.log("Got result:", result);

        if (result.Ok) {
          console.log("Result amounts:", {
            amount_0: result.Ok.amount_0.toString(),
            amount_1: result.Ok.amount_1.toString(),
          });

          // When index is 0 (top token), we want amount_1 for the bottom token
          // When index is 1 (bottom token), we want amount_0 for the top token
          const otherAmount =
            index === 0 ? result.Ok.amount_1 : result.Ok.amount_0;
          const otherDecimals = index === 0 ? token1.decimals : token0.decimals;

          if (index === 0) {
            amount1 = formatTokenAmount(otherAmount, otherDecimals);
            console.log("Updated amount1 to:", amount1);
          } else {
            amount0 = formatTokenAmount(otherAmount, otherDecimals);
            console.log("Updated amount0 to:", amount0);
          }
        } else if (result.Err) {
          console.error("Error calculating liquidity:", result.Err);
          error = "Failed to calculate liquidity amounts";
        }
      } catch (err) {
        console.error("Error in handleInput:", err);
        error = "Failed to calculate liquidity amounts";
      }
    }
  }

  function handleTokenSelectorClick(
    event: CustomEvent<{ button: HTMLElement }>,
    index: 0 | 1,
  ) {
    const button = event.detail.button;
    const rect = button.getBoundingClientRect();
    const position = {
      x: rect.left,
      y: rect.bottom + window.scrollY,
    };
    addLiquidityStore.toggleTokenSelector(index, position);
  }

  function handleTokenSelected(token: FE.Token, index: 0 | 1) {
    console.log("Token selected:", { token, index });
    if (index === 0) {
      token0 = token;
    } else {
      token1 = token;
    }

    addLiquidityStore.closeTokenSelector();
    console.log("After token selection:", { token0, token1 });
  }

  async function handleSubmit() {
    try {
      loading = true;
      error = null;

      const parsedAmount0 = parseTokenAmount(amount0, token0.decimals);
      const parsedAmount1 = parseTokenAmount(amount1, token1.decimals);

      const addLiquidityArgs = {
        token_0: token0,
        amount_0: parsedAmount0,
        token_1: token1,
        amount_1: parsedAmount1,
      };

      const result = await PoolService.addLiquidity(addLiquidityArgs);

      await Promise.all([
        tokenStore.loadBalance(token0, auth.pnp.account.principalId, true),
        tokenStore.loadBalance(token1, auth.pnp.account.principalId, true),
      ]);

      if (typeof result === "bigint") {
        // Reset state before navigation
        amount0 = "0";
        amount1 = "0";
        addLiquidityStore.reset();
        // Add a small delay to ensure UI updates before navigation
        await new Promise((resolve) => setTimeout(resolve, 100));
        goto("/earn");
      } else {
        error = result;
      }
    } catch (err) {
      console.error("Error submitting liquidity:", err);
      // If it's a wallet connection issue, show a more user-friendly message
      if (err.message?.includes("reconnect")) {
        error = "Please disconnect and reconnect your wallet";
      } else {
        error = err instanceof Error ? err.message : "Failed to add liquidity";
      }
    } finally {
      loading = false;
    }
  }

  function handleBack() {
    goto("/earn");
  }

  $: {
    console.log("Button text calculation:", {
      token0,
      token1,
      amount0,
      amount1,
      amount0Type: typeof amount0,
      amount1Type: typeof amount1,
      amount0Value: Number(amount0),
      amount1Value: Number(amount1),
      condition1: !token0 || !token1,
      condition2: amount0 === "" || amount1 === "",
      condition3: Number(amount0) === 0 || Number(amount1) === 0,
    });
  }

  $: buttonText = error
    ? error
    : !token0 || !token1
      ? "Select Tokens"
      : !amount0 ||
          !amount1 ||
          parseFloat(amount0) <= 0 ||
          parseFloat(amount1) <= 0
        ? "Enter Amounts"
        : "Add Liquidity";

  // Add store subscription
  $: tokenSelectorState = $addLiquidityStore;

  let liquidityMode: "full" | "custom" = "full";
  let isTransitioning = false;
  let previousMode: "full" | "custom" = "full";

  function handleModeChange(mode: "full" | "custom") {
    if (mode === liquidityMode || isTransitioning) return;
    isTransitioning = true;
    previousMode = liquidityMode;
    setTimeout(() => {
      liquidityMode = mode;
      setTimeout(() => {
        isTransitioning = false;
      }, 300);
    }, 150);
  }

  async function handleReverseTokens() {
    if (loading) return;

    const tempToken = token0;
    const tempAmount = amount0;

    token0 = token1;
    token1 = tempToken;
    amount0 = amount1;
    amount1 = tempAmount;
  }

  // Add initial amount calculation
  onMount(async () => {
    if (token0 && token1) {
      try {
        const result = await PoolService.calculateLiquidityAmounts(
          token0.token,
          parseTokenAmount("1", token0.decimals),
          token1.token,
        );

        if (result.Ok) {
          amount0 = "1";
          amount1 = formatTokenAmount(result.Ok.amount_1, token1.decimals);
        } else if (result.Err) {
          console.error(
            "Error calculating initial liquidity amounts:",
            result.Err,
          );
        }
      } catch (err) {
        console.error("Error calculating initial liquidity amounts:", err);
      }
    }
  });
</script>

<div class="swap-wrapper">
  <div class="swap-container" in:fade={{ duration: 420 }}>
    <div class="header">
      <button class="back-button" on:click={handleBack}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 18L9 12L15 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Back to Pools
      </button>
      <h2>Add Liquidity</h2>
    </div>

    <div class="panels-container">
      {#each panels as panel (panel.id)}
        <div class="panel">
          <LiquidityPanel
            title={panel.title}
            token={panel.id === 0 ? token0 : token1}
            amount={panel.id === 0 ? amount0 : amount1}
            panelType={panel.type}
            on:amountChange={(e) => handleInput(panel.id as 0 | 1, e)}
            on:tokenSelect={(e) =>
              handleTokenSelectorClick(e, panel.id as 0 | 1)}
          />
        </div>
      {/each}
    </div>

    <div class="swap-footer">
      <button
        class="swap-button"
        class:error
        class:processing={loading}
        class:ready={!error}
        on:click={handleSubmit}
        disabled={!token0 ||
          !token1 ||
          parseFloat(amount0) <= 0 ||
          parseFloat(amount1) <= 0 ||
          loading}
      >
        <div class="button-content">
          {#key buttonText}
            <span class="button-text" in:fade={{ duration: 200 }}>
              {buttonText}
            </span>
          {/key}
          {#if loading}
            <div class="loading-spinner"></div>
          {/if}
        </div>
        {#if !error}
          <div class="button-glow"></div>
        {/if}
      </button>
    </div>
  </div>
</div>

{#if $addLiquidityStore.showToken0Selector}
  <Portal target="body">
    <TokenSelectorDropdown
      tokens={$tokenStore.tokens}
      position={$addLiquidityStore.tokenSelectorPosition}
      onClose={() => addLiquidityStore.closeTokenSelector()}
      onSelect={(token) => handleTokenSelected(token, 0)}
    />
  </Portal>
{/if}

{#if $addLiquidityStore.showToken1Selector}
  <Portal target="body">
    <TokenSelectorDropdown
      tokens={$tokenStore.tokens}
      position={$addLiquidityStore.tokenSelectorPosition}
      onClose={() => addLiquidityStore.closeTokenSelector()}
      onSelect={(token) => handleTokenSelected(token, 1)}
    />
  </Portal>
{/if}

<div class="mode-selector">
  <div
    class="mode-selector-background"
    style="transform: translateX({liquidityMode === 'custom' ? '100%' : '0'})"
  ></div>
  <button
    class="mode-button"
    class:selected={liquidityMode === "full"}
    class:transitioning={isTransitioning && previousMode === "custom"}
    on:click={() => handleModeChange("full")}
  >
    <span class="mode-text">Full Range</span>
  </button>
  <button
    class="mode-button"
    class:selected={liquidityMode === "custom"}
    class:transitioning={isTransitioning && previousMode === "full"}
    on:click={() => handleModeChange("custom")}
  >
    <span class="mode-text">Custom Range</span>
  </button>
</div>

<button
  class="switch-button"
  on:click={handleReverseTokens}
  aria-label="Switch token positions"
>
  <div class="switch-button-inner">
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      class="swap-arrow"
    >
      <path
        d="M7 10l5 5 5-5M7 14l5 5 5-5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
  </div>
</button>

<style lang="postcss">
  .swap-container {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    gap: 12px;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .panels-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  .panel {
    position: relative;
    z-index: 1;
  }

  .swap-button {
    @apply relative overflow-hidden;
    @apply w-full py-3 px-4 rounded-lg;
    @apply transition-all duration-200 ease-out;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    margin-top: 4px;
    background: linear-gradient(
      135deg,
      rgba(55, 114, 255, 0.95) 0%,
      rgba(69, 128, 255, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 6px rgba(55, 114, 255, 0.2);
    transform: translateY(0);
  }

  .swap-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(85, 134, 255, 1) 0%,
      rgba(99, 148, 255, 1) 100%
    );
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow:
      0 4px 12px rgba(55, 114, 255, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    z-index: 1;
  }

  .button-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 120px;
    text-align: center;
  }

  .loading-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .button-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at center,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0) 70%
    );
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .swap-button:hover .button-glow {
    opacity: 1;
  }

  .swap-button.error {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.9) 0%,
      rgba(239, 68, 68, 0.8) 100%
    );
    box-shadow: none;
    border: none;
  }

  .swap-button.processing {
    background: linear-gradient(135deg, #3772ff 0%, #4580ff 100%);
    cursor: wait;
    opacity: 0.8;
    animation: pulse 2s infinite ease-in-out;
  }

  @keyframes pulse {
    0% {
      opacity: 0.8;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      opacity: 0.8;
    }
  }
</style>
