<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { swapActivityStore, type SwapEvent } from '$lib/stores/swapActivityStore';
    import { formatDate } from '$lib/utils/dateUtils';
    import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
    import { fade } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import TokenImages from '$lib/components/common/TokenImages.svelte';
    import { browser } from '$app/environment';

    let swaps: SwapEvent[] = [];
    let interval: NodeJS.Timeout | null = null;
    let isComponentMounted = false;
    let controller: AbortController | null = null;

    // Subscribe to the store with cleanup
    const unsubscribe = swapActivityStore.subscribe(value => {
        if (isComponentMounted) {
            swaps = value;
        }
    });

    async function fetchSwapData() {
        if (!isComponentMounted) return;
        
        try {
            // Cancel any ongoing fetch
            if (controller) {
                controller.abort();
            }
            controller = new AbortController();

            const response = await fetch('http://18.170.224.113:8080/api/dexscreener_swap', {
                signal: controller.signal
            });
            
            if (!isComponentMounted) return;

            const data = await response.json();
            
            // Add each new swap to the store
            if (Array.isArray(data)) {
                const uniqueSwaps = data.filter(swap => 
                    !swaps.some(existingSwap => existingSwap.txnId === swap.txnId)
                );
                
                if (uniqueSwaps.length > 0) {
                    uniqueSwaps.forEach(swap => {
                        swapActivityStore.addSwap(swap);
                    });
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // Ignore abort errors
                return;
            }
            console.error('Error fetching swap data:', error);
        }
    }

    onMount(() => {
        if (browser) {
            isComponentMounted = true;
            // Fetch initial data
            fetchSwapData();
            
            // Set up polling every 10 seconds
            interval = setInterval(fetchSwapData, 10000);
        }
    });

    onDestroy(() => {
        isComponentMounted = false;
        unsubscribe();
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
        if (controller) {
            controller.abort();
            controller = null;
        }
    });

    function formatPairId(pairId: string): string {
        return pairId.split(':')[0];
    }

    function shortenAddress(address: string): string {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
</script>

<div class="swap-activity-container">
    <div class="swap-list">
        {#each swaps as swap (swap.txnId)}
            <div 
                class="swap-item"
                animate:flip={{ duration: 300 }}
                in:fade={{ duration: 300 }}
            >
                <div class="swap-header">
                    <span class="swap-time">{formatDate(new Date(swap.blockTimestamp * 1000))}</span>
                    <span class="swap-maker">{shortenAddress(swap.maker)}</span>
                </div>
                <div class="swap-details">
                    <div class="swap-amounts">
                        <span class="amount-in">
                            {formatToNonZeroDecimal(swap.asset0In || 0)}
                        </span>
                        <span class="swap-arrow">→</span>
                        <span class="amount-out">
                            {formatToNonZeroDecimal(swap.asset1Out || 0)}
                        </span>
                    </div>
                    <div class="swap-pair">
                        {formatPairId(swap.pairId)}
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>

<style lang="postcss">
    .swap-activity-container {
        @apply w-full h-full overflow-hidden;
    }

    .swap-list {
        @apply flex flex-col gap-2 h-full overflow-y-auto;
    }

    .swap-item {
        @apply bg-black/10 rounded-lg p-3 backdrop-blur-sm;
        @apply border border-white/10;
        @apply transition-all duration-200;
    }

    .swap-item:hover {
        @apply bg-black/20;
    }

    .swap-header {
        @apply flex justify-between items-center mb-2;
    }

    .swap-time {
        @apply text-sm text-white/60;
    }

    .swap-maker {
        @apply text-sm font-mono text-white/60;
    }

    .swap-details {
        @apply flex justify-between items-center;
    }

    .swap-amounts {
        @apply flex items-center gap-2;
    }

    .amount-in {
        @apply text-green-400;
    }

    .swap-arrow {
        @apply text-white/40;
    }

    .amount-out {
        @apply text-red-400;
    }

    .swap-pair {
        @apply text-sm text-white/80 font-mono;
    }
</style>
