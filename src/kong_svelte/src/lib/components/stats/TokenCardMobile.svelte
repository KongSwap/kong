<script lang="ts">
	import { Star, Flame } from "lucide-svelte";
	import TokenImages from "$lib/components/common/TokenImages.svelte";
	import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
	import { formatUsdValue } from "$lib/utils/tokenFormatters";
	import { FavoriteService } from "$lib/services/tokens/favoriteService";

	interface StatsToken extends FE.Token {
		marketCapRank?: number;
		volumeRank?: number;
		isHot?: boolean;
	}

	export let token: StatsToken;
	export let isConnected: boolean;
	export let isFavorite: boolean;
	export let priceClass: string;
	export let trendClass: string;
	export let showHotIcon = false;
</script>

<div 
	class="w-full bg-kong-bg-dark/50 border border-kong-border/50 rounded-lg hover:border-[#60A5FA]/30 hover:bg-kong-bg-dark/80 active:scale-[0.99] transition-all duration-200 overflow-hidden"
>
	<!-- Card Header -->
	<div class="p-2 border-b border-kong-border/30 flex items-center justify-between">
		<div class="flex items-center gap-2">
			{#if isConnected}
				<button
					class="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white/5 active:bg-white/10 transition-colors duration-150"
					on:click|stopPropagation={() => FavoriteService.toggleFavorite(token.canister_id)}
				>
					{#if isFavorite}
						<Star class="w-4 h-4" color="yellow" fill="yellow" />
					{:else}
						<Star class="w-4 h-4 text-kong-text-secondary" />
					{/if}
				</button>
			{/if}
			<TokenImages tokens={[token]} size={20} />
			<span class="text-sm font-semibold text-kong-text-primary">{token.symbol}</span>
			{#if showHotIcon}
				<Flame class="w-4 h-4 text-orange-500" />
			{/if}
		</div>
		<div class="flex flex-col items-end">
			<div class="text-sm font-semibold text-kong-text-primary">
				${formatToNonZeroDecimal(token?.metrics?.price || 0)}
			</div>
			<div class="text-sm font-medium {trendClass}">
				{Number(token?.metrics?.price_change_24h) > 0 ? '+' : ''}
				{formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
			</div>
		</div>
	</div>

	<!-- Card Content -->
	<div class="p-2 grid grid-cols-2 gap-2 text-sm">
		<div class="flex flex-col">
			<div class="text-kong-text-secondary">Market Cap</div>
			<div class="text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.market_cap)}
			</div>
		</div>
		<div class="flex flex-col">
			<div class="text-kong-text-secondary">Volume 24H</div>
			<div class="text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.volume_24h)}
			</div>
		</div>
		<div class="flex flex-col">
			<div class="text-kong-text-secondary">TVL</div>
			<div class="text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.tvl)}
			</div>
		</div>
		<div class="flex flex-col">
			<div class="text-kong-text-secondary">Rank</div>
			<div class="text-kong-text-primary font-medium">
				{token.marketCapRank ? `#${token.marketCapRank}` : '-'}
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	/* Remove all existing styles as we're using inline Tailwind classes */
</style> 