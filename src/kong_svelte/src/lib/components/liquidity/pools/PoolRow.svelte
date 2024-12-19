<script lang="ts">
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { onMount } from "svelte";
  import { formatUsdValue, fromRawAmount } from "$lib/utils/tokenFormatters";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";

  export let pool: BE.Pool;
  export let tokenMap: Map<string, any>;
  export let isEven: boolean;
  export let isKongPool = false;
  export let onAddLiquidity: (token0: string, token1: string) => void;
  export let onShowDetails: () => void;

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

  function handleAddLiquidity() {
    onAddLiquidity(pool.address_0, pool.address_1);
  }

</script>

{#if !isMobile}
  <!-- Desktop view (table row) -->
  <tr class="{isEven ? 'even' : ''} {isKongPool ? 'kong-special-row' : ''}">
    <td class="pool-cell">
      <div class="pool-info">
        <TokenImages
          tokens={[tokenMap.get(pool.address_0), tokenMap.get(pool.address_1)]}
          size={24}
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
          {getPoolPriceUsd(pool)}
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
    <td class="actions-cell">
      <div class="actions">
        <button class="action-btn add-lp" on:click={handleAddLiquidity}>
          Add LP
        </button>
        {#if showDetailsButton}
          <button class="action-btn details" on:click={onShowDetails}>
            Details
          </button>
        {/if}
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
      <div class="card-actions">
        <button class="action-btn details" on:click={onShowDetails}>
          Details
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  tr {
    transition: colors 150ms;
    padding: 0 1rem;
  }

  tr:hover {
    background-color: #1a1b23;
  }

  tr.kong-special-row {
    background: rgba(0, 255, 128, 0.02);

    td {
      font-weight: 500;
    }

    &:hover {
      background: rgba(0, 255, 128, 0.04);
    }
  }

  td {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: #8890a4;
    border-bottom: 1px solid #2a2d3da8;
    height: 64px;
  }

  .price-cell,
  .tvl-cell,
  .volume-cell,
  .apy-cell {
    width: 15%;
    text-align: left;
  }

  .actions-cell {
    text-align: right;
  }

  .pool-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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

  .actions-cell {
    width: 10%;
  }

  .pool-details {
    display: flex;
    flex-direction: column;
  }

  .pool-name {
    color: white;
    font-weight: 500;
    font-size: 1rem;
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
    color: white;
    font-weight: 500;
    font-size: 1rem;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .action-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem;
    transition: all 150ms;
    white-space: nowrap;
  }

  .add-lp {
    background-color: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .add-lp:hover {
    background-color: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.5);
    color: #93c5fd;
  }

  .details {
    background-color: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.3);
  }

  .details:hover {
    background-color: rgba(107, 114, 128, 0.3);
    border-color: rgba(107, 114, 128, 0.5);
    color: #d1d5db;
  }

  /* Mobile Card Styles */
  .mobile-pool-card {
    background-color: #1a1b23;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    border: 1px solid #2a2d3d;
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
    color: white;
    font-weight: 500;
  }

  .tvl-badge {
    font-size: 0.75rem;
    color: #8890a4;
  }

  .card-actions {
    display: flex;
    align-items: center;
    height: 100%;
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
