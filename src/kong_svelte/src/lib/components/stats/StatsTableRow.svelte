<script lang="ts">
  import { Star, Flame } from "lucide-svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { favoriteStore } from "$lib/services/tokens/favoriteStore";
  import { goto } from "$app/navigation";
  import { tokenStore } from "$lib/services/tokens/tokenStore";

  interface StatsToken extends FE.Token {
    isHot?: boolean;
    volumeRank?: number;
  }

  export let token: StatsToken;
  export let isConnected: boolean;
  export let isFavorite: boolean;
  export let priceClass: string;
  export let trendClass: string;
  export let kongCanisterId: string;
</script>

<tr
  class="border-b border-white/5 hover:bg-white/5 transition-colors duration-200 cursor-pointer"
  class:kong-special-row={token.canister_id === kongCanisterId}
  on:click={() => goto(`/stats/${token.canister_id}`)}
>
  <td class="text-center text-[#8890a4] w-[50px]">#{token.marketCapRank || "-"}</td>
  <td class="pl-2 w-[300px]">
    <div class="flex items-center gap-2 h-full">
      {#if isConnected}
        <button
          class="favorite-button {isFavorite ? 'active' : ''}"
          on:click|stopPropagation={() => favoriteStore.toggleFavorite(token.canister_id)}
        >
          {#if isFavorite}
            <Star class="star-icon filled" size={16} color="yellow" fill="yellow" />
          {:else}
            <Star class="star-icon" size={16} />
          {/if}
        </button>
      {/if}
      <TokenImages tokens={[token]} containerClass="self-center" size={24} />
      <span class="token-name">{token.name}</span>
      <span class="token-symbol">{token.symbol}</span>
      {#if token?.isHot}
        <div
          class="hot-badge-small"
          title="#{token?.volumeRank} 24hr volume"
          use:tooltip={{
            text: `#${token.volumeRank} Volume`,
            direction: "right",
            textSize: "sm",
          }}
        >
          <Flame size={20} class="hot-icon" fill="#FFA500" stroke="white" />
        </div>
      {/if}
    </div>
  </td>
  <td class="price-cell text-right pr-8 w-[180px]">
    <span
      class={$tokenStore.priceChangeClasses[token.canister_id] || ""}
      use:tooltip={{
        text: `$${Number(token?.metrics?.price).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }) || 0}`,
        direction: "top",
        textSize: "sm",
      }}
    >
      ${formatToNonZeroDecimal(token?.metrics?.price || 0)}
    </span>
  </td>
  <td class="change-cell text-right pr-8 w-[80px] {trendClass}">
    {#if token?.metrics?.price_change_24h === null || token?.metrics?.price_change_24h === "n/a"}
      <span class="text-slate-400">0.00%</span>
    {:else if Number(token?.metrics?.price_change_24h) === 0}
      <span class="text-slate-400">0.00%</span>
    {:else}
      <span>
        {Number(token?.metrics?.price_change_24h) > 0 ? "+" : ""}
        {formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
      </span>
    {/if}
  </td>
  <td class="text-right pr-8 w-[100px]">
    <span>{formatUsdValue(token?.metrics?.volume_24h)}</span>
  </td>
  <td class="text-right pr-8 w-[100px]">
    <span>{formatUsdValue(token?.metrics?.market_cap)}</span>
  </td>
  <td class="actions-cell text-right w-[120px] py-2 pr-3">
    <span>{formatUsdValue(token?.metrics?.tvl || 0)}</span>
  </td>
</tr>

<style lang="postcss">
  .token-name {
    @apply text-white font-medium truncate max-w-[120px] md:max-w-none;
  }

  .token-symbol {
    @apply text-xs md:text-sm text-white/60 hidden sm:inline;
  }

  .favorite-button {
    @apply flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/10 transition-none;
  }

  .action-button {
    @apply px-4 py-1.5 text-sm rounded
           bg-white/5 text-white/60 hover:bg-white/10 hover:text-white
           focus:outline-none focus:ring-2 focus:ring-white/20
           min-w-[80px] float-right my-1 mr-2;
  }

  .kong-special-row {
    background: rgba(0, 255, 128, 0.02);
    border-left: 2px solid #00d3a533;

    &:hover {
      background: rgba(0, 255, 128, 0.04);
    }

    td {
      font-weight: 500;
    }
  }
</style> 