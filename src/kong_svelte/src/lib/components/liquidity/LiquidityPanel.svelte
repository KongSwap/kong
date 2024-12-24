<script lang="ts">
    import TokenImages from "$lib/components/common/TokenImages.svelte";
    import { createEventDispatcher } from "svelte";
    
    export let title: string;
    export let token: FE.Token | null = null;
    export let amount: string = "";
    export let disabled: boolean = false;
    export let showPrice: boolean = true;
    export let panelType: "pay" | "receive" = "pay";

    const dispatch = createEventDispatcher();

    // Add debug logs
    function handleAmountChange(e: Event) {
        const input = (e.target as HTMLInputElement).value;
        dispatch('amountChange', { value: input });
    }

    function handleTokenSelect(event: MouseEvent) {
        const button = event.currentTarget as HTMLElement;
        dispatch('tokenSelect', { button });
    }
</script>

<div class="panel-container">
    <div class="panel-header">
        <span class="panel-title">{title}</span>
    </div>

    <div class="panel-content">
        <button 
            type="button"
            class="token-selector" 
            on:click={handleTokenSelect}
        >
            {#if token}
                <div class="token-info">
                    <TokenImages tokens={[token]} size={24} />
                    <span class="token-symbol">{token.symbol}</span>
                </div>
            {:else}
                <span class="select-token">Select Token</span>
            {/if}
            <svg class="chevron" viewBox="0 0 24 24" width="16" height="16">
                <path d="M6 9l6 6 6-6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>

        <input
            type="text"
            class="amount-input"
            placeholder="0.0"
            {disabled}
            value={amount}
            on:input={handleAmountChange}
        />
    </div>
</div>

<style lang="postcss">
    .panel-container {
        @apply bg-gray-800/50 rounded-lg p-4;
        @apply border border-white/10;
    }

    .panel-header {
        @apply flex justify-between items-center mb-2;
    }

    .panel-title {
        @apply text-white/60 text-sm;
    }

    .panel-content {
        @apply flex justify-between items-center gap-4;
    }

    .token-selector {
        @apply flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer;
        @apply bg-gray-700/50 hover:bg-gray-700/70;
        @apply transition-colors duration-200;
    }

    .token-info {
        @apply flex items-center gap-2;
    }

    .token-symbol {
        @apply text-white font-medium;
    }

    .select-token {
        @apply text-blue-400 font-medium;
    }

    .chevron {
        @apply text-white/60;
    }

    .amount-input {
        @apply bg-transparent text-right text-white text-xl font-medium;
        @apply focus:outline-none w-full;
        @apply placeholder-white/30;
    }
</style> 
