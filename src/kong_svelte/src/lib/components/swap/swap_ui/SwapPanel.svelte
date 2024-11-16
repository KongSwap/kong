<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import {
    tokenStore,
    fromTokenDecimals,
  } from "$lib/services/tokens/tokenStore";
  import {
    formatTokenAmount,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import TokenSelectorButton from "./TokenSelectorButton.svelte";
  import BigNumber from "bignumber.js";
  import { walletStore } from "$lib/services/wallet/walletStore";

  export let title: string;
  export let token: FE.Token;
  export let amount: string;
  export let onTokenSelect: () => void;
  export let onAmountChange: (event: Event) => void;
  export let disabled: boolean;
  export let showPrice: boolean;
  export let slippage: number;

  let formattedUsdValue: string = "0.00";
  let balancePlusAmount: string = "0";
  let calculatedUsdValue: number = 0;
  let isOverBalance: boolean = false;
  let pendingAnimation: any = null;
  const DEFAULT_DECIMALS = 8;

  // Reactive variables
  $: tokenInfo = $tokenStore.tokens.find((t) => t.canister_id === token?.canister_id);
  $: decimals = tokenInfo?.decimals || DEFAULT_DECIMALS;
  $: isIcrc1 = tokenInfo?.icrc1 && !tokenInfo?.icrc2;

  // Formatted balance calculation
  $: formattedBalance = (() => {
    if(!$walletStore?.account) return "0";
    const balance = $tokenStore.balances[tokenInfo?.canister_id]?.in_tokens || tokenStore.loadBalance(tokenInfo, $walletStore.account.owner.toString(), true);
    const feesInTokens = tokenInfo?.fee
      ? BigInt(tokenInfo.fee) * (isIcrc1 ? 1n : 2n)
      : 0n;
    const isZero = balance.toString() === "0";
    if (isZero) return "0";
    const calculatedBalance = new BigNumber(balance.toString())
      .minus(fromTokenDecimals(amount || "0", decimals))
      .minus(feesInTokens.toString())
      .toString();
    return formatTokenAmount(calculatedBalance, decimals);
  })();

  // Reactive statements
  $: {
      const balance = $tokenStore.balances[tokenInfo?.canister_id]?.in_tokens || 0n;
      balancePlusAmount = formatTokenAmount(
        new BigNumber(balance.toString())
          .plus(fromTokenDecimals(amount || "0", decimals))
          .toString(),
        decimals,
      );
      formattedUsdValue = $tokenStore.balances[tokenInfo?.canister_id]?.in_usd || "0";
      calculatedUsdValue = parseFloat(formattedUsdValue);
      isOverBalance =
        parseFloat(amount || "0") >
        parseFloat(formattedBalance.toString() || "0");

      if (pendingAnimation && amount === "0") {
        pendingAnimation = null;
      }

      if (amount === "0") {
        animatedUsdValue.set(calculatedUsdValue, { duration: 0 });
        animatedAmount.set(parseFloat(amount || "0"), { duration: 0 });
      } else {
        animatedUsdValue.set(calculatedUsdValue, { duration: 400 });
      }

      animatedSlippage.set(slippage, { duration: 0 });
  }

  const animatedUsdValue = tweened(0, {
    duration: 120,
    easing: cubicOut,
  });

  const animatedAmount = tweened(0, {
    duration: 120,
    easing: cubicOut,
  });

  const animatedSlippage = tweened(0, {
    duration: 120,
    easing: cubicOut,
  });

  let inputFocused: boolean = false;
  let isAnimating: boolean = false;
  let inputElement: HTMLInputElement | null = null;

  // Simplify the input handler
  const handleInput = (event: Event) => {
    if (title === "You Receive") return;
    onAmountChange(event); // Just pass the event up
  };

  // Handle Max Click
  const handleMaxClick = () => {
    if (!disabled && title === "You Pay" && tokenInfo) {
      try {
        const balanceInTokens = new BigNumber(
          $tokenStore.balances[tokenInfo.canister_id]?.in_tokens.toString() ||
            "0",
        );
        const totalFeeInTokens = new BigNumber(
          tokenInfo.fee.toString(),
        ).multipliedBy(tokenInfo.icrc2 ? 2 : 1);
        let maxAmountInTokens = balanceInTokens.minus(totalFeeInTokens);
        if (maxAmountInTokens.isLessThanOrEqualTo(0)) {
          toastStore.error(
            "Insufficient balance to cover the transaction fees",
          );
          return;
        }
        maxAmountInTokens = maxAmountInTokens.integerValue(
          BigNumber.ROUND_DOWN,
        );
        const maxAmountInDecimals = maxAmountInTokens.dividedBy(
          new BigNumber(10).pow(decimals),
        );
        const formattedMaxAmount = maxAmountInDecimals.toFixed(decimals);
        if (inputElement) {
          inputElement.value = formattedMaxAmount;
        }
        onAmountChange(
          new CustomEvent("input", {
            detail: { value: formattedMaxAmount },
          }),
        );
        animatedAmount.set(maxAmountInDecimals.toNumber(), {
          duration: 400,
          easing: cubicOut,
        });
      } catch (error) {
        console.error("Error in handleMaxClick:", error);
        toastStore.error("Failed to set max amount");
      }
    }
  };

  $: displayAmount = title === "You Receive" 
    ? amount || null
    : isAnimating
      ? $animatedAmount.toFixed(decimals)
      : amount || null;

  $: parsedAmount = parseFloat(displayAmount || "0");
  $: tradeUsdValue = $tokenStore.prices[tokenInfo?.canister_id] * parsedAmount;
</script>

<Panel variant="green" width="auto" className="token-panel">
  <div
    class="panel-content flex flex-col min-h-[165px] max-h-[220px] box-border relative rounded-lg"
  >
    <header class="panel-header">
      <div
        class="title-container flex items-center justify-between gap-4 min-h-[2.5rem] mb-5"
      >
        <h2
          class="panel-title text-[1.75rem] font-semibold text-white m-0 tracking-tight leading-none"
        >
          {title}
        </h2>
        <div class="header-actions flex items-center gap-2">
          {#if showPrice && $animatedSlippage > 0}
            <div
              class="slippage-indicator flex items-center gap-1.5 bg-white/10 p-1 rounded-md"
              title="Price Impact"
            >
              <span
                class="slippage-label text-[0.875rem] font-medium text-white/70 uppercase tracking-wide"
                >Impact</span
              >
              <span
                class="slippage-value text-[1rem] font-semibold text-white"
                class:high={$animatedSlippage >= 10}
              >
                {$animatedSlippage.toFixed(2)}%
              </span>
            </div>
          {/if}
        </div>
      </div>
    </header>

    <div class="input-section relative flex-grow mb-[-1px] h-[68px]">
      <div
        class="amount-container flex items-center gap-1 h-[69%] box-border rounded-md"
      >
        <div class="input-wrapper relative flex-1">
          <input
            bind:this={inputElement}
            type="text"
            class="amount-input flex-1 min-w-0 bg-transparent border-none text-white text-[2.5rem] font-medium tracking-tight w-full relative z-10 p-0 mt-[-0.25rem] opacity-85 focus:outline-none focus:text-white disabled:text-white/65 placeholder:text-white/65"
            value={displayAmount}
            oninput={handleInput}
            onfocus={() => (inputFocused = true)}
            onblur={() => (inputFocused = false)}
            placeholder="0"
            disabled={disabled || title === "You Receive"}
            readonly={title === "You Receive"}
          />
        </div>
        <div class="button-group flex gap-2 items-center">
          <TokenSelectorButton token={token} onClick={onTokenSelect} {disabled} />
        </div>
      </div>
    </div>

    <footer class="balance-display text-white">
      <div
        class="balance-info flex justify-between items-center text-[0.875rem] leading-6"
      >
        <div class="balance-values flex gap-2 items-center">
          <span class="balance-label text-white/50 font-normal tracking-wide"
            >Available:
          </span>
          <button
            class="token-amount pl-1 text-white/70 font-semibold tracking-tight clickable"
            class:clickable={title === "You Pay" && !disabled}
            onclick={handleMaxClick}
          >
            {#if title === "You Pay"}
              {formatTokenAmount(
                $tokenStore.balances[tokenInfo?.canister_id]?.in_tokens?.toString() || "0",
                decimals,
              ) || "0"}
            {:else}
              {$tokenStore.balances[tokenInfo?.canister_id]?.in_tokens
                ? formatTokenAmount(
                    $tokenStore.balances[tokenInfo?.canister_id]?.in_tokens?.toString() || "0",
                    decimals,
                  )
                : "0"}
            {/if}
            {token?.symbol}
          </button>
        </div>
        <div class="flex items-center">
          <span class="separator text-white/10">|</span>
          <span class="balance-label text-white/50 font-normal tracking-wide"
            >Est Value</span
          >
          <span
            class="fiat-amount pl-2 text-white/50 font-medium tracking-wide"
          >
            ${formatToNonZeroDecimal(tradeUsdValue)}
          </span>
        </div>
      </div>
    </footer>
  </div>
</Panel>

<style scoped lang="postcss">
  .panel-content {
    @apply flex flex-col min-h-[165px] max-h-[220px] box-border relative rounded-lg;
  }

  .amount-input.error {
    @apply text-red-500;
  }

  .token-amount.clickable:hover {
    @apply text-yellow-500;
  }

  .slippage-value.high {
    @apply text-red-500;
  }

  @media (max-width: 768px) {
    .panel-content {
      @apply min-h-[145px];
    }

    .panel-title {
      @apply text-base;
    }

    .amount-input {
      @apply text-2xl mt-[-0.2rem];
    }

    .slippage-indicator {
      @apply p-1;
    }

    .slippage-label {
      @apply text-xs;
    }

    .slippage-value {
      @apply text-sm;
    }

    :global(.token-panel .button-group) {
      @apply scale-90 origin-right;
    }
  }

  @media (max-width: 480px) {
    .panel-content {
      @apply min-h-[135px] p-3;
    }

    .title-container {
      @apply min-h-[2rem] gap-2;
    }

    .panel-title {
      @apply text-lg tracking-tight;
    }

    .amount-input {
      @apply text-lg mt-[-0.15rem];
    }

    .slippage-indicator {
      @apply p-0.5;
    }

    .slippage-label {
      @apply text-xs;
    }

    .slippage-value {
      @apply text-sm;
    }

    :global(.token-panel .button-group) {
      @apply scale-90;
    }

    .amount-container {
      @apply gap-0.5;
    }

    .balance-values {
      @apply gap-1;
    }

    .input-section {
      @apply h-[58px] mb-0;
    }

    .amount-container {
      @apply h-[75%];
    }
  }

  :global(.token-panel) {
    @apply relative;
  }

  :global(.token-panel:first-of-type::after) {
    content: "";
    @apply absolute bottom-[-24px] left-1/2 transform translate-x-[-50%] w-12 h-12 bg-contain bg-no-repeat bg-center z-20;
    background-image: url("/assets/yellow-arrow-down.png");
  }

  @media (max-width: 480px) {
    :global(.token-panel:first-of-type::after) {
      @apply w-9 h-9 bottom-[-18px];
    }
  }
</style>
