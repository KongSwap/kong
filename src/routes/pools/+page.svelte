let searchTerm = searchQuery;
let searchInput = searchQuery;
let poolSearchTerm = writable("");
let searchDebounceTimer: NodeJS.Timeout;
let livePools = writable<BE.Pool[]>([]);
let pagination = writable({ totalItems: 0, totalPages: 0, currentPage: 1, limit: 50 });
let isLoading = writable<boolean>(false);
let mobilePage = 1;
let mobileTotalPages = 1;

onMount(() => {
  if (!browser) return;
  isLoading.set(true);
  loadTokens();

  // Fetch both pools and totals
  Promise.all([
    fetchPools({
      page: pageQuery,
      limit: 50,
      search: searchQuery,
    }),
    fetchPoolTotals(),
  ])
    .then(([poolsResult, totalsResult]) => {
      const poolsArray = poolsResult.pools ? poolsResult.pools : [];
      livePools.set(poolsArray);
      pagination.update(p => ({
        ...p,
        totalItems: poolsResult.total_count,
        totalPages: poolsResult.total_pages,
        currentPage: poolsResult.page,
        limit: poolsResult.limit
      }));
      mobilePage = 1;
      mobileTotalPages = poolsResult.total_pages;

      // Set the totals from API
      poolTotals.set(totalsResult);
    })
    .finally(() => {
      isLoading.set(false);
    });
}); 