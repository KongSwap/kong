<script lang="ts">
	import { poolsList } from '$lib/services/pools/poolStore';
	import { createEventDispatcher } from 'svelte';
	import { formatToNonZeroDecimal, formatTokenAmount } from '$lib/utils/numberFormatUtils';
	import { tokenStore } from '$lib/services/tokens/tokenStore';
	import { CKUSDT_CANISTER_ID } from '$lib/constants/canisterConstants';

	export let value: string | number = '';
	export let token: FE.Token;
	export let error: string = '';
	export let disabled: boolean = false;
	export let placeholder: string = '0.00';
	export let onTokenSelect: () => void;

	const dispatch = createEventDispatcher();

	// Handle input validation and formatting
	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const newValue = input.value.replace(/[^0-9.]/g, '');
		value = newValue;
		dispatch('input', { value: newValue });
	}

	function setMax() {
		const max = formatTokenAmount(BigInt(rawBalance) - BigInt(token.fee), token.decimals);
		value = max.toString();
		dispatch('input', { value: max.toString() });
	}

	// Use reactive statements to compute derived values
	$: rawBalance = $tokenStore.balances[token.canister_id]?.in_tokens || 0n;
	$: pool = $poolsList.find(p => p.address_0 === token.canister_id && p.address_1 === CKUSDT_CANISTER_ID);
	$: poolPrice = pool?.price ? parseFloat(pool.price.toString()) : 0;
	$: usdValue = formatToNonZeroDecimal(parseFloat(value.toString()) * poolPrice);
	$: formattedBalance = formatTokenAmount(BigInt(rawBalance) - BigInt(token.fee), token.decimals);
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
					w-full px-4 py-4 pr-[8rem]
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
			<button
				type="button"
				on:click={onTokenSelect}
				class="absolute right-0 inset-y-0 flex items-center px-4 gap-2 hover:bg-white/5 rounded-r-lg transition-colors"
			>
				<span class="text-white/50 text-lg font-play">{token.symbol}</span>
				<span class="text-white/50">↓</span>
			</button>
		</div>
	</div>

	<!-- Balance and USD value row -->
	<div class="flex justify-between items-center px-1 text-sm">
		<div class="flex items-center gap-2">
			<span class="text-white/50">Balance: {formattedBalance}</span>
			{#if formattedBalance > 0}
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