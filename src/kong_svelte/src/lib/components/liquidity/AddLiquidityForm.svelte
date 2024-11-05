<script lang="ts">
    import { Plus } from 'lucide-svelte';
    import TokenQtyInput from '$lib/components/common/TokenQtyInput.svelte';
    import { formatTokenAmount } from '$lib/utils/numberFormatUtils';

    export let token0: FE.Token | null = null;
    export let token1: FE.Token | null = null;
    export let amount0: string = '';
    export let amount1: string = '';
    export let loading: boolean = false;
    export let previewMode: boolean = false;
    export let error: string | null = null;
    export let poolShare: string = '0';
    export let onTokenSelect: (index: 0 | 1) => void;
    export let onInput: (index: 0 | 1, value: string) => void;
    export let onPreview: () => void;
    export let onSubmit: () => void;
    export let isProcessingOutput: boolean = false;

    $: isValid = token0 && token1 && amount0 && amount1 && !error;
    $: formattedAmount1 = formatTokenAmount(amount1, token1?.decimals);
</script>

<div class="space-y-6">
    <!-- Token 0 Input -->
    {#if token0}
        <TokenQtyInput
            token={token0}
            bind:value={amount0}
            disabled={loading || (previewMode && isProcessingOutput)}
            error={error || ''}
            on:input={(e) => onInput(0, e.detail.value)}
            onTokenSelect={() => onTokenSelect(0)}
        />
    {:else}
        <button
            class="w-full p-4 border-2 border-white/10 rounded-lg text-white/50 hover:border-yellow-400"
            on:click={() => onTokenSelect(0)}
        >
            Select Token
        </button>
    {/if}

    <!-- Plus Icon -->
    <div class="flex justify-center">
        <div class="bg-white/5 p-2 rounded-full">
            <Plus class="w-6 h-6 text-white/50" />
        </div>
    </div>

    <!-- Token 1 Input -->
    {#if token1}
        <TokenQtyInput
            token={token1}
            bind:value={formattedAmount1}
            disabled={loading || (previewMode && isProcessingOutput)}
            error={error || ''}
            on:input={(e) => onInput(1, e.detail.value)}
            onTokenSelect={() => onTokenSelect(1)}
        />
    {:else}
        <button
            class="w-full p-4 border-2 border-white/10 rounded-lg text-white/50 hover:border-yellow-400"
            on:click={() => onTokenSelect(1)}
        >
            Select Token
        </button>
    {/if}
    
    <!-- Preview Section -->
    {#if previewMode && !error}
        <div class="mt-4 p-4 bg-white/5 rounded-lg space-y-2">
            <h3 class="font-medium text-white">Position Preview</h3>
            <div class="flex justify-between text-sm">
                <span class="text-white/50">Pool Share</span>
                <span class="text-white">{poolShare}%</span>
            </div>
        </div>
    {/if}
    
    <!-- Action Buttons -->
    <div class="flex space-x-4">
        <button
            class="flex-1 py-3 px-4 bg-white/5 text-white rounded-lg hover:bg-white/10 disabled:opacity-50"
            on:click={onPreview}
            disabled={!isValid || loading}
        >
            Preview
        </button>
        <button
            class="flex-1 py-3 px-4 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 disabled:opacity-50"
            on:click={onSubmit}
            disabled={!isValid || loading}
        >
            {loading ? 'Processing...' : 'Add Liquidity'}
        </button>
    </div>
</div> 