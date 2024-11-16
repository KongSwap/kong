<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
<script lang="ts">
	import { writable, derived } from "svelte/store";
	import Panel from "$lib/components/common/Panel.svelte";
	import TableHeader from "$lib/components/common/TableHeader.svelte";
	import TokenImages from "$lib/components/common/TokenImages.svelte";
	import Clouds from "$lib/components/stats/Clouds.svelte";
	import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
	import { poolStore } from "$lib/services/pools/poolStore";
	import { walletStore } from "$lib/services/wallet/walletStore";
	import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
	import { filterTokens, sortTableData } from "$lib/utils/statsUtils";
	import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
	import { flip } from "svelte/animate";
	import debounce from "lodash-es/debounce";
	import { ArrowUpDown, TrendingUp, Droplets, DollarSign } from 'lucide-svelte';

	// State management
	const searchQuery = writable("");
	const activeView = writable("tokens"); // tokens, pools
	const sortColumn = writable("formattedUsdValue");
	const sortDirection = writable("desc");
	const copyStates = writable({});

	// Derived stores for filtered/sorted data
	const filteredSortedTokens = derived(
		[formattedTokens, searchQuery, sortColumn, sortDirection],
		([$formattedTokens, $searchQuery, $sortColumn, $sortDirection]) => {
			if (!$formattedTokens) return [];
			const filtered = filterTokens($formattedTokens, $searchQuery);
			return sortTableData(filtered, $sortColumn, $sortDirection);
		}
	);

	// Market stats
	const marketStats = derived([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
		const totalVolume = $poolStore.pools.reduce((acc, pool) => {
			const volume = Number(pool.rolling_24h_volume || 0n) / 1e8;
			return acc + volume;
		}, 0);
		
		const totalLiquidity = $poolStore.pools.reduce((acc, pool) => {
			const tvl = Number(pool.tvl || 0n) / 1e8;
			return acc + tvl;
		}, 0);
		
		const totalFees = $poolStore.pools.reduce((acc, pool) => {
			const fees = Number(pool.rolling_24h_lp_fee || 0n) / 1e8;
			return acc + fees;
		}, 0);
		
		return {
			totalVolume: formatToNonZeroDecimal(totalVolume),
			totalLiquidity: formatToNonZeroDecimal(totalLiquidity),
			totalFees: formatToNonZeroDecimal(totalFees)
		};
	});

	function copyToClipboard(tokenId: string) {
		navigator.clipboard.writeText(tokenId);
		copyStates.update(states => ({ ...states, [tokenId]: "Copied!" }));
		setTimeout(() => {
			copyStates.update(states => ({ ...states, [tokenId]: "Copy" }));
		}, 1000);
	}

	const debouncedSearch = debounce((value: string) => {
		searchQuery.set(value);
	}, 300);

	let sortedAndFilteredPools = derived(poolStore, ($poolStore) => {
		return [...$poolStore.pools].sort((a, b) => {
			const tvlA = Number(a.tvl || 0n);
			const tvlB = Number(b.tvl || 0n);
			return tvlB - tvlA; // Sort by TVL in descending order
		});
	});

	const poolsLoading = derived(poolStore, $store => $store.isLoading);
	const poolsError = derived(poolStore, $store => $store.error);
</script>

<Clouds />

<div class="stats-container">
	<Panel variant="green" type="main" className="market-stats-panel">
		<div class="market-stats-grid">
			<div class="stat-card">
				<div class="stat-icon-wrapper">
					<DollarSign class="stat-icon" />
				</div>
				<div class="stat-content">
					<h3>Total Volume (24h)</h3>
					<p>${$marketStats.totalVolume}</p>
				</div>
			</div>
			<div class="stat-card">
				<div class="stat-icon-wrapper">
					<Droplets class="stat-icon" />
				</div>
				<div class="stat-content">
					<h3>Total Liquidity</h3>
					<p>${$marketStats.totalLiquidity}</p>
				</div>
			</div>
			<div class="stat-card">
				<div class="stat-icon-wrapper">
					<DollarSign class="stat-icon" />
				</div>
				<div class="stat-content">
					<h3>Total Fees (24h)</h3>
					<p>${$marketStats.totalFees}</p>
				</div>
			</div>
		</div>
	</Panel>

	<div class="panels-grid">
		<Panel variant="green" type="main" className="content-panel">
			<h3 class="text-white/80 font-medium mb-4">Tokens</h3>
			<div class="table-container">
				<table class="data-table">
					<thead>
						<tr>
							<th>Token</th>
							<th>Price</th>
							<th>Volume</th>
						</tr>
					</thead>
					<tbody>
						{#each $filteredSortedTokens as token (token.canister_id)}
							<tr animate:flip={{ duration: 300 }}>
								<td class="token-cell">
									<TokenImages tokens={[token]} containerClass="token-image" />
									<span class="token-name">{token.name}</span>
								</td>
								<td>${formatToNonZeroDecimal($tokenStore.prices[token.canister_id] || 0)}</td>
								<td>${formatToNonZeroDecimal(token.total_24h_volume || 0)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Panel>

		<Panel variant="green" type="main" className="content-panel">
			<h3 class="text-white/80 font-medium mb-4">Pools</h3>
			<div class="table-container">
				{#if $poolsLoading}
					<div class="flex items-center justify-center h-full">
						<LoadingIndicator />
					</div>
				{:else if $poolsError}
					<div class="text-red-400 text-center p-4">
						{$poolsError}
					</div>
				{:else if $sortedAndFilteredPools.length === 0}
					<div class="text-white/60 text-center p-4">
						No pools available
					</div>
				{:else}
					<table class="data-table">
						<thead class="table-header">
							<tr>
								<th class="text-left p-4 w-[30%]">
									<span>Pool</span>
								</th>
								<th class="text-right p-4 w-[25%]">
									<span>TVL</span>
								</th>
								<th class="text-right p-4 w-[25%]">
									<span>Volume (24h)</span>
								</th>
								<th class="text-right p-4">
									<span>APY</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{#each $sortedAndFilteredPools as pool (pool.pool_id)}
								<tr class="hover:bg-white/5">
									<td class="text-left p-4">
										<div class="flex items-center gap-2">
											<span class="font-medium">{pool.symbol_0}/{pool.symbol_1}</span>
										</div>
									</td>
									<td class="text-right p-4">
										${formatToNonZeroDecimal(Number(pool.tvl || 0n) / 1e6)}
									</td>
									<td class="text-right p-4">
										${formatToNonZeroDecimal(Number(pool.rolling_24h_volume || 0n) / 1e6)}
									</td>
									<td class="text-right p-4">
										<span class="text-emerald-400">
											{formatToNonZeroDecimal(pool.rolling_24h_apy)}%
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</Panel>
	</div>
</div>

<style lang="postcss">
	:global(.clouds-container) { @apply fixed inset-0 -z-10; }
	
	.stats-container { 
		@apply w-full flex flex-col gap-4 p-4 relative z-10;
	}
	
	.market-stats-grid { 
		@apply grid grid-cols-1 md:grid-cols-3 gap-6 p-6;
	}
	
	.panels-grid { 
		@apply grid grid-cols-1 md:grid-cols-2 gap-4;
		height: calc(100% - 11rem); /* Account for market stats + gaps */
	}
	
	.table-container { 
		@apply overflow-auto;
		height: calc(100% - 3rem); /* Account for header */
	}
	
	.data-table {
		@apply w-full;
		th { @apply sticky top-0 bg-black/20 backdrop-blur-sm text-left py-2 px-3 text-white/60 text-sm font-medium border-b border-white/10; }
		td { @apply py-2 px-3 border-b border-white/5 text-sm; }
	}
	
	.token-cell, .pool-cell { @apply flex items-center gap-3; }
	.token-name { @apply text-white font-medium; }
	
	@media (max-width: 768px) {
		.stats-container { @apply gap-3 p-3; }
		.market-stats-grid { @apply grid-cols-1 gap-3; }
		.panels-grid { 
			@apply grid-cols-1 gap-3;
			height: auto;
		}
		.table-container { 
			height: 300px; /* Fixed height on mobile */
		}
	}
	
	.table-container {
		@apply overflow-auto rounded-lg border border-white/10;
		height: calc(100% - 3rem);
	}

	.table-header {
		@apply bg-black/20 backdrop-blur-sm sticky top-0 z-10;
	}

	.data-table {
		@apply w-full border-collapse;
	}

	th {
		@apply text-white/60 font-medium text-sm;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	td {
		@apply text-white/90 text-sm;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	tr:last-child td {
		border-bottom: none;
	}

	.stat-card {
		@apply flex items-center gap-4 p-6 rounded-xl bg-white/5 backdrop-blur-sm 
			   border border-white/10 transition-all duration-200 hover:bg-white/10;
	}
	
	.stat-icon-wrapper {
		@apply p-3 rounded-lg bg-emerald-500/20 text-emerald-400;
	}
	
	.stat-icon {
		@apply w-6 h-6;
	}
	
	.stat-content {
		@apply flex flex-col gap-1;
		
		h3 {
			@apply text-white/60 text-sm font-medium;
		}
		
		p {
			@apply text-white text-xl font-semibold;
		}
	}
</style>
