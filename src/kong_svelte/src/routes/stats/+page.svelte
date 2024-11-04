<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
<script lang="ts">
	import { writable, derived } from "svelte/store";
	import { t } from "$lib/locales/translations";
	import TableHeader from "$lib/components/common/TableHeader.svelte";
	import { tokensTableHeaders } from "$lib/constants/statsConstants";
	import { filterTokens, sortTableData } from "$lib/utils/statsUtils";
	import { formattedTokens, tokenStore } from "$lib/stores/tokenStore";
	import { goto } from "$app/navigation";
	import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
	import { flip } from "svelte/animate";
	import debounce from "lodash-es/debounce";
	import { formatUSD } from "$lib/utils/numberFormatUtils";
	import { ArrowLeftRight } from "lucide-svelte";

	// Import poolsList from poolStore
	import { poolsList, poolStore } from "$lib/stores/poolStore";
    import { CKUSDT_CANISTER_ID } from "$lib/constants/canisterConstants";
    import { walletStore } from "$lib/stores/walletStore";

	const searchQuery = writable("");

	const debouncedSearch = debounce((value: string) => {
		searchQuery.set(value);
	}, 300);

	const sortColumnStore = writable("formattedUsdValue");
	const sortDirectionStore = writable<"asc" | "desc">("desc");

	// Ensure pool data is loaded
	poolStore.loadPools();

	// Derived store that maps pool prices to tokens
	const tokensWithPrice = derived(
		[formattedTokens, poolsList],
		([$formattedTokens, $poolsList]) => {
			// Create a map of symbol to price from pools
			const poolMap = new Map<string, BE.Pool>();
			// Find the pool that matches the CKUSDT_CANISTER_ID and set the price in the map
			$poolsList.forEach(pool => {
				if (pool.address_0 && pool.address_1 === CKUSDT_CANISTER_ID) {
					poolMap.set(pool.address_0, pool);
				}
			});

			const tokensWithPrice = $formattedTokens.tokens.map(token => {
				const pool = poolMap.get(token.canister_id);
				return {
					...token,
					rolling_24h_volume: pool?.rolling_24h_volume,
					rolling_24h_apy: pool?.rolling_24h_apy,
					balance: pool?.balance,
				};
			});

			return { ...$formattedTokens, tokens: tokensWithPrice };
		}
	);

	// Derived store that filters and sorts tokens based on search query and sort criteria.
	const filteredSortedTokens = derived(
		[tokensWithPrice, searchQuery, sortColumnStore, sortDirectionStore],
		([$tokensWithPrice, $searchQuery, $sortColumn, $sortDirection]) => {
			const filtered = filterTokens($tokensWithPrice.tokens, $searchQuery);
			return sortTableData(filtered, $sortColumn, $sortDirection);
		}
	);

	const tokensLoading = derived(
		[tokenStore, poolStore],
		([$tokenStore, $poolStore]) => $tokenStore.isLoading || $poolStore.isLoading
	);

	const tokensError = derived(
		[tokenStore, poolStore],
		([$tokenStore, $poolStore]) => $tokenStore.error || $poolStore.error
	);

	// Handles sorting events triggered by TableHeader components.
	function handleSortEvent(
		event: CustomEvent<{ column: string; direction: "asc" | "desc" }>
	) {
		const { column, direction } = event.detail;
		sortColumnStore.set(column);
		sortDirectionStore.set(direction);
	}
</script>

<section class="flex min-h-[94vh] relative w-full">
	<!-- Left Spacer -->
	<div class="hidden md:block md:w-[210px] font-alumni z-[2]">
		<!-- Optionally, you can display some stats here -->
	</div>

	<!-- Main Content -->
	<div class="z-10 flex pt-40 justify-center w-full md:w-100 px-2 md:px-0">
		<div class="flex flex-col w-full">
			<div class="inner-border bg-k-light-blue bg-opacity-40 backdrop-blur-md border-[5px] border-black p-0.5 w-full mx-auto">
				<div class="p-4 w-full max-h-[68vh] overflow-y-auto pb-8">
					<!-- Header and Search Bar -->
					<div class="grid grid-cols-3 items-center mb-2 md:mb-0 pb-2">
						<h2 class="pl-1 mt-2 font-black col-span-3 md:col-span-2 text-3xl text-center md:text-left text-white mb-4 text-outline-2">
							{$t('stats.statsTableTitle')}
						</h2>

						<div class="col-span-3 md:col-span-1 flex justify-center md:justify-end">
							<input
								type="text"
								placeholder="Search by symbol or name"
								on:input={(e) => debouncedSearch(e.currentTarget.value)}
								class="w-1/2 bg-sky-200/30 placeholder:text-gray-600 font-alumni text-xl text-black border-none rounded-xl min-w-[160px] focus:ring-green-700 focus:ring-2 p-2.5"
								aria-label="Search Tokens by Symbol or Name"
							/>
						</div>
					</div>

					<!-- Table Container -->
					<div class="overflow-x-scroll">
						{#if $tokensLoading}
							<LoadingIndicator />
						{:else if $tokensError}
							<div class="text-center text-red-500 p-4">{$tokensError}</div>
						{:else}
							<table class="w-full text-black font-alumni">
								<thead>
									<tr class="border-b-4 border-black text-3xl uppercase">
										{#each tokensTableHeaders as header}
											<TableHeader
												label={header.label}
												column={header.column}
												textClass={header.textClass}
												requiresAuth={header.requiresAuth}
												sortColumn={$sortColumnStore}
												sortDirection={$sortDirectionStore}
												on:sort={handleSortEvent}
											/>
										{/each}
									</tr>
								</thead>

								<tbody>
									{#if !$tokensLoading && $filteredSortedTokens.length === 0}
										<tr class="border-b-2 border-black text-xl md:text-3xl">
											<td class="p-2 uppercase font-bold text-center" colspan="50">
												No results found
											</td>
										</tr>
									{:else}
										{#each $filteredSortedTokens as token (token.canister_id)}
											<tr
												class="border-b-2 border-black text-xl md:text-3xl cursor-pointer !h-[4.75rem]"
												animate:flip={{ duration: 300 }}
												tabindex="0"
												aria-label={`View details for token ${token.symbol}`}
											>
												<td class="uppercase font-bold pl-2 focused:ring-0 ring-0 focused:border-none active:border-none">
													<div class="flex items-center">
														<img
															class="inline-block h-11 w-11 rounded-full ring-0 ring-black bg-white object-cover"
															src={token.logo}
															alt={token.symbol}
															loading="lazy"
														/>
                            <span class="ml-2.5">{token.name}</span>
														<span class="ml-2.5">({token.symbol})</span>
													</div>
												</td>
												<td class="p-2 text-right">${formatUSD(token.price)}</td>
												<td class="p-2 text-right">${formatUSD(token.total_24h_volume)}</td>
												{#if $walletStore.isConnected}
													<td class="p-2 text-right">
														<div class="flex flex-col items-end justify-center">
															<span class="text-2xl">{token.formattedBalance} {token.symbol}</span>
															<span class="text-sm">(${token.formattedUsdValue})</span>
														</div>
													</td>
												{/if}
												<td class="p-2">
                          <div
                            class="flex content-center items-center justify-center gap-x-1"
                          >
                            <button
                              on:click={() =>
                                goto(
                                  `/swap?from=${token.canister_id}&to=${CKUSDT_CANISTER_ID}`,
                                )}
                              class="rounded-full text-nowrap bg-[#6ebd40] border-2 border-black px-2 py-1 flex items-center justify-center text-xl hover:bg-[#498625] hover:text-white"
                            >
                              <ArrowLeftRight size={18} class="mr-1" /> Swap
                            </button>
                          </div>
                        </td>
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Right Spacer -->
	<div class="hidden md:block md:w-[210px] font-alumni z-[2]">
		<!-- Optionally, additional content -->
	</div>
</section>

<style scoped>
	.inner-border {
		box-shadow: inset 0 0 0 2px white;
	}

	tr {
		transition: background-color 0.3s ease, transform 0.3s ease;
	}

	tbody tr:hover {
		background-image: linear-gradient(
			to right,
			rgba(27, 224, 99, 0.5),
			rgba(255, 225, 0, 0.509)
		);
	}

	/* Accessibility Enhancements */
	tr:focus {
		outline: 2px solid #3b82f6; /* Tailwind blue-500 */
		outline-offset: -2px;
	}
</style>