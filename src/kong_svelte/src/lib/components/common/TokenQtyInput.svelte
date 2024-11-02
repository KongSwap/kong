<script lang="ts">
	import { formattedTokens } from '$lib/stores/tokenStore';
    import { createEventDispatcher } from 'svelte';
    import { formatUSD, formatTokenAmount } from '$lib/utils/numberFormatUtils';

    export let value: string = '';
    export let token: FE.Token;
    export let error: string = '';
    export let disabled: boolean = false;
    export let placeholder: string = '0.00';

    const dispatch = createEventDispatcher();

    // Handle input validation and formatting
    function handleInput(event: Event) {
        const input = event.target as HTMLInputElement;
        let newValue = input.value.replace(/[^0-9.]/g, '');

        value = formatTokenAmount(Number(newValue), token.decimals);
        dispatch('input', { value: newValue });
    }

    function setMax() {
        value = balance;
        dispatch('input', { value: balance });
    }
</script>

<div class="flex flex-col gap-2 w-full">
    <div class="relative">
        <div class="relative flex items-center">
            <input
                type="text"
                {placeholder}
                {disabled}
                value={value}
                on:input={handleInput}
                class="
                    w-full px-4 py-4 pr-[4.5rem]
                    bg-white/5 
                    border-2 
                    rounded-lg
                    text-2xl
                    font-play
                    placeholder:font-play
                    transition-all duration-200
                    focus:outline-none 
                    disabled:opacity-50 
                    disabled:cursor-not-allowed
                    {error ? 'border-red-500/30 focus:border-red-400' : 'border-white/10 focus:border-yellow-400'}
                "
            />
            <div class="absolute right-0 inset-y-0 flex items-center pr-4">
                <span class="text-white/50 text-lg font-play">{token.symbol}</span>
            </div>
        </div>
    </div>

    <!-- Balance and USD value row -->
    <div class="flex justify-between items-center px-1 text-sm">
        <div class="flex items-center gap-2">
            <span class="text-white/50">Balance: {token.formattedBalance} {token.symbol}</span>
            {#if parseFloat(token.formattedUsdValue) > 0}
                <button
                    type="button"
                    class="text-yellow-400 hover:text-yellow-300 text-xs uppercase font-play"
                    on:click={setMax}
                >
                    Max
                </button>
            {/if}
        </div>
        <span class="text-white/50">${formatUSD(parseFloat(value) * parseFloat(token.usdPrice))}</span>
    </div>

    {#if error}
        <span class="text-xs text-red-500">{error}</span>
    {/if}
</div> 