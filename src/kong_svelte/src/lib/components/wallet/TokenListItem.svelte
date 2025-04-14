<script lang="ts">
	import { formatToNonZeroDecimal, formatBalance } from '$lib/utils/numberFormatUtils';
	import { formatCurrency } from '$lib/utils/portfolioUtils';
	import TokenImages from "$lib/components/common/TokenImages.svelte";

	// Define props
	export let token: {
		symbol: string;
		name: string;
		balance: string;
		usdValue: number;
		icon: string;
		change24h: number;
		token: FE.Token;
	};
	export let isActive = false;
	export let isSyncing = false;
	export let showUsdValues = true;
	export let onClick = (event: MouseEvent) => {};
</script>

<div
	class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-all duration-200 relative
		{isSyncing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
		{isActive ? 
			'active-token-gradient border-l-2 border-l-kong-primary shadow-[0_0_15px_rgba(0,0,0,0.1)] active-token' : 'border-l-2 border-l-transparent'}"
	on:click={(e) => !isSyncing && onClick(e)}
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			{#if token.token}
				<div class="flex-shrink-0">
					<TokenImages
						tokens={[token.token]}
						size={36}
						showSymbolFallback={true}
						tooltip={{
							text: token.name,
							direction: "top",
						}}
					/>
				</div>
			{:else}
				<div
					class="w-9 h-9 rounded-full bg-kong-text-primary/10 flex items-center justify-center border border-kong-border flex-shrink-0"
				>
					<span class="text-xs font-bold text-kong-primary"
						>{token.symbol}</span
					>
				</div>
			{/if}
			<div class="flex flex-col justify-center">
				<div class="font-medium text-kong-text-primary text-sm leading-tight">
					{token.name}
				</div>
				<div class="text-xs text-kong-text-secondary mt-1 leading-tight">
					{#if showUsdValues}
						{#if Number(token.balance) > 0 && Number(token.balance) < 0.00001}
							<span title={token.balance.toString()}>~0.00001</span> {token.symbol}
						{:else}
							{token.balance} {token.symbol}
						{/if}
					{:else}
						**** {token.symbol}
					{/if}
				</div>
			</div>
		</div>

		<div class="text-right flex flex-col justify-center">
			<div class="font-medium text-kong-text-primary text-sm leading-tight">
				{#if showUsdValues}
					{formatCurrency(token.usdValue)}
				{:else}
					$ ****
				{/if}
			</div>
			<div
				class="text-xs {token.change24h >= 0
					? 'text-kong-accent-green'
					: 'text-kong-accent-red'} font-medium mt-1 leading-tight"
			>
				{Number(formatToNonZeroDecimal(token.change24h)) >= 0
					? "+"
					: ""}{formatToNonZeroDecimal(token.change24h)}%
			</div>
		</div>
	</div>
</div>

<style>
	/* Any local styles if needed */
</style> 