<script lang="ts">
  import { SwapService } from "$lib/services/swap/SwapService";
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import {
    formattedTokens,
    getTokenBalance,
    getTokenPrice,
    fromTokenDecimals,
  } from "$lib/services/tokens/tokenStore";
  import {
    formatTokenAmount,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { debounce } from "lodash-es";
  import TokenSelectorButton from "./TokenSelectorButton.svelte";
  import BigNumber from "bignumber.js";

  interface SwapPanelProps {
    title: string;
    token: string;
    amount: string;
    onTokenSelect: () => void;
    onAmountChange: (event: Event) => void;
    disabled: boolean;
    showPrice: boolean;
    slippage: number;
    fees: string;
    onSettingsClick: (() => void) | undefined;
  }

  let {
    title,
    token,
    amount,
    onTokenSelect,
    onAmountChange,
    disabled,
    showPrice,
    slippage,
    fees,
    onSettingsClick,
  }: SwapPanelProps = $props();

  let formattedUsdValue: string = $state("0.00");
  let balancePlusAmount: string = $state("0");
  let calculatedUsdValue: number = $state(0);
  let isOverBalance: boolean = $state(false);
  let pendingAnimation: any = $state(null);
  const DEFAULT_DECIMALS = 8;

  // Use derived stores for memoization
  let tokenInfo = $derived($formattedTokens.find((t) => t.symbol === token));
  let decimals = $derived(tokenInfo?.decimals || DEFAULT_DECIMALS);
  let isIcrc1 = $derived(tokenInfo?.icrc1 && !tokenInfo?.icrc2);

  // Optimize formattedBalance calculation
  let formattedBalance = $derived.by(() => {
    const balance = getTokenBalance(tokenInfo?.canister_id)?.in_tokens || 0;
    const feesInTokens = tokenInfo?.fee ? BigInt(tokenInfo.fee) * (isIcrc1 ? 1n : 2n) : 0n;
    return formatTokenAmount(
      new BigNumber(balance.toString())
        .minus(fromTokenDecimals(amount || "0", decimals))
        .minus(feesInTokens.toString())
        .toString(),
      decimals,
    );
  });

  // Use $: for reactive statements to avoid unnecessary re-renders
  $effect(() => {
    const balance = getTokenBalance(tokenInfo?.canister_id)?.in_tokens || 0;
    balancePlusAmount = formatTokenAmount(
      new BigNumber(balance.toString())
        .plus(fromTokenDecimals(amount || "0", decimals))
        .toString(),
      decimals,
    );
    formattedUsdValue = getTokenBalance(tokenInfo?.canister_id)?.in_usd || "0";
    calculatedUsdValue = parseFloat(formattedUsdValue);
    isOverBalance = parseFloat(amount || "0") > parseFloat(formattedBalance.toString() || "0");
  });

  $effect(() => {
    let balance = getTokenBalance(tokenInfo?.canister_id)?.in_tokens || 0;
    balancePlusAmount = formatTokenAmount(
      new BigNumber(balance.toString())
        .plus(fromTokenDecimals(amount || "0", decimals))
        .toString(),
      decimals,
    );
    formattedUsdValue = getTokenBalance(tokenInfo?.canister_id)?.in_usd || "0";
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
  });

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

  let inputFocused: boolean = $state(false);
  let isAnimating: boolean = $state(false);
  let inputElement: HTMLInputElement | null = $state(null);

  // Optimize handleInput with debounce
  const handleInput = debounce((event: Event) => {
    if (title === "You Receive") return;
    const input = event.target as HTMLInputElement;
    const newValue = input.value;
    try {
      const price = getTokenPrice(tokenInfo?.canister_id);
      const estimatedUsdValue = price * parseFloat(newValue || "0");
      animatedUsdValue.set(estimatedUsdValue, { duration: 400 });
      animatedAmount.set(Number(newValue) || 0, { duration: 400 });
      pendingAnimation = animatedAmount.set(parseFloat(newValue) || 0);
      onAmountChange(event);
    } catch (error) {
      console.error("Error in handleInput:", error);
      toastStore.error("Invalid input amount");
    }
  }, 300);

  // Optimize handleMaxClick
  const handleMaxClick = () => {
    if (!disabled && title === "You Pay" && tokenInfo) {
      try {
        const balanceInTokens = new BigNumber(getTokenBalance(tokenInfo.canister_id)?.in_tokens.toString() || "0");
        const totalFeeInTokens = new BigNumber(tokenInfo.fee.toString()).multipliedBy(tokenInfo.icrc2 ? 2 : 1);
        let maxAmountInTokens = balanceInTokens.minus(totalFeeInTokens);
        if (maxAmountInTokens.isLessThanOrEqualTo(0)) {
          toastStore.error("Insufficient balance to cover the transaction fees");
          return;
        }
        maxAmountInTokens = maxAmountInTokens.integerValue(BigNumber.ROUND_DOWN);
        const maxAmountInDecimals = maxAmountInTokens.dividedBy(new BigNumber(10).pow(decimals));
        const formattedMaxAmount = maxAmountInDecimals.toFixed(decimals);
        inputElement.value = formattedMaxAmount;
        onAmountChange(new CustomEvent("input", { detail: { value: formattedMaxAmount } }));
        animatedAmount.set(maxAmountInDecimals.toNumber(), { duration: 400, easing: cubicOut });
      } catch (error) {
        console.error("Error in handleMaxClick:", error);
        toastStore.error("Failed to set max amount");
      }
    }
  };

  function formatDisplayValue(value: string, decimals: number = 8): string {
    const [whole, fraction = ""] = value.split(".");
    if (!fraction) return whole;

    const formattedFraction = fraction.slice(0, decimals);
    const hasMoreDecimals = fraction.length > decimals;

    return `${whole}.${formattedFraction}${hasMoreDecimals ? "..." : ""}`;
  }

  let displayAmount = $derived(
    title === "You Receive" && amount
      ? formatDisplayValue(amount)
      : isAnimating
        ? $animatedAmount.toFixed(decimals)
        : amount,
  );
  let tradeUsdValue: string = $derived(
    formatToNonZeroDecimal(
      getTokenPrice(tokenInfo?.canister_id) * parseFloat(displayAmount || "0"),
    ),
  );
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
          {#if onSettingsClick && title === "You Pay"}
            <button
              class="settings-button bg-none border-none p-2 h-10 w-10 text-white/70 cursor-pointer transition-all ease-in-out duration-200 flex items-center justify-center rounded-lg hover:text-white hover:bg-white/10"
              onclick={onSettingsClick}
              title="Swap Settings"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          {/if}
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
          <TokenSelectorButton {token} onClick={onTokenSelect} {disabled} />
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
          <span
            class="token-amount pl-1 text-white/70 font-semibold tracking-tight clickable"
            class:clickable={title === "You Pay" && !disabled}
            onclick={handleMaxClick}
          >
            {title === "You Pay"
              ? formattedBalance.toString()
              : balancePlusAmount}
            {token}
          </span>
        </div>
        <div class="flex items-center">
          <span class="separator text-white/10">|</span>
          <span class="balance-label text-white/50 font-normal tracking-wide"
            >Est Value</span
          >
          <span
            class="fiat-amount pl-2 text-white/50 font-medium tracking-wide"
          >
            ${tradeUsdValue}
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
