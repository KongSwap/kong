<script lang="ts">
	import { Flame, PiggyBank, TrendingUp, TrendingDown } from "lucide-svelte";
	import TokenImages from "$lib/components/common/TokenImages.svelte";
	import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
	import { formatUsdValue } from "$lib/utils/tokenFormatters";
	import { tooltip } from "$lib/actions/tooltip";
	import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from "$lib/constants/canisterConstants";

	export let token: FE.StatsToken;
	export let trendClass: string;
	export let showAdvancedStats = false;
	export let showIcons = true;
	export let paddingClass = "px-3 py-1";
	export let showIndex = null;
	export let section = "top-gainers";
	export let topTokens: { gainers: Kong.Token[], losers: Kong.Token[], hottest: Kong.Token[], top_volume: Kong.Token[] } = { gainers: [], losers: [], hottest: [], top_volume: [] };

	$: isExcludedToken = token.address === CKUSDT_CANISTER_ID || token.address === ICP_CANISTER_ID;
	$: isTopVolume = !isExcludedToken && topTokens.top_volume.some(t => t.address === token.address) && Number(token.metrics?.volume_24h || 0) > 0;
	$: isTopTVL = false; // Disabled for now since we don't have top TVL data from fetchTopTokens
	$: isTopGainer = !isExcludedToken && topTokens.gainers.some(t => t.address === token.address) && Number(token.metrics?.price_change_24h || 0) > 0;
	$: isTopLoser = !isExcludedToken && topTokens.losers.some(t => t.address === token.address) && Number(token.metrics?.price_change_24h || 0) < 0;
	
	// Get the rank for display in tooltips
	$: volumeRank = isTopVolume ? topTokens.top_volume.findIndex(t => t.address === token.address) + 1 : undefined;
	$: gainerRank = isTopGainer ? topTokens.gainers.findIndex(t => t.address === token.address) + 1 : undefined;
	$: loserRank = isTopLoser ? topTokens.losers.findIndex(t => t.address === token.address) + 1 : undefined;

	// Use market cap rank for stats list, otherwise use showIndex for top gainers/losers
	$: displayRank = section === "stats-list" ? token.metrics?.market_cap_rank : (showIndex !== null ? showIndex + 1 : null);
</script>

<div class="w-full min-w-0 bg-kong-bg-secondary backdrop-blur-sm border hover:bg-kong-bg-secondary border-kong-border/30 rounded-xl hover:border-[#60A5FA]/30 hover:bg-kong-bg-primary/60 active:scale-[0.99] transition-all duration-200 overflow-hidden shadow-sm">
	<div class="{paddingClass} flex items-center justify-between">
		<div class="flex items-center gap-2.5 min-w-0 flex-1">
			<div class="relative flex items-center gap-2 flex-shrink-0">
				{#if displayRank !== null}
					<span class="w-6 text-kong-text-secondary">{displayRank}.</span>
				{/if}
				<TokenImages tokens={[token]} size={20} showNetworkIcon />
			</div>
			<div class="flex flex-col gap-0.5 min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<div class="flex items-center gap-1.5 min-w-0 flex-1">
						<div class="font-medium text-kong-text-primary text-ellipsis overflow-hidden whitespace-nowrap">{token.symbol}</div>
						{#if showIcons}
							<div class="flex gap-1 items-center">
								{#if isTopVolume}
									<div use:tooltip={{ text: `#${volumeRank} by Volume`, direction: "top" }}>
										<Flame class="w-4 h-4 text-orange-400" />
									</div>
								{/if}
								{#if isTopTVL}
									<div use:tooltip={{ text: `Top TVL`, direction: "top" }}>
										<PiggyBank class="w-4 h-4 text-pink-500" />
									</div>
								{/if}
								{#if isTopGainer}
									<div use:tooltip={{ text: `#${gainerRank} Biggest Gainer (24h)`, direction: "top" }}>
										<TrendingUp class="w-4 h-4 text-green-400" />
									</div>
								{/if}
								{#if isTopLoser}
									<div use:tooltip={{ text: `#${loserRank} Biggest Drop (24h)`, direction: "top" }}>
										<TrendingDown class="w-4 h-4 text-red-400" />
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
				{#if section === "stats-list"}
					<div class="text-xs text-kong-text-secondary text-left">
						{formatUsdValue(token?.metrics?.market_cap)}
					</div>
				{/if}
			</div>
		</div>
		<div class="flex flex-col items-end gap-0.5 flex-shrink-0 min-w-[80px]">
			{#if section === "top-volume"}
				<div class="font-medium text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-orange-600 to-red-500">
					${formatToNonZeroDecimal(token?.metrics?.volume_24h)}
				</div>
			{:else if section === "stats-list"}
				<div class="font-medium text-kong-text-primary text-right">
					${formatToNonZeroDecimal(token?.metrics?.price)}
				</div>
				<div class="font-medium {trendClass} text-xs text-right">
					{formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
				</div>
			{:else}
				<div class="font-medium {trendClass} min-w-[3.5rem] text-right">
					{formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
				</div>
			{/if}
		</div>
	</div>

	{#if showAdvancedStats}
		<div class="px-3 py-2 border-t border-kong-border/10 grid grid-cols-2 gap-x-6 gap-y-2">
			<div class="flex justify-between items-center">
			<div class="text-kong-text-secondary">Market Cap</div>
			<div class="text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.market_cap)}
			</div>
		</div>
		<div class="flex justify-between items-center">
			<div class="text-kong-text-secondary">Volume 24H</div>
			<div class="text-kong-text-primary font-medium">
				{formatUsdValue(token?.metrics?.volume_24h)}
			</div>
		</div>
		<div class="flex justify-between items-center">
			<div class="text-kong-text-secondary">TVL</div>
			<div class="text-kong-text-primary font-medium">
					{formatUsdValue(token?.metrics?.tvl)} (${Number(token.metrics.market_cap) / Number(token?.metrics?.tvl) * 100}%)
				</div>
			</div>
		</div>
	{/if}
</div> 