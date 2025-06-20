<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { truncateAddress } from "$lib/utils/principalUtils";
  import { getPrincipalColor } from "$lib/utils/principalUtils";
  import { formatPrincipalId } from "$lib/utils/transactionUtils";
  import { Wallet } from "lucide-svelte";
  import { goto } from "$app/navigation";

  interface Props {
    tx: FE.Transaction;
    token: Kong.Token;
    tokens: Kong.Token[];
    isHighlighted?: boolean;
  }

  let { tx, token, tokens, isHighlighted = false }: Props = $props();

  const walletAddress = $derived(tx.user.principal_id);

  // Computed values
  const payToken = $derived(tokens.find((t) => t.id === tx.pay_token_id));
  const receiveToken = $derived(tokens.find((t) => t.id === tx.receive_token_id));
  const isBuy = $derived(tx.receive_token_id === token.id);
  
  const formatAmount = (amount: number) => amount.toFixed(amount < 0.01 ? 6 : 2);
  
  // Calculate time since transaction (Age)
  const timeAgo = $derived.by(() => {
    const txDate = new Date(tx.timestamp + (tx.timestamp.includes('Z') ? '' : 'Z'));
    const now = new Date();
    const diffMs = now.getTime() - txDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  });

  // Calculate price per token (USD)
  // const pricePerToken = $derived.by(() => {
  //   if (!receiveToken) return "0.00";
    
  //   const tokenPrice = Number(receiveToken.metrics.price) || 0;

  //   return formatUsdValue(tokenPrice);
  // });
  
  // Calculate total USD value of transaction
  const totalValue = $derived.by(() => {
    if (!payToken || !receiveToken) return "0.00";
    
    const payUsdValue = payToken.symbol === "ckUSDT" 
      ? tx.pay_amount 
      : tx.pay_amount * (Number(payToken.metrics.price) || 0);
    
    const receiveUsdValue = receiveToken.symbol === "ckUSDT" 
      ? tx.receive_amount 
      : tx.receive_amount * (Number(receiveToken.metrics.price) || 0);
    
    return formatUsdValue(Math.max(payUsdValue, receiveUsdValue));
  });

  // Show amount denominated in the main token (consistent for both buy/sell)
  const tokenAmount = $derived.by(() => {
    if (isBuy) {
      // For buys, show the received amount of the main token
      return `${formatAmount(tx.receive_amount)}`;
    } else {
      // For sells, show the paid amount of the main token
      return `${formatAmount(tx.pay_amount)}`;
    }
  });

  const handleWalletClick = () => goto(`/wallets/${formatPrincipalId(tx.user.principal_id)}`);
  const handleExplorerClick = () => {
    window.open(
      `https://www.icexplorer.io/address/detail/${formatPrincipalId(tx.user.principal_id)}`,
      "_blank"
    );
  };
</script>

<tr
  class={`border-b border-kong-border/20 hover:bg-kong-bg-secondary/20 transition-all duration-200 ${
    isHighlighted ? "transaction-highlight" : ""
  }`}
>
  <!-- Age -->
  <td class={`px-4 py-1 text-sm font-medium whitespace-nowrap ${
    isBuy ? "text-kong-success" : "text-kong-error"
  }`}>
    {timeAgo}
  </td>

  <!-- Type -->
  <td class="px-4 py-1 whitespace-nowrap">
    <span
      class={`px-2 py-1 rounded-md text-xs font-medium ${
        isBuy
          ? "bg-kong-success/10 text-kong-success"
          : "bg-kong-error/10 text-kong-error"
      }`}
    >
      {isBuy ? "BUY" : "SELL"}
    </span>
  </td>

  <!-- Price (USD per token) -->
  <!-- <td class={`px-4 py-1 text-sm font-medium whitespace-nowrap ${
    isBuy ? "text-kong-success" : "text-kong-error"
  }`}>
    {pricePerToken}
  </td> -->

  <!-- Value (Total USD) -->
  <td class={`px-4 py-1 text-sm font-semibold whitespace-nowrap ${
    isBuy ? "text-kong-success" : "text-kong-error"
  }`}>
    {totalValue}
  </td>

  <!-- Token Name (Amount of received token) -->
  <td class={`px-4 py-1 text-sm font-medium whitespace-nowrap ${
    isBuy ? "text-kong-success" : "text-kong-error"
  }`}>
    <div class="flex items-center gap-1">
      <span>{tokenAmount}</span>
      <img 
        src={token.logo_url} 
        alt={token.symbol}
        class="w-4 h-4 rounded-full"
        onerror={(e) => (e.target as HTMLImageElement).style.display = 'none'}
      />
    </div>
  </td>

  <!-- Trader -->
  <td class="px-4 py-2 w-[80px]">
    <div class="flex items-center gap-2 justify-between ">
      <span
      class="px-2 py-0.5 text-xs rounded-full whitespace-nowrap dark:text-white text-kong-text-primary cursor-pointer hover:opacity-80"
      style="background-color: {getPrincipalColor(walletAddress)};"
      onclick={(e) => goto(`/wallets/${walletAddress}`)}
    >
      {walletAddress.slice(0, 8)}
    </span>
      <button
        title="View on explorer"
        class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1.5 rounded-md hover:bg-kong-bg-secondary/30"
        onclick={handleExplorerClick}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </button>
    </div>
  </td>

  <!-- Actions (no header) -->
  <!-- <td class="px-4 py-1 whitespace-nowrap">
    
  </td> -->
</tr>

<style>
  .transaction-highlight {
    animation: highlight 2s ease-out;
  }

  @keyframes highlight {
    0% { background-color: rgba(99, 102, 241, 0.15); }
    100% { background-color: transparent; }
  }
</style> 