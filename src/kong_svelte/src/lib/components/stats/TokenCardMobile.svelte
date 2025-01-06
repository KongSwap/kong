<script lang="ts">
	import { Star, Flame, PiggyBank, TrendingUp, TrendingDown } from "lucide-svelte";
	import TokenImages from "$lib/components/common/TokenImages.svelte";
	import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
	import { formatUsdValue } from "$lib/utils/tokenFormatters";
	import { FavoriteService } from "$lib/services/tokens/favoriteService";
	import { tooltip } from "$lib/actions/tooltip";
	import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID, KONG_CANISTER_ID } from "$lib/constants/canisterConstants";

	interface StatsToken extends FE.Token {
		marketCapRank?: number;
		volumeRank?: number;
		tvlRank?: number;
		priceChangeRank?: number;
		isHot?: boolean;
	}

	export let token: StatsToken;
	export let isConnected: boolean;
	export let isFavorite: boolean;
	export let priceClass: string;
	export let trendClass: string;
	export let showHotIcon = false;

	$: isExcludedToken = token.canister_id === CKUSDT_CANISTER_ID || token.canister_id === ICP_CANISTER_ID;
	$: isTopVolume = !isExcludedToken && token.volumeRank && token.volumeRank <= 5 && Number(token.metrics?.volume_24h || 0) > 0;
	$: isTopTVL = !isExcludedToken && token.tvlRank && token.tvlRank <= 5 && Number(token.metrics?.tvl || 0) > 0;
	$: isTopGainer = !isExcludedToken && token.priceChangeRank && token.priceChangeRank <= 3 && Number(token.metrics?.price_change_24h || 0) > 0;
	$: isTopLoser = !isExcludedToken && token.priceChangeRank && token.priceChangeRank <= 3 && Number(token.metrics?.price_change_24h || 0) < 0;
	$: isKongToken = token.canister_id === KONG_CANISTER_ID;
</script>

<div class="w-full bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-dark/40 backdrop-blur-sm border {isKongToken ? 'border-kong-primary/50' : 'border-kong-border/30'} rounded-xl hover:border-[#60A5FA]/30 hover:bg-kong-bg-dark/60 active:scale-[0.99] transition-all duration-200 overflow-hidden shadow-sm">
	<div class="px-3 py-2.5 flex items-center justify-between">
		<div class="flex items-center gap-2.5">
			<div class="relative flex items-center">
				<TokenImages tokens={[token]} size={24} />
				{#if isConnected}
					<button
						class="absolute -right-2 -bottom-2 w-5 h-5 flex items-center justify-center rounded-full bg-kong-bg-dark/80 border border-kong-border/30 hover:bg-kong-bg-dark active:scale-95 transition-all duration-150"
						on:click|stopPropagation={() => FavoriteService.toggleFavorite(token.canister_id)}
					>
						{#if isFavorite}
							<Star class="w-3 h-3" color="yellow" fill="yellow" />
						{:else}
							<Star class="w-3 h-3 text-kong-text-secondary" />
						{/if}
					</button>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-1.5">
					<span class="text-base font-semibold text-kong-text-primary">{token.symbol}</span>
					<span class="text-sm text-kong-text-secondary">#{token.marketCapRank || '-'}</span>
					<div class="flex gap-1 items-center">
						{#if isTopVolume}
							<div use:tooltip={{ text: `#${token.volumeRank} by Volume`, direction: "top" }}>
								<Flame class="w-4 h-4 text-orange-400" />
							</div>
						{/if}
						{#if isTopTVL}
							<div use:tooltip={{ text: `#${token.tvlRank} by TVL`, direction: "top" }}>
								<PiggyBank class="w-4 h-4 text-pink-500" />
							</div>
						{/if}
						{#if isTopGainer}
							<div use:tooltip={{ text: `#${token.priceChangeRank} Biggest Gainer (24h)`, direction: "top" }}>
								<TrendingUp class="w-4 h-4 text-green-400" />
							</div>
						{/if}
						{#if isTopLoser}
							<div use:tooltip={{ text: `#${token.priceChangeRank} Biggest Drop (24h)`, direction: "top" }}>
								<TrendingDown class="w-4 h-4 text-red-400" />
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<div class="text-base font-medium text-kong-text-primary">
				${formatToNonZeroDecimal(token?.metrics?.price || 0)}
			</div>
			<div class="text-sm font-medium {trendClass} min-w-[3.5rem] text-right">
				{Number(token?.metrics?.price_change_24h) > 0 ? '+' : ''}
				{formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
			</div>
		</div>
	</div>

	<div class="px-3 py-2 border-t border-kong-border/10 grid grid-cols-2 gap-x-6 gap-y-2">
		<div class="flex justify-between items-center">
			<div class="text-sm text-kong-text-secondary">Market Cap</div>
			<div class="text-sm text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.market_cap)}
			</div>
		</div>
		<div class="flex justify-between items-center">
			<div class="text-sm text-kong-text-secondary">Volume 24H</div>
			<div class="text-sm text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.volume_24h)}
			</div>
		</div>
		<div class="flex justify-between items-center">
			<div class="text-sm text-kong-text-secondary">TVL</div>
			<div class="text-sm text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.tvl)}
			</div>
		</div>
	</div>
</div> 