<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatTimestamp } from "$lib/utils/dateFormatters";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { getPrincipalColor } from "$lib/utils/principalColorUtils";
  import { toastStore } from "$lib/stores/toastStore";

  export let tx: FE.Transaction;
  export let token: FE.Token;
  export let formattedTokens: FE.Token[];
  export let isNew: boolean;
  export let mobile = false;

  // New computed property to determine the wallet address
  $: walletAddress = typeof tx.user === 'object' && tx.user.principal_id ? tx.user.principal_id : String(tx.user || '');

  // Add a computed property to determine if this is a buy transaction
  $: isBuyTransaction = tx.receive_token_id === token.token_id;

  const calculateTotalUsdValue = (
    tx: FE.Transaction
  ): string => {
    const payToken = formattedTokens?.find(
      (t) => t.token_id === tx.pay_token_id,
    );
    const receiveToken = formattedTokens?.find(
      (t) => t.token_id === tx.receive_token_id,
    );
    if (!payToken || !receiveToken) return "0.00";

    // Calculate USD value from pay side
    const payUsdValue =
      payToken.symbol === "ckUSDT"
        ? tx.pay_amount
        : tx.pay_amount * (Number(payToken.metrics.price) || 0);

    // Calculate USD value from receive side
    const receiveUsdValue =
      receiveToken.symbol === "ckUSDT"
        ? tx.receive_amount
        : tx.receive_amount * (Number(receiveToken.metrics.price) || 0);

    // Use the higher value
    return formatUsdValue(Math.max(payUsdValue, receiveUsdValue));
  };

  // Update copy function to show toast
  async function copyToClipboard(text: string, event: MouseEvent) {
    event.stopPropagation();
    console.log('Attempting to copy wallet address:', text);
    if (!walletAddress) {
      console.error('Wallet address is empty!');
      toastStore.error('Wallet address is empty', { title: 'Copy failed' });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      const target = event.target as HTMLElement;
      target.classList.add('copied');
      setTimeout(() => {
        target.classList.remove('copied');
      }, 1000);
      toastStore.success('Wallet ID copied to clipboard', {
        duration: 2000,
        title: 'Copied!'
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toastStore.error('Failed to copy wallet ID', {
        title: 'Error'
      });
    }
  }
</script>

<tr
  class="md:border-b border-kong-border/70 transition-all duration-300 overflow-x-hidden hover:bg-kong-bg-light"
  class:block={mobile}
  class:highlight-buy={isNew && isBuyTransaction}
  class:highlight-sell={isNew && !isBuyTransaction}
>
  {#if !mobile}
    <!-- Wallet -->
    <td class="px-4 py-2 w-[120px]">
      <span
        class="px-2 py-0.5 text-xs rounded-full whitespace-nowrap dark:text-white text-kong-text-primary cursor-pointer hover:opacity-80 relative group"
        style="background-color: {getPrincipalColor(walletAddress)};"
        on:click={(e) => copyToClipboard(walletAddress, e)}
      >
        {walletAddress.slice(0, 8)}
        <span class="copy-tooltip">Copy ID</span>
      </span>
    </td>

    <!-- Paid -->
    <td class="px-4 py-2 w-[140px]">
      <span class="flex items-center gap-1">
        {formatToNonZeroDecimal(tx.pay_amount)}
        <TokenImages
          tooltip={{
            text: formattedTokens?.find((t) => t.token_id === tx.pay_token_id)?.symbol,
            direction: "top"
          }}
          tokens={[formattedTokens?.find((t) => t.token_id === tx.pay_token_id)].filter(Boolean)}
          size={18}
        />
      </span>
    </td>

    <!-- Received -->
    <td class="px-4 py-2 w-[140px]">
      <span class="flex items-center gap-1">
        {formatToNonZeroDecimal(tx.receive_amount)}
        <TokenImages
          tooltip={{
            text: formattedTokens?.find((t) => t.token_id === tx.receive_token_id)?.symbol,
            direction: "top"
          }}
          tokens={[formattedTokens?.find((t) => t.token_id === tx.receive_token_id)].filter(Boolean)}
          size={18}
        />
      </span>
    </td>

    <!-- Value -->
    <td class="px-4 py-2 w-[100px]">
      <span class="whitespace-nowrap">{calculateTotalUsdValue(tx)}</span>
    </td>

    <!-- Date -->
    <td class="px-4 py-2 w-[120px]">
      <span class="text-slate-400 text-sm whitespace-nowrap">
        {formatTimestamp(tx.timestamp.toString())}
      </span>
    </td>

    <!-- Link -->
    <td class="w-[50px] py-2 ">
      {#if tx.tx_id}
        <div class="flex justify-center w-full pr-3">
        <a
          href={`https://www.icexplorer.io/address/detail/${tx.user.principal_id}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-400/70 hover:text-blue-300"
          title="View transaction"
          aria-label="View transaction details"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-link"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </a>
      </div>
      {:else}
        N/A
      {/if}
    </td>
  {:else}
    <div class="grid grid-cols-2 gap-2 p-2 text-sm">
      <div class="col-span-2 flex justify-between items-center">
        <span
          class="px-2 py-0.5 text-xs rounded-full whitespace-nowrap dark:text-white text-kong-text-primary cursor-pointer hover:opacity-80 relative group"
          style="background-color: {getPrincipalColor(walletAddress)};"
          on:click={(e) => copyToClipboard(walletAddress, e)}
        >
          {walletAddress.slice(0, 8)}
          <span class="copy-tooltip">Copy ID</span>
        </span>
        <span class="text-slate-400 text-xs">
          {formatTimestamp(tx.timestamp.toString())}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <span class="text-kong-text-primary/70">Paid:</span>
        {formatToNonZeroDecimal(tx.pay_amount)}
        <TokenImages
          tokens={[formattedTokens?.find((t) => t.token_id === tx.pay_token_id)].filter(Boolean)}
          size={14}
        />
      </div>

      <div class="flex items-center gap-1">
        <span class="text-kong-text-primary/70">Received:</span>
        {formatToNonZeroDecimal(tx.receive_amount)}
        <TokenImages
          tokens={[formattedTokens?.find((t) => t.token_id === tx.receive_token_id)].filter(Boolean)}
          size={14}
        />
      </div>

      <div class="col-span-2 flex justify-between items-center">
        <div class="flex items-center gap-1">
          <span class="text-kong-text-primary/70">Value:</span>
          {calculateTotalUsdValue(tx)}
        </div>
        {#if tx.tx_id}
          <a
            href={`https://www.icexplorer.io/address/detail/${tx.user.principal_id}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400/70 hover:text-blue-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="lucide lucide-link"
            />
          </a>
        {/if}
      </div>
    </div>
  {/if}
</tr>

<style>
  .highlight-buy {
    animation: highlight-buy 2s ease-out forwards;
  }

  .highlight-sell {
    animation: highlight-sell 2s ease-out forwards;
  }

  @keyframes highlight-buy {
    0% {
      background-color: rgba(34, 197, 94, 0.4); /* kong-accent-green with opacity */
      transform: translateX(-8px);
      box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
    }
    15% {
      transform: translateX(4px);
      background-color: rgba(34, 197, 94, 0.35);
    }
    30% {
      transform: translateX(0);
      background-color: rgba(34, 197, 94, 0.3);
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
    }
    100% {
      background-color: transparent;
      box-shadow: none;
    }
  }

  @keyframes highlight-sell {
    0% {
      background-color: rgba(239, 68, 68, 0.4); /* kong-accent-red with opacity */
      transform: translateX(-8px);
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
    }
    15% {
      transform: translateX(4px);
      background-color: rgba(239, 68, 68, 0.35);
    }
    30% {
      transform: translateX(0);
      background-color: rgba(239, 68, 68, 0.3);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
    }
    100% {
      background-color: transparent;
      box-shadow: none;
    }
  }

  .copy-tooltip {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
    white-space: nowrap;
  }

  .group:hover .copy-tooltip {
    opacity: 1;
  }

  .copied::after {
    content: 'Copied!';
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(34, 197, 94, 0.9);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    white-space: nowrap;
    animation: fadeOut 1s forwards;
  }

  @keyframes fadeOut {
    0% {
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @media (max-width: 767px) {
    tr.highlight-buy, tr.highlight-sell {
      animation: none;
    }

    tr.highlight-buy div {
      animation: highlight-buy 2s ease-out forwards;
    }

    tr.highlight-sell div {
      animation: highlight-sell 2s ease-out forwards;
    }
  }
</style>
