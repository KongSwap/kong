<script lang="ts">
    export let title: string;
    export let statusColor: string;
    export let markets: any[];
    export let isResolved: boolean = false;
    export let showEndTime: boolean = true;
    export let openBetModal: (market: any) => void;
    
    import { formatCategory, calculatePercentage } from '$lib/utils/numberFormatUtils';
    import { Flame, Coins } from 'lucide-svelte';
    import { formatBalance } from '$lib/utils/numberFormatUtils';
    import Panel from '$lib/components/common/Panel.svelte';
    import { goto } from '$app/navigation';
</script>

<div class="mb-8">
    {#if markets.length === 0}
        <div class="text-center py-6 text-kong-pm-text-secondary">
            No markets in this category
        </div>
    {:else}
        <h2 class="text-2xl font-bold mb-2 flex items-center gap-2">
            <span class="w-2 h-2 {statusColor} rounded-full animate-pulse"></span>
            {title}
        </h2>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {#each markets as market (market.id)}
                <Panel variant="transparent" className="relative {isResolved ? 'opacity-70' : ''}">
                    {#if isResolved}
                        <div class="absolute top-3 right-3">
                            <span class="px-2 py-1 bg-kong-accent-green/20 text-kong-accent-green text-xs rounded-full">
                                Resolved
                            </span>
                        </div>
                    {/if}
                    
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1 pr-2">
                            <button 
                            class="text-lg font-semibold mb-1.5 text-kong-text-primary text-left"
                            on:click={() => {
                                goto(`/predict/${market.id}`);
                            }}
                            >
                                {market.question}
                            </button>
                            <div class="flex items-center gap-2 text-sm">
                                <span class="text-kong-pm-accent font-medium">
                                    {formatCategory(market.category)}
                                </span>
                                {#if showEndTime}
                                    <span class="text-kong-pm-text-secondary">•</span>
                                    <span class="text-kong-pm-text-secondary text-sm">
                                        Ends {new Date(Number(market.end_time) / 1_000_000).toLocaleDateString()}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Outcomes -->
                    <div class="space-y-2">
                        {#each market.outcomes as outcome, i}
                            <div class="relative group">
                                <div class="h-12 bg-kong-bg-dark/20 rounded p-2 hover:bg-kong-surface-light/5 transition-colors">
                                    <div class="absolute top-0 left-0 h-full bg-kong-accent-green/20 rounded transition-all z-0"
                                         style:width={`${calculatePercentage(market.outcome_pools[i], market.outcome_pools.reduce((acc, pool) => acc + Number(pool || 0), 0)).toFixed(1)}%`}>
                                    </div>
                                    <div class="relative flex justify-between items-center h-full">
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium text-kong-text-primary">{outcome}</span>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-kong-pm-accent font-bold">
                                                {calculatePercentage(
                                                    market.outcome_pools[i],
                                                    market.outcome_pools.reduce((acc, pool) => acc + Number(pool || 0), 0)
                                                ).toFixed(1)}%
                                            </div>
                                            <div class="text-xs text-kong-pm-text-secondary">
                                                {formatBalance(market.outcome_pools[i], 8)} KONG
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <!-- Card Footer -->
                    {#if !isResolved}
                        <div class="mt-4 pt-3 border-t border-kong-pm-border">
                            <button 
                                class="w-full flex items-center justify-center py-2.5 border shadow border-kong-accent-green/50 hover:bg-kong-accent-green/10 text-kong-accent-green rounded font-semibold transition-all"
                                on:click={() => openBetModal(market)}
                            >
                                <Coins class="w-4 h-4 mr-2" />
                                Place Bet
                            </button>
                        </div>
                    {:else}
                        <div class="mt-4 pt-3 border-t border-kong-pm-border">
                            <div class="text-center text-sm text-kong-pm-text-secondary">
                                Resolved on {new Date(Number(market.end_time) / 1_000_000).toLocaleDateString()}
                            </div>
                        </div>
                    {/if}
                </Panel>
            {/each}
        </div>
    {/if}
</div> 