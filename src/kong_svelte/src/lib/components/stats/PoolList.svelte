<!-- src/lib/components/stats/PoolList.svelte -->
<script lang="ts">
    import TokenImages from "$lib/components/common/TokenImages.svelte";
    import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
    import { flip } from "svelte/animate";
    import type { Pool } from "$lib/services/pools/poolStore";

    export let pools: Pool[] = [];
    export let isLoading: boolean = false;
    export let error: string | null = null;

    // Ensure we have valid tokens for each pool
    $: validPools = pools.map(pool => ({
        ...pool,
        tokens: pool.tokens?.filter(token => token !== undefined && token !== null) ?? []
    }));
</script>

<div class="pool-list">
    {#if isLoading}
        <div class="loading-state">
            <div class="spinner" />
        </div>
    {:else if error}
        <div class="error-state">
            {error}
        </div>
    {:else}
        <div class="pool-table">
            <div class="pool-header">
                <div class="pool-col">Pool</div>
                <div class="tvl-col">TVL</div>
                <div class="volume-col">Volume (24h)</div>
                <div class="apy-col">APY</div>
            </div>
            <div class="pool-body">
                {#each validPools as pool (pool.address)}
                    <div class="pool-row" animate:flip={{ duration: 300 }}>
                        <div class="pool-col">
                            <div class="pool-info">
                                <TokenImages tokens={pool.tokens} size={32} />
                                <div class="pool-details">
                                    <span class="pool-pair">
                                        {pool.tokens.map(t => t?.symbol ?? 'Unknown').join('/')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="tvl-col">
                            ${formatToNonZeroDecimal(Number(pool.tvl || 0n) / 1e8)}
                        </div>
                        <div class="volume-col">
                            ${formatToNonZeroDecimal(Number(pool.rolling_24h_volume || 0n) / 1e8)}
                        </div>
                        <div class="apy-col">
                            <span class="apy-value">
                                {formatToNonZeroDecimal(pool.rolling_24h_apy)}%
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .pool-list {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .loading-state,
    .error-state {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(var(--base-content-rgb), 0.6);
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(var(--primary-rgb), 0.3);
        border-top-color: rgb(var(--primary-rgb));
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .pool-table {
        display: flex;
        flex-direction: column;
        min-width: 800px;
        height: 100%;
    }

    .pool-header {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        padding: 1rem 1.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: rgba(var(--base-content-rgb), 0.6);
        border-bottom: 1px solid rgba(var(--base-content-rgb), 0.1);
        position: sticky;
        top: 0;
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(8px);
    }

    .pool-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .pool-row {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(var(--base-content-rgb), 0.1);
        transition: background-color 150ms ease;
    }

    .pool-row:hover {
        background: rgba(var(--base-content-rgb), 0.05);
    }

    .pool-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .pool-details {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .pool-pair {
        font-weight: 600;
        color: rgb(var(--base-content-rgb));
    }

    .tvl-col,
    .volume-col {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        font-weight: 600;
        color: rgb(var(--base-content-rgb));
    }

    .apy-col {
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    .apy-value {
        font-weight: 600;
        color: rgb(var(--primary-rgb));
    }

    @media (max-width: 768px) {
        .pool-table {
            min-width: 100%;
        }

        .pool-row {
            padding: 0.75rem 1rem;
            grid-template-columns: 1.5fr 1fr 1fr 0.8fr;
            gap: 0.5rem;
        }

        .pool-header {
            padding: 0.75rem 1rem;
            grid-template-columns: 1.5fr 1fr 1fr 0.8fr;
            gap: 0.5rem;
        }

        .pool-info {
            gap: 0.75rem;
        }

        .pool-pair {
            font-size: 0.875rem;
        }

        .tvl-col,
        .volume-col,
        .apy-col {
            font-size: 0.875rem;
        }
    }
</style>
