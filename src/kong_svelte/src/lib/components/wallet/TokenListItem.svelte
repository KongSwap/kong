<script lang="ts">
	import { formatToNonZeroDecimal, formatBalance } from '$lib/utils/numberFormatUtils';
	import { formatCurrency } from '$lib/utils/portfolioUtils';
	import TokenImages from "$lib/components/common/TokenImages.svelte";
	import Badge from "$lib/components/common/Badge.svelte";
	import { currentUserBalancesStore } from "$lib/stores/balancesStore";
	import { formatTokenName } from "$lib/utils/tokenFormatUtils";

	// Define props
	export let token: Kong.Token;
	export let isActive = false;
	export let isSyncing = false;
	export let showUsdValues = true;
	export let onClick = (event: MouseEvent) => {};

	// Determine badge properties based on standard
	let badgeText: string | null = null;
	let badgeVariant: "blue" | "purple" | "green" | "red" | "yellow" | "gray" | "orange" | "icrc" | "solana" = "purple";
	
	// Get balance information from the store
	$: tokenBalance = $currentUserBalancesStore[token.address]?.in_tokens ?? BigInt(0);
	$: tokenUsdValue = $currentUserBalancesStore[token.address]?.in_usd ?? "0";
	
	// Format the balance using token's decimals
	$: formattedBalance = formatBalance(tokenBalance.toString(), token.decimals);
	
	// For display in UI: when the balance is very small but non-zero
	$: displayAmount = formattedBalance && Number(formattedBalance) > 0 && Number(formattedBalance) < 0.00001 
		? "~0.00001" 
		: formattedBalance;

	$: {
		const standard = token.chain;
		if (standard === 'Solana') {
			badgeText = 'SPL';
			badgeVariant = 'blue';
		} else if (standard === 'ICP') { // Assume others are ICP/ICRC for now
			badgeText = token.standards.includes('ICRC-3') ? 'ICRC-3': token.standards.includes('ICRC-2') ? 'ICRC-2' : token.standards.includes('ICRC-1') ? 'ICRC-1' : token.chain;
			badgeVariant = 'icrc';
		} else {
			badgeText = null; // Hide if standard is missing
		}
	}

</script>

<div
	class="px-4 z-[10] !shadow py-3.5 bg-kong-bg-primary border-t border-kong-border/50 hover:bg-kong-primary/10 transition-all duration-200 relative
		{isSyncing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
		{isActive ? 
			'border-l-4 border-l-kong-primary border border-kong-primary/20 shadow-[0_0_15px_rgba(0,0,0,0.1)] bg-kong-primary/10' : 'border-l-2 border-l-transparent'}"
	onclick={(e) => !isSyncing && onClick(e)}
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			{#if token}
					<TokenImages
						tokens={[token]}
						size={38}
						showSymbolFallback={true}
						tooltip={{
							text: token.name,
							direction: "top",
						}}
					/>
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
				<div class="flex items-center gap-1.5">
					<span class="font-medium text-kong-text-primary text-sm leading-tight">
						{formatTokenName(token.name, 25)}
					</span>
				</div>
				<div class="text-xs text-kong-text-secondary mt-1 leading-tight">
					{#if showUsdValues}
						{#if Number(formattedBalance) > 0 && Number(formattedBalance) < 0.00001}
							<span title={formattedBalance}>{displayAmount}</span> {token.symbol}
						{:else}
							{displayAmount} {token.symbol}
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
					{formatCurrency(Number(tokenUsdValue))}
				{:else}
					$****
				{/if}
			</div>
			<div
				class="text-xs {Number(token.metrics.price_change_24h) >= 0
					? 'text-kong-success'
					: 'text-kong-error'} font-medium mt-1 leading-tight"
			>
				{Number(formatToNonZeroDecimal(token.metrics.price_change_24h)) >= 0
					? "+"
					: ""}{formatToNonZeroDecimal(token.metrics.price_change_24h)}%
			</div>
		</div>
	</div>
</div>

<style>
	/* Any local styles if needed */
</style> 