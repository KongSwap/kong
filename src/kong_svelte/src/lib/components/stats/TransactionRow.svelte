<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatTimestamp } from "$lib/utils/dateFormatters";
  import { calculateTotalUsdValue } from "$lib/utils/tokenFormatters";
  
  export let tx: FE.Transaction;
  export let token: FE.Token;
  export let formattedTokens: FE.Token[];
  export let isNew: boolean;
</script>

<tr
  class="border-b border-slate-700/70 transition-all duration-300"
  class:new-transaction={isNew}
>
  <td class="px-4 py-3">
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <span class="px-2 py-0.5 text-xs bg-slate-700 rounded-full whitespace-nowrap">
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
            tokens={[formattedTokens?.find((t) => t.token_id === tx.receive_token_id)]
              .filter(Boolean)}
            size={16}
          />
          <span class="whitespace-nowrap">worth {calculateTotalUsdValue(tx, formattedTokens)}</span>
          <span class="text-slate-400 text-xs">{formatTimestamp(tx.timestamp.toString())}</span>
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
            tokens={[formattedTokens?.find((t) => t.token_id === tx.pay_token_id)]
              .filter(Boolean)}
            size={16}
          />
          <span class="whitespace-nowrap">worth {calculateTotalUsdValue(tx, formattedTokens)}</span>
          <span class="text-slate-400 text-xs">{formatTimestamp(tx.timestamp.toString())}</span>
        </span>
      {/if}
    </div>
  </td>
  <td class="px-4 py-3 text-right">
    {#if tx.tx_id}
      <a
        href={`https://explorer.sui.io/txblock/${tx.tx_id}`}
        target="_blank"
        rel="noopener noreferrer"
        class="text-blue-400 hover:text-blue-300"
        title="View transaction"
        aria-label="View transaction details"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clip-rule="evenodd"
          />
        </svg>
      </a>
    {:else}
      N/A
    {/if}
  </td>
</tr> 