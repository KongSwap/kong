<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatTimestamp } from "$lib/utils/dateFormatters";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  export let tx: FE.Transaction;
  export let token: FE.Token;
  export let formattedTokens: FE.Token[];
  export let isNew: boolean;

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
</script>

<tr
  class="border-b border-slate-700/70 transition-all duration-300"
  class:new-transaction={isNew}
>
  <td class="px-4 py-3">
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <span
        class="px-2 py-0.5 text-xs bg-slate-700 rounded-full whitespace-nowrap"
      >
        {tx.user?.principal_id?.slice(0, 8)}
      </span>
      {#if tx.pay_token_id === token.token_id}
        <!-- Sell Transaction -->
        <span class="text-white/80 flex flex-wrap items-center gap-1 text-sm">
          <span class="text-red-500">Sold</span>
          {formatToNonZeroDecimal(tx.pay_amount)}
          <TokenImages tokens={[token]} size={16} />
          for
          {formatToNonZeroDecimal(tx.receive_amount)}
          <TokenImages
            tokens={[
              formattedTokens?.find((t) => t.token_id === tx.receive_token_id),
            ].filter(Boolean)}
            size={16}
          />
          <span class="whitespace-nowrap"
            >worth {calculateTotalUsdValue(tx)}</span
          >
          <span class="text-slate-400 text-xs"
            >{formatTimestamp(tx.timestamp.toString())}</span
          >
        </span>
      {:else}
        <!-- Buy Transaction -->
        <span class="text-white/80 flex flex-wrap items-center gap-1 text-sm">
          <span class="text-green-500">Bought</span>
          {formatToNonZeroDecimal(tx.receive_amount)}
          <TokenImages tokens={[token]} size={16} />
          for
          {formatToNonZeroDecimal(tx.pay_amount)}
          <TokenImages
            tokens={[
              formattedTokens?.find((t) => t.token_id === tx.pay_token_id),
            ].filter(Boolean)}
            size={16}
          />
          <span class="whitespace-nowrap"
            >worth {calculateTotalUsdValue(tx)}</span
          >
          <span class="text-slate-400 text-xs"
            >{formatTimestamp(tx.timestamp.toString())}</span
          >
        </span>
      {/if}
    </div>
  </td>
  <td class="px-4 py-3 text-right">
    {#if tx.tx_id}
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
          ><path
            d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
          /><path
            d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
          /></svg
        >
      </a>
    {:else}
      N/A
    {/if}
  </td>
</tr>
