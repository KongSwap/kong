<script lang="ts">
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { onMount } from "svelte";
  import { formatUsdValue, fromRawAmount } from "$lib/utils/tokenFormatters";

  export let pool: BE.Pool & { displayTvl: number };
  export let tokenMap: Map<string, any>;
  export let isEven: boolean;
  export let isKongPool: boolean;

  let isMobile = false;
  let showDetailsButton = true;

  type Cleanup = () => void;

  onMount((): Cleanup => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
      showDetailsButton = window.innerWidth >= 1150;
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });
</script>

{#if !isMobile}
  <!-- Desktop view (table row) -->
  <tr class="cursor-pointer {isEven ? 'even' : ''} {isKongPool ? 'kong-special-row' : ''}" on:click>
    <td class="pool-cell">
      <div class="pool-info">
        <TokenImages
          tokens={[tokenMap.get(pool.address_0), tokenMap.get(pool.address_1)]}
          overlap={true}
          size={28}
        />
        <div class="pool-details">
          <div class="pool-name">
            {pool.symbol_0}/{pool.symbol_1}
          </div>
        </div>
      </div>
    </td>
    <td class="price-cell">
      <div class="price-info">
        <div class="price-value">
          ${formatToNonZeroDecimal(pool.price)}
        </div>
      </div>
    </td>
    <td class="tvl-cell">
      <div class="tvl-info">
        <div class="tvl-value">
          {formatUsdValue(Number(pool.tvl) / 10 ** 6)}
        </div>
      </div>
    </td>
    <td class="volume-cell">
      <div class="volume-info">
        <div class="volume-value">
          {formatUsdValue(fromRawAmount(pool.rolling_24h_volume.toString(), 6))}
        </div>
      </div>
    </td>
    <td class="apy-cell">
      <div class="apy-info">
        <div class="apy-value">
          {formatToNonZeroDecimal(pool.rolling_24h_apy)}%
        </div>
      </div>
    </td>
  </tr>
{:else}
  <!-- Mobile view (simplified card) -->
  <div class="mobile-pool-card">
    <div class="card-header">
      <div class="token-info">
        <TokenImages
          tokens={[tokenMap.get(pool.address_0), tokenMap.get(pool.address_1)]}
          size={32}
          overlap={true}
        />
        <div class="token-details">
          <span class="token-pair">{pool.symbol_0}/{pool.symbol_1}</span>
          <span class="tvl-badge">TVL: ${pool.tvl}</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style scoped lang="postcss">
  tr {
    transition: colors 150ms;
  }

  tr:hover {
    @apply bg-kong-border;
  }

  tr.kong-special-row {
    @apply border border-kong-primary bg-kong-primary/10 !important;

    td {
      font-weight: 500;
    }

    &:hover {
      @apply bg-kong-accent-green text-black;
    }
  }

  td {
    font-size: 0.875rem;
    @apply border-b border-kong-border/50 py-2 px-2;
  }

  .price-cell,
  .tvl-cell,
  .volume-cell,
  .apy-cell {
    width: 15%;
    text-align: left;
  }

  .pool-info {
    @apply flex items-center gap-2 pl-2;
  }

  .pool-cell {
    width: 30%;
  }

  .price-cell,
  .tvl-cell,
  .volume-cell,
  .apy-cell {
    width: 15%;
    text-align: right;
  }

  .pool-details {
    display: flex;
    flex-direction: column;
  }

  .pool-name {
    font-weight: 500;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .price-info,
  .tvl-info,
  .volume-info,
  .apy-info {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .price-value,
  .tvl-value,
  .volume-value,
  .apy-value {
    font-weight: 500;
    font-size: 1rem;
  }

  /* Mobile Card Styles */
  .mobile-pool-card {
    background-color: #1a1b23;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    @apply border border-kong-border;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .token-pair {
    font-weight: 500;
  }

  .tvl-badge {
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .mobile-pool-card {
      padding: 0.625rem 1rem;
    }

    .token-info {
      gap: 0.5rem;
    }

    .tvl-badge {
      font-size: 0.6875rem;
    }
  }
</style>
