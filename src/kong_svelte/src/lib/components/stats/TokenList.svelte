<!-- src/lib/components/stats/TokenList.svelte -->
<script lang="ts">
    import TokenImages from "$lib/components/common/TokenImages.svelte";
    import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
    import { flip } from "svelte/animate";
    import type { Token } from "$lib/services/tokens/tokenStore";

    export let tokens: Token[] = [];
</script>

<div class="token-list">
    <div class="token-table">
        <div class="token-header">
            <div class="token-col">Token</div>
            <div class="value-col">Value</div>
        </div>
        <div class="token-body">
            {#each tokens as token (token.address)}
                <div class="token-row" animate:flip={{ duration: 300 }}>
                    <div class="token-col">
                        <div class="token-info">
                            <TokenImages tokens={[token]} size={32} />
                            <div class="token-details">
                                <span class="token-symbol">{token.symbol}</span>
                                <span class="token-name">{token.name}</span>
                            </div>
                        </div>
                    </div>
                    <div class="value-col">
                        ${formatToNonZeroDecimal(token.formattedUsdValue)} fds
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .token-list {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .token-table {
        display: flex;
        flex-direction: column;
        min-width: 600px;
        height: 100%;
    }

    .token-header {
        display: grid;
        grid-template-columns: 1fr auto;
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

    .token-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .token-row {
        display: grid;
        grid-template-columns: 1fr auto;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(var(--base-content-rgb), 0.1);
        transition: background-color 150ms ease;
    }

    .token-row:hover {
        background: rgba(var(--base-content-rgb), 0.05);
    }

    .token-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .token-details {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .token-symbol {
        font-weight: 600;
        color: rgb(var(--base-content-rgb));
    }

    .token-name {
        font-size: 0.875rem;
        color: rgba(var(--base-content-rgb), 0.6);
    }

    .value-col {
        font-weight: 600;
        color: rgb(var(--base-content-rgb));
    }

    @media (max-width: 768px) {
        .token-table {
            min-width: 100%;
        }

        .token-row {
            padding: 0.75rem 1rem;
        }

        .token-header {
            padding: 0.75rem 1rem;
        }

        .token-info {
            gap: 0.75rem;
        }
    }
</style>
