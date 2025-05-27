<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { truncateAddress } from "$lib/utils/principalUtils";
  import { formatPrincipalId } from "$lib/utils/transactionUtils";
  import { WalletIcon } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import ButtonV2 from "../common/ButtonV2.svelte";

  interface Props {
    tx: FE.Transaction;
    token: Kong.Token;
    tokens: Kong.Token[];
    isHighlighted?: boolean;
    mobile?: boolean;
  }

  let { tx, token, tokens, isHighlighted = false, mobile = false }: Props = $props();

  // Computed values
  const payToken = $derived(tokens.find((t) => t.id === tx.pay_token_id));
  const receiveToken = $derived(tokens.find((t) => t.id === tx.receive_token_id));
  const isBuy = $derived(tx.receive_token_id === token.id);
  
  const formatAmount = (amount: number) => amount.toFixed(amount < 0.01 ? 6 : 4);
  
  const usdValue = $derived.by(() => {
    if (!payToken || !receiveToken) return "0.00";
    
    const payUsdValue = payToken.symbol === "ckUSDT" 
      ? tx.pay_amount 
      : tx.pay_amount * (Number(payToken.metrics.price) || 0);
    
    const receiveUsdValue = receiveToken.symbol === "ckUSDT" 
      ? tx.receive_amount 
      : tx.receive_amount * (Number(receiveToken.metrics.price) || 0);
    
    return formatUsdValue(Math.max(payUsdValue, receiveUsdValue));
  });

  const formattedDate = $derived(
    new Date(tx.timestamp + (tx.timestamp.includes('Z') ? '' : 'Z'))
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric", 
        hour: "2-digit",
        minute: "2-digit",
      })
  );

  const handleWalletClick = () => goto(`/wallets/${formatPrincipalId(tx.user.principal_id)}`);
  const handleExplorerClick = () => {
    window.open(
      `https://www.icexplorer.io/address/detail/${formatPrincipalId(tx.user.principal_id)}`,
      "_blank"
    );
  };
</script>

<div
  class={`border-b border-kong-border/20 hover:bg-kong-bg-secondary/20 transition-all duration-200 ${
    isHighlighted ? "transaction-highlight" : ""
  }`}
>
  <div class={mobile ? "p-4" : "px-4 py-4"}>
    {#if mobile}
      <!-- Mobile Layout -->
      <div class="flex flex-col gap-3">
        <div class="flex justify-between items-center">
          <span
            class={`px-2 py-1 rounded-md text-xs font-medium ${
              isBuy
                ? "bg-kong-success/10 text-kong-success"
                : "bg-kong-error/10 text-kong-error"
            }`}
          >
            {token.symbol} {isBuy ? "BUY" : "SELL"}
          </span>
          <span class="text-xs text-kong-text-primary/60 font-medium">
            {formattedDate}
          </span>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm">
            {#if isBuy}
              <span class="text-kong-text-primary/70 font-medium">
                {formatAmount(tx.pay_amount)} {payToken?.symbol}
              </span>
              <span class="text-kong-text-primary/50">→</span>
              <span class="font-semibold text-kong-text-primary">
                {formatAmount(tx.receive_amount)} {receiveToken?.symbol}
              </span>
            {:else}
              <span class="font-semibold text-kong-text-primary">
                {formatAmount(tx.pay_amount)} {payToken?.symbol}
              </span>
              <span class="text-kong-text-primary/50">→</span>
              <span class="text-kong-text-primary/70 font-medium">
                {formatAmount(tx.receive_amount)} {receiveToken?.symbol}
              </span>
            {/if}
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-kong-border/10">
          <span class="text-sm font-semibold text-kong-text-primary">{usdValue}</span>
          <div class="flex items-center gap-2">
            <button
              title="View wallet"
              class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1.5 rounded-md hover:bg-kong-bg-secondary/30"
              on:click|preventDefault={handleWalletClick}
            >
              <WalletIcon class="w-4 h-4" />
            </button>
            <button
              title="View on explorer"
              class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1.5 rounded-md hover:bg-kong-bg-secondary/30"
              on:click|preventDefault={handleExplorerClick}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    {:else}
      <!-- Desktop Layout -->
      <div class="grid grid-cols-2 gap-x-8 items-center">
        <div class="flex flex-col gap-y-1">
          <div class="flex items-center gap-x-2">
            <span
              class={`px-2 py-1 rounded-md text-xs font-medium ${
                isBuy
                  ? "bg-kong-success/10 text-kong-success"
                  : "bg-kong-error/10 text-kong-error"
              }`}
            >
              {isBuy ? "BUY" : "SELL"}
            </span>

            <div class="flex items-center gap-2 text-sm w-full">
              {#if isBuy}
                <span class="text-kong-text-primary/70 font-medium text-nowrap">
                  {formatAmount(tx.pay_amount)} {payToken?.symbol}
                </span>
                <span class="text-kong-text-primary/50">→</span>
                <span class="font-semibold text-kong-text-primary text-nowrap">
                  {formatAmount(tx.receive_amount)} {receiveToken?.symbol}
                </span>
              {:else}
                <span class="font-semibold text-kong-text-primary text-nowrap">
                  {formatAmount(tx.pay_amount)} {payToken?.symbol}
                </span>
                <span class="text-kong-text-primary/50">→</span>
                <span class="text-kong-text-primary/70 font-medium text-nowrap">
                  {formatAmount(tx.receive_amount)} {receiveToken?.symbol}
                </span>
              {/if}
            </div>
          </div>
          <span class="text-xs text-kong-text-primary/60 font-medium flex gap-2 items-center">
            <ButtonV2
              variant="transparent"
              size="xs"
              className="text-kong-text-primary"
              on:click={handleWalletClick}
            >
              {truncateAddress(tx.user.principal_id)}
            </ButtonV2>
            {formattedDate}
          </span>
        </div>

        <div class="flex items-center justify-end gap-3">
          <div class="flex flex-col items-end gap-1">
            <span class="text-sm font-semibold text-kong-text-primary">{usdValue}</span>
            <div class="flex items-center gap-2">
              <button
                title="View wallet"
                class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1 rounded-md hover:bg-kong-bg-secondary/30"
                on:click|preventDefault={handleWalletClick}
              >
                <WalletIcon class="w-4 h-4" />
              </button>
              <button
                title="View on explorer"
                class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1 rounded-md hover:bg-kong-bg-secondary/30"
                on:click|preventDefault={handleExplorerClick}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .transaction-highlight {
    animation: highlight 2s ease-out;
  }

  @keyframes highlight {
    0% { background-color: rgba(99, 102, 241, 0.15); }
    100% { background-color: transparent; }
  }

  @media (max-width: 767px) {
    .transaction-highlight {
      animation: mobile-highlight 1.5s ease-out;
    }

    @keyframes mobile-highlight {
      0% { background-color: rgba(99, 102, 241, 0.1); }
      100% { background-color: transparent; }
    }
  }
</style> 