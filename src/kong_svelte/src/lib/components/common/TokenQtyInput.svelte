<svelte:options customElement="token-qty-input" />

<script lang="ts">
	import { livePools } from '$lib/services/pools/poolStore';
	import { formatToNonZeroDecimal, formatBalance } from '$lib/utils/numberFormatUtils';
	import { tokenStore } from '$lib/services/tokens/tokenStore';
	import { CKUSDT_CANISTER_ID } from '$lib/constants/canisterConstants';
	import BigNumber from 'bignumber.js';
	import { createEventDispatcher } from 'svelte';

	interface TokenQtyInputProps {
		value: string | number;
		token: FE.Token;
		error: string;
		disabled?: boolean;
		placeholder?: string;
		onTokenSelect?: () => void | null;
		onInput?: (value: string) => void | null;
	}

	let { value = $bindable(0), token, error, disabled = false, placeholder = 'Enter amount', onTokenSelect = null, onInput = null }: TokenQtyInputProps = $props();

	// Use reactive statements to compute derived values
	let rawBalance = $derived($tokenStore.balances[token.canister_id]?.in_tokens || 0n);
	let pool = $derived($livePools.find(p => p.address_0 === token.canister_id && p.address_1 === CKUSDT_CANISTER_ID));
	let poolPrice = $derived(pool?.price ? parseFloat(pool.price.toString()) : 0);
	let usdValue = $derived(formatToNonZeroDecimal(parseFloat(value.toString()) * poolPrice));
	let formattedBalance = $derived(formatBalance((BigInt(rawBalance) - BigInt(token.fee_fixed)).toString(), token.decimals));

	const dispatch = createEventDispatcher();

	function dispatchInput(value: string) {
		dispatch('input', { value });
	}

	function setMax() {
		const maxBn = new BigNumber(rawBalance.toString()).minus(token.fee_fixed.toString()).toString();
		const formattedMax = formatBalance(maxBn, token.decimals);
		value = formattedMax;
		dispatchInput(formattedMax);
	}

</script>

<div class="flex flex-col gap-2 w-full">
	<div class="relative">
		<div class="relative flex items-center">
			<input
				type="text"
				{placeholder}
				{disabled}
				bind:value
				oninput={(e) => onInput(e.currentTarget.value)}
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
				onclick={onTokenSelect}
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
			{#if Number(formattedBalance) > 0}
				<button
					type="button"
					class="text-yellow-400 hover:text-yellow-300 text-xs uppercase font-play"
					onclick={setMax}
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