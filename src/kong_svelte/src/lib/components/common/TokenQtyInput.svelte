<script lang="ts">
	import { poolStore, poolsList } from '$lib/stores/poolStore';
	import { createEventDispatcher } from 'svelte';
	import { formatUSD, formatTokenAmount } from '$lib/utils/numberFormatUtils';
	import { tokenStore } from '$lib/stores/tokenStore';
	import { CKUSDT_CANISTER_ID } from '$lib/constants/canisterConstants';

	export let value: string = '';
	export let token: FE.Token;
	export let error: string = '';
	export let disabled: boolean = false;
	export let placeholder: string = '0.00';

	poolStore.loadPools();

	const dispatch = createEventDispatcher();

	// Handle input validation and formatting
	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const newValue = input.value.replace(/[^0-9.]/g, '');
		value = newValue;
		dispatch('input', { value: newValue });
	}

	function setMax() {
		const rawBalance = $tokenStore.balances[token.canister_id]?.in_tokens || 0n;
		const max = formatTokenAmount(rawBalance, token.decimals);
		value = max.toString();
		dispatch('input', { value: max.toString() });
	}

	// Use reactive statements to compute derived values
	$: pool = $poolsList.find(p => p.address_0 === token.canister_id && p.address_1 === CKUSDT_CANISTER_ID);
	$: poolPrice = pool?.price ? parseFloat(pool.price) : 0;
	$: usdValue = formatUSD(parseFloat(value || '0') * poolPrice);
</script>

<div class="flex flex-col gap-2 w-full">
	<div class="relative">
		<div class="relative flex items-center">
			<input
				type="text"
				{placeholder}
				{disabled}
				bind:value
				on:input={handleInput}
				class="
					w-full px-4 py-4 pr-[4.5rem]
					placeholder:text-white/50
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
		<span class="text-white/50">${usdValue}</span>
	</div>

	{#if error}
		<span class="text-xs text-red-500">{error}</span>
	{/if}
</div> 