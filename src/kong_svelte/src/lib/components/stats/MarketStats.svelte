<!-- src/lib/components/stats/MarketStats.svelte -->
<script lang="ts">
    import Panel from "$lib/components/common/Panel.svelte";
    import { TrendingUp, Droplets, DollarSign } from 'lucide-svelte';

    export let totalVolume: string;
    export let totalLiquidity: string;
    export let totalFees: string;
</script>

<Panel variant="green" type="main" className="market-stats-panel">
    <div class="market-stats-grid">
        <div class="stat-card">
            <div class="stat-icon-wrapper">
                <DollarSign class="stat-icon" />
            </div>
            <div class="stat-content">
                <h3>Total Volume (24h)</h3>
                <p>${totalVolume}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon-wrapper">
                <Droplets class="stat-icon" />
            </div>
            <div class="stat-content">
                <h3>Total Liquidity</h3>
                <p>${totalLiquidity}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon-wrapper">
                <DollarSign class="stat-icon" />
            </div>
            <div class="stat-content">
                <h3>Total Fees (24h)</h3>
                <p>${totalFees}</p>
            </div>
        </div>
    </div>
</Panel>

<style lang="postcss">
    .market-stats-grid { 
        @apply grid grid-cols-1 md:grid-cols-3 gap-6 p-6;
    }

    .stat-card {
        @apply flex items-center gap-4 p-6 rounded-xl bg-white/5 backdrop-blur-sm 
               border border-white/10 transition-all duration-200 hover:bg-white/10;
    }
    
    .stat-icon-wrapper {
        @apply p-3 rounded-lg bg-emerald-500/20 text-emerald-400;
    }
    
    .stat-icon {
        @apply w-6 h-6;
    }
    
    .stat-content {
        @apply flex flex-col gap-1;
        
        h3 {
            @apply text-white/60 text-sm font-medium;
        }
        
        p {
            @apply text-white text-xl font-semibold;
        }
    }

    @media (max-width: 768px) {
        .market-stats-grid { @apply grid-cols-1 gap-3; }
    }
</style>
