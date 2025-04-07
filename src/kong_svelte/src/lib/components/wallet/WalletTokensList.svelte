<script lang="ts">
	import { formatToNonZeroDecimal, formatBalance } from '$lib/utils/numberFormatUtils';
	import { formatCurrency } from '$lib/utils/portfolioUtils';
	import { Coins, Loader2, RefreshCw, Shuffle, Check, AlertCircle, Plus, Minus, Upload, Settings, ChevronRight } from "lucide-svelte";
	import TokenImages from "$lib/components/common/TokenImages.svelte";
	import TokenDropdown from "./TokenDropdown.svelte";
	import { userTokens } from "$lib/stores/userTokens";
	import { currentUserBalancesStore, loadBalances } from "$lib/stores/balancesStore";
	import { fade, slide } from "svelte/transition";
	import { onMount } from "svelte";
	import Modal from "$lib/components/common/Modal.svelte";
	import AddNewTokenModal from "$lib/components/wallet/AddNewTokenModal.svelte";
	import ManageTokensModal from "$lib/components/wallet/ManageTokensModal.svelte";
	import ReceiveTokenModal from "$lib/components/wallet/ReceiveTokenModal.svelte";
	import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";

	// Define props using the $props syntax
	type TokenBalance = {
		symbol: string;
		name: string;
		balance: string;
		usdValue: number;
		icon: string;
		change24h: number;
		token: FE.Token;
	};

	type WalletTokensListProps = {
		isLoading?: boolean;
		walletId?: string;
		forceRefresh?: boolean;
		// Optional pre-processed token balances (for backward compatibility)
		tokenBalances?: TokenBalance[];
		// Callback props instead of event dispatchers
		onAction?: (action: 'send' | 'receive' | 'swap' | 'info', token: TokenBalance) => void;
		onRefresh?: () => void;
		onTokenAdded?: (token: FE.Token) => void;
		onBalancesLoaded?: () => void;
	};

	let { 
		isLoading = false,
		walletId = "",
		forceRefresh = false,
		tokenBalances = [],
		onAction = () => {},
		onRefresh = () => {},
		onTokenAdded = () => {},
		onBalancesLoaded = () => {}
	}: WalletTokensListProps = $props();

	// Process tokens with balance information when we need to do it internally
	const processedTokenBalances = $derived(
		// If tokenBalances were provided, use them (backward compatibility)
		tokenBalances.length > 0 ? tokenBalances :
		// Otherwise process them internally
		(() => {
			console.log('[WalletTokensList] Recalculating derived processedTokenBalances...');
			const currentEnabled = $userTokens.enabledTokens;
			const tokenDataMap = $userTokens.tokenData; // Use the derived Map directly

			// Iterate over enabled tokens, look up data, process, and filter out any missing tokens
			const processed = Array.from(currentEnabled)
				.map(canisterId => {
					const token = tokenDataMap.get(canisterId); // Use the derived Map
					if (!token) {
						console.warn(`[WalletTokensList] Enabled token ${canisterId} not found in tokenData map during derived recalc.`);
						return null; // Skip if token data isn't available for some reason
					}

					const balanceInfo = $currentUserBalancesStore?.[token.canister_id];
					// Use the existing default logic which should be fine
					const effectiveBalanceInfo = balanceInfo || {
						in_tokens: 0n,
						in_usd: "0",
					};

					// Safely convert in_usd to number, handling non-numeric strings
					const usdValue = effectiveBalanceInfo.in_usd
						? parseFloat(effectiveBalanceInfo.in_usd)
						: 0;

					return {
						symbol: token.symbol,
						name: token.name,
						balance: formatBalance(effectiveBalanceInfo.in_tokens, token.decimals || 0),
						usdValue: isNaN(usdValue) ? 0 : usdValue,
						icon: token.logo_url || "",
						change24h: token.metrics?.price_change_24h
							? parseFloat(token.metrics.price_change_24h)
							: 0,
						token: token, // Store the original token object for TokenImages
					};
				})
				.filter((item): item is TokenBalance => item !== null); // Filter out any nulls (missing tokens)


			const sorted = processed.sort((a, b) => b.usdValue - a.usdValue); // Sort by value, highest first
			console.log(`[WalletTokensList] Finished calculating derived state. Displaying ${sorted.length} tokens.`);
			return sorted;
		})()
	);

	let isLoadingBalances = $state(false);
	let balanceLoadError = $state<string | null>(null);
	let lastRefreshed = $state(Date.now());
	let isSyncing = $state(false);
	let syncStatus = $state<{added: number, removed: number} | null>(null);
	let showSyncStatus = $state(false);
	let showSyncResultModal = $state(false);
	let showAddTokenModal = $state(false);
	let showManageTokensModal = $state(false);
	let showSyncConfirmModal = $state(false);
	let showReceiveTokenModal = $state(false);
	let tokenSyncCandidates = $state<{tokensToAdd: FE.Token[], tokensToRemove: FE.Token[]}>({
		tokensToAdd: [],
		tokensToRemove: []
	});

	// Load user balances function
	async function loadUserBalances(forceRefresh = false) {
		if (!walletId || $userTokens.tokens.length === 0) return;

		balanceLoadError = null;
		isLoadingBalances = true;
		
		try {
			// Always force refresh when explicitly requested
			if (forceRefresh) {				
				// Request balance refresh for all tokens, not just enabled ones
				// This helps discover tokens that have balances but aren't enabled
				const allTokens = $userTokens.tokens;				
				const balances = await loadBalances(allTokens, walletId, true);
				console.log(`Received balances for ${Object.keys(balances).length} tokens`);
				
				// Find tokens with non-zero balances that aren't enabled
				const tokensWithBalance = Object.entries(balances)
					.filter(([_, balance]) => balance.in_tokens > 0n)
					.map(([canisterId]) => canisterId);
					
				console.log(`Found ${tokensWithBalance.length} tokens with non-zero balances`);
				
				lastRefreshed = Date.now();
				
				// Force token data refresh after balances are loaded
				await userTokens.refreshTokenData();
				
				onBalancesLoaded();
			} else {
				// For normal updates, check if we need to refresh
				const needsRefresh =
					Object.keys($currentUserBalancesStore || {}).length === 0 ||
					Date.now() - lastRefreshed > 30000; // Reduced to 30 seconds for more frequent updates
				
				if (needsRefresh) {
					// OPTIMIZATION: Only load balances for ENABLED tokens during normal refresh
					const enabledTokenIds = $userTokens.enabledTokens;
					const enabledTokens = $userTokens.tokens.filter(token =>
						token.canister_id && enabledTokenIds.has(token.canister_id)
					);
					console.log(`Performing normal balance refresh for ${enabledTokens.length} enabled tokens...`);
					if (enabledTokens.length > 0) {
						await loadBalances(enabledTokens, walletId, true);
						lastRefreshed = Date.now();
						onBalancesLoaded();
					}
				}
			}
		} catch (err) {
			console.error("Error loading balances:", err);
			balanceLoadError =
				err instanceof Error ? err.message : "Failed to load balances";
		} finally {
			isLoadingBalances = false;
		}
	}

	// Sync tokens based on actual balances
	async function handleSyncTokens(skipInitialRefresh = false) {
		if (!walletId || isSyncing) return;

		isSyncing = true;
		syncStatus = null;
		showSyncStatus = false;

		try {
			// Make sure we have the latest balances before analyzing tokens
			if (!skipInitialRefresh) {
				console.log("Refreshing all balances before token sync...");
				await loadUserBalances(true);
			}

			// Use the userTokens store to analyze tokens
			console.log("Analyzing user tokens for walletId:", walletId);
			const result = await userTokens.analyzeUserTokens(walletId);
			
			tokenSyncCandidates = {
				tokensToAdd: result.tokensToAdd,
				tokensToRemove: result.tokensToRemove
			};
			
			// Only show confirmation if there are changes to make
			if (result.syncStatus && (result.syncStatus.added > 0 || result.syncStatus.removed > 0)) {
				showSyncConfirmModal = true;
			} else {
				// No changes needed, just show a status notification
				syncStatus = { added: 0, removed: 0 };
				showSyncStatus = true;
				setTimeout(() => {
					showSyncStatus = false;
				}, 3000);
			}
		} catch (error) {
			console.error("Error analyzing tokens:", error);
			syncStatus = { added: 0, removed: 0 };
			showSyncResultModal = true;
		} finally {
			isSyncing = false;
		}
	}

	// Apply token changes after user confirmation
	async function confirmAndApplyTokenChanges() {
		try {
			// Use the userTokens store to apply the changes
			syncStatus = await userTokens.applyTokenSync(
				tokenSyncCandidates.tokensToAdd,
				tokenSyncCandidates.tokensToRemove
			);
			
			// Show small inline indicator for immediate feedback
			showSyncStatus = true;
			setTimeout(() => {
				showSyncStatus = false;
			}, 3000);
			
			// Close the confirmation modal and open the results modal
			showSyncConfirmModal = false;
			showSyncResultModal = true;
			
			// Refresh balances to reflect the changes
			if (syncStatus.added > 0 || syncStatus.removed > 0) {
				// Complete refresh sequence:
				// 1. First force a token data refresh
				console.log("Refreshing token data after sync...");
				await userTokens.refreshTokenData();
				console.log("Refreshing balances after sync...");
				await loadUserBalances(true);
			}
		} catch (error) {
			console.error("Error applying token changes:", error);
			syncStatus = { added: 0, removed: 0 };
			showSyncResultModal = true;
		}
	}

	// Cancel the sync operation
	function cancelSync() {
		tokenSyncCandidates = { tokensToAdd: [], tokensToRemove: [] };
		showSyncConfirmModal = false;
	}

	// Close the sync result modal
	function closeSyncResultModal() {
		showSyncResultModal = false;
	}

	// Open the add token modal
	function openAddTokenModal() {
		showAddTokenModal = true;
	}

	// Close the add token modal
	function closeAddTokenModal() {
		showAddTokenModal = false;
	}
	
	// Open the manage tokens modal
	function openManageTokensModal() {
		showManageTokensModal = true;
	}

	// Close the manage tokens modal
	function closeManageTokensModal() {
		showManageTokensModal = false;
		// Refresh balances after managing tokens
		loadUserBalances(true);
	}

	// Handle when a new token is added
	function handleNewTokenAdded(event: CustomEvent<FE.Token>) {
		const newToken = event.detail;
		// Call the onTokenAdded callback from props
		onTokenAdded(newToken);
		// Load balances to show the new token
		loadUserBalances(true);
	}

	// For dropdown - use $state for proper reactivity in Svelte 5
	let selectedToken = $state<TokenBalance | null>(null);
	let selectedTokenId = $state<string | null>(null);
	let selectedTokenElement = $state<HTMLElement | null>(null);
	let showDropdown = $state(false);
	
	// Handle token click to show dropdown
	function handleTokenClick(event: MouseEvent, token: TokenBalance) {
		// Prevent opening dropdown if syncing or already selected
		if (isSyncing) return;
		
		// If clicking the same token that's already open, close it
		if (selectedTokenId === token.token?.canister_id && showDropdown) {
			closeDropdown();
			return;
		}
		
		const target = event.currentTarget as HTMLElement;
		selectedTokenElement = target;
		selectedToken = token;
		selectedTokenId = token.token?.canister_id || null;
		showDropdown = true;
		
		// Add click outside listener
		setTimeout(() => {
			document.addEventListener('click', handleClickOutside);
		}, 0);
	}
	
	// Close the dropdown
	function closeDropdown() {
		showDropdown = false;
		document.removeEventListener('click', handleClickOutside);
	}

	// Handle click outside to close dropdown
	function handleClickOutside(event: MouseEvent) {
		if (selectedTokenElement && !selectedTokenElement.contains(event.target as Node)) {
			closeDropdown();
		}
	}

	// Clean up listeners on component unmount
	onMount(() => {
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
	
	// Handle dropdown action selection
	function handleDropdownAction(action: 'send' | 'receive' | 'swap' | 'info' | 'copy') {
		if (selectedToken) {
			if (action === 'receive') {
				showReceiveTokenModal = true;
				return; // Don't close the dropdown
			} else if (action === 'copy') {
				// Copy action is handled directly in the TokenDropdown component
				return; // Don't close the dropdown
			} else if (action === 'send') {
				// Handle send action without closing dropdown
				onAction(action, selectedToken);
				return; // Don't close the dropdown
			} else {
				onAction(action, selectedToken);
			}
		}
		closeDropdown();
	}

	// Handle refresh button click
	function handleRefresh() {
		if (walletId) {
			loadUserBalances(true);
		}
		onRefresh();
	}

	// Effect to load balances when walletId changes or on forceRefresh
	$effect(() => {
		if (walletId) {
			// Always load balances on initial component mount or when explicitly requested
			loadUserBalances(forceRefresh);
		}
	});

	// Close the receive token modal
	function closeReceiveTokenModal() {
		showReceiveTokenModal = false;
	}
	
	// --- Token Discovery Cache ---
	let allAvailableTokensCache: FE.Token[] = [];
	let allAvailableTokensCacheTimestamp = 0;
	const CACHE_DURATION = 30 * 1000; // 30 seconds
	// ---------------------------

	// Run a thorough token discovery process that finds tokens with balances
	async function runTokenDiscovery() {
		if (!walletId || isLoadingBalances || isSyncing) return;
		
		// Show loading state
		isLoadingBalances = true;
		isSyncing = true;
		
		try {
			// 1. First, load a fresh list of all available tokens (with caching)
			console.log("Starting thorough token discovery process...");
			let allAvailableTokens: FE.Token[];
			const now = Date.now();

			if (now - allAvailableTokensCacheTimestamp < CACHE_DURATION && allAvailableTokensCache.length > 0) {
				console.log("Using cached list of all available tokens.");
				allAvailableTokens = allAvailableTokensCache;
			} else {
				console.log("Fetching fresh list of all available tokens.");
				const { fetchAllTokens } = await import("$lib/api/tokens");
				allAvailableTokens = await fetchAllTokens();
				allAvailableTokensCache = allAvailableTokens; // Update cache
				allAvailableTokensCacheTimestamp = now;    // Update timestamp
			}
			console.log(`Fetched or cached ${allAvailableTokens.length} tokens from the API`);
			
			// 2. Split tokens into manageable batches to avoid overwhelming the network
			const BATCH_SIZE = 25;
			const batches = [];
			for (let i = 0; i < allAvailableTokens.length; i += BATCH_SIZE) {
				batches.push(allAvailableTokens.slice(i, i + BATCH_SIZE));
			}
			
			// 3. Go through each batch and check balances
			let tokensWithBalance = [];
			const allFetchedBalances = new Map<string, { in_tokens: bigint; in_usd: string }>(); // Store all fetched balances

			for (let i = 0; i < batches.length; i++) {
				const batch = batches[i];
				const batchBalances = await loadBalances(batch, walletId, true);

				// Store balances in our combined map
				Object.entries(batchBalances).forEach(([canisterId, balanceData]) => {
					allFetchedBalances.set(canisterId, balanceData);
				});

				// Find tokens with non-zero balances in this batch
				const batchTokensWithBalance = batch.filter(token => {
					if (!token.canister_id) return false;
					const balance = batchBalances[token.canister_id];
					return balance && balance.in_tokens > 0n;
				});
				
				if (batchTokensWithBalance.length > 0) {
					tokensWithBalance.push(...batchTokensWithBalance);
				}
				
				// Pause between batches to avoid rate limiting
				if (i < batches.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			}
			
			// 4. Identify which tokens to add (tokens with balance not already enabled)
			if (tokensWithBalance.length > 0) {				
				// Get current enabled token IDs
				const enabledTokenIds = $userTokens.enabledTokens;
				
				// Find which tokens should be added (have balance but aren't enabled)
				const tokensToAdd = tokensWithBalance.filter(token => 
					token.canister_id && !enabledTokenIds.has(token.canister_id)
				);
								
				// Find which tokens could be removed (are enabled but have zero balance)
				// We'll need to check balances for all currently enabled tokens
				const currentEnabledTokens = $userTokens.tokens
					.filter(token => token.canister_id && enabledTokenIds.has(token.canister_id));
				
				// Check balances for these tokens if we haven't already
				// OPTIMIZATION: Use the already fetched balances instead of a new call
				// const enabledTokenBalances = await loadBalances(currentEnabledTokens, walletId, true);

				// Find tokens with zero balance (potential removal candidates) using the fetched balances
				const tokensToRemove = currentEnabledTokens.filter(token => {
					// Skip essential tokens that should never be removed
					if (!token.canister_id) return false;

					// Check if it's an essential token that should never be removed
					const essentialTokenIds = [
						"ryjl3-tyaaa-aaaaa-aaaba-cai", // ICP
						"mxzaz-hqaaa-aaaar-qaada-cai", // CKBTC
						"ss2fx-dyaaa-aaaar-qacoq-cai", // CKETH
						"djua2-fiaaa-aaaar-qaazq-cai", // CKUSDC
						"aanaa-xaaaa-aaaah-aaeiq-cai", // CKUSDT
					];
					if (essentialTokenIds.includes(token.canister_id)) return false;

					// Check if it has zero balance using the combined fetched balance data
					const balance = allFetchedBalances.get(token.canister_id);
					return !balance || balance.in_tokens === 0n;
				});
								
				// Populate the token sync candidates
				tokenSyncCandidates = {
					tokensToAdd,
					tokensToRemove
				};
				
				// Show the confirmation modal if we have changes to make
				if (tokensToAdd.length > 0 || tokensToRemove.length > 0) {
					syncStatus = {
						added: tokensToAdd.length,
						removed: tokensToRemove.length
					};
					showSyncConfirmModal = true;
					return true;
				} else {
					// No changes needed
					console.log("No token changes needed");
					syncStatus = { added: 0, removed: 0 };
					showSyncStatus = true;
					setTimeout(() => {
						showSyncStatus = false;
					}, 2000);
					return false;
				}
			} else {
				console.log("No tokens with balances found during discovery");
				syncStatus = { added: 0, removed: 0 };
				showSyncStatus = true;
				setTimeout(() => {
					showSyncStatus = false;
				}, 2000);
				return false;
			}
		} catch (error) {
			console.error("Error during token discovery:", error);
			return false;
		} finally {
			isLoadingBalances = false;
			isSyncing = false;
		}
	}
	
	// Function to handle sync button click
	async function handleSyncButtonClick() {
		// Try thorough discovery first
		const foundTokens = await runTokenDiscovery();

		// If discovery didn't show the confirmation modal, fall back to regular sync
		if (!foundTokens) {
			console.log("Discovery found no changes, falling back to regular sync analysis (skipping redundant balance refresh).");
			handleSyncTokens(true); // Pass true to skip the initial refresh
		}
	}

	// Effect to load balances when walletId changes (initial load)
	$effect(() => {
		// This effect specifically handles the initial load when walletId becomes available
		if (walletId) {
			console.log("[WalletTokensList] walletId detected, triggering initial balance load.");
			loadUserBalances(false); // Use false, let internal logic decide if refresh needed
		}
	});

	// Effect to handle externally triggered forceRefresh
	$effect(() => {
		// This effect handles the forceRefresh prop changing AFTER initial mount
		if (forceRefresh && walletId) {
			console.log("[WalletTokensList] forceRefresh prop triggered balance load.");
			loadUserBalances(true);
		}
	});
</script>

<style>
	.active-token-gradient {
		background: linear-gradient(to right, rgba(var(--color-kong-primary-rgb), 0.05), rgba(var(--color-kong-bg-light-rgb), 0.15));
	}

	.active-token {
		position: relative;
		z-index: 5;
		border-bottom-color: transparent !important;
	}
</style>

<div class="py-2">
	<div class="flex items-center justify-between mb-3 px-4">
		{#if isLoading || isLoadingBalances}
			<div class="text-xs text-kong-text-secondary flex items-center gap-1.5">
				<Loader2 size={12} class="animate-spin" />
				<span>Refreshing balances...</span>
			</div>
		{:else}
			<div class="text-xs text-kong-text-secondary">
				{processedTokenBalances.length} token{processedTokenBalances.length !== 1 ? 's' : ''}
			</div>
		{/if}
		
		<div class="flex gap-2">    
			<button 
				class="text-xs text-kong-text-secondary/70 hover:text-kong-primary px-2 py-1 rounded flex items-center gap-1.5 hover:bg-kong-bg-light/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				on:click={handleSyncButtonClick}
				disabled={isSyncing || isLoading || isLoadingBalances}
			>
				<Shuffle size={12} class={isSyncing ? 'text-kong-primary animate-glow' : ''} />
				<span class={isSyncing ? 'text-kong-primary' : ''}>{isSyncing ? 'Syncing...' : 'Sync'}</span>
			</button>
			
			{#if showSyncStatus && syncStatus}
				<div 
					class="text-xs text-kong-text-secondary flex items-center"
					transition:fade={{ duration: 200 }}
				>
					{#if syncStatus.added > 0 || syncStatus.removed > 0}
						<span class="text-kong-accent-green">
							{syncStatus.added > 0 ? `+${syncStatus.added}` : ""}
							{syncStatus.added > 0 && syncStatus.removed > 0 ? "/" : ""}
							{syncStatus.removed > 0 ? `-${syncStatus.removed}` : ""}
						</span>
					{:else}
						<span class="text-kong-text-secondary/60">No changes</span>
					{/if}
				</div>
			{/if}
			<button 
			class="text-xs text-kong-text-secondary/70 hover:text-kong-primary px-2 py-1 rounded flex items-center gap-1.5 hover:bg-kong-bg-light/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			on:click={handleRefresh}
			disabled={isLoading || isLoadingBalances}
		>
			<RefreshCw size={12} class={isLoading || isLoadingBalances ? 'animate-spin' : ''} />
			<span>Refresh</span>
		</button>
		</div>
	</div>

	{#if balanceLoadError}
		<div class="text-xs text-kong-accent-red mt-1 px-4 mb-2">
			Error: {balanceLoadError}
		</div>
	{/if}

	{#if processedTokenBalances.length === 0}
		<div class="py-10 text-center">
			<div
				class="p-5 rounded-full bg-kong-text-primary/5 inline-block mb-3 mx-auto"
				style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);"
			>
				<Coins size={24} class="text-kong-primary/40" />
			</div>
			<p class="text-base font-medium text-kong-text-primary">
				{isLoading || isLoadingBalances ? "Loading balances..." : "No Tokens Found"}
			</p>
			<p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto">
				{isLoading || isLoadingBalances
					? "Please wait while we fetch your token balances."
					: "You may not have any tokens yet or need to connect your wallet."}
			</p>
		</div>
	{:else}
		<div class="relative"> 
			{#if isSyncing}
				<div 
					class="absolute inset-0 flex flex-col items-center justify-start pt-10 bg-kong-bg-dark/80 rounded-md z-10"
					transition:fade={{ duration: 150 }}
				>
					<LoadingIndicator text="Syncing tokens..." size={18} />
				</div>
			{/if}
			<div class="space-y-0">
				{#each processedTokenBalances as tokenBalance (tokenBalance.token.canister_id)}
					<div>
						<div
							class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-all duration-200 relative
								{isSyncing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
								{showDropdown && selectedTokenId !== tokenBalance.token?.canister_id ? 'opacity-40 hover:opacity-70' : ''}
								{showDropdown && selectedTokenId === tokenBalance.token?.canister_id ? 
									'active-token-gradient border-l-2 border-l-kong-primary shadow-[0_0_15px_rgba(0,0,0,0.1)] active-token' : 'border-l-2 border-l-transparent'}"
							on:click={(e) => handleTokenClick(e, tokenBalance)}
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									{#if tokenBalance.token}
										<div class="flex-shrink-0">
											<TokenImages
												tokens={[tokenBalance.token]}
												size={36}
												showSymbolFallback={true}
												tooltip={{
													text: tokenBalance.name,
													direction: "top",
												}}
											/>
										</div>
									{:else}
										<div
											class="w-9 h-9 rounded-full bg-kong-text-primary/10 flex items-center justify-center border border-kong-border flex-shrink-0"
										>
											<span class="text-xs font-bold text-kong-primary"
												>{tokenBalance.symbol}</span
											>
										</div>
									{/if}
									<div class="flex flex-col justify-center">
										<div class="font-medium text-kong-text-primary text-sm leading-tight">
											{tokenBalance.name}
										</div>
										<div class="text-xs text-kong-text-secondary mt-1 leading-tight">
											{#if Number(tokenBalance.balance) > 0 && Number(tokenBalance.balance) < 0.00001}
												<span title={tokenBalance.balance.toString()}>~0.00001</span> {tokenBalance.symbol}
											{:else}
												{tokenBalance.balance} {tokenBalance.symbol}
											{/if}
										</div>
									</div>
								</div>

								<div class="text-right flex flex-col justify-center">
									<div class="font-medium text-kong-text-primary text-sm leading-tight">
										{formatCurrency(tokenBalance.usdValue)}
									</div>
									<div
										class="text-xs {tokenBalance.change24h >= 0
											? 'text-kong-accent-green'
											: 'text-kong-accent-red'} font-medium mt-1 leading-tight"
									>
										{Number(formatToNonZeroDecimal(tokenBalance.change24h)) >= 0
											? "+"
											: ""}{formatToNonZeroDecimal(tokenBalance.change24h)}%
									</div>
								</div>
							</div>
						</div>
						
						<!-- Token Actions Row - Expanded underneath the token -->
						{#if selectedTokenId === tokenBalance.token?.canister_id && showDropdown}
							<div 
								class="px-4 py-3 border-b border-kong-border/30 bg-gradient-to-b from-kong-accent-blue/5 to-kong-bg-light/10" 
								transition:slide={{ duration: 200 }}
							>
								<TokenDropdown 
									token={selectedToken} 
									expanded={true}
									visible={showDropdown}
									onClose={closeDropdown}
									onAction={handleDropdownAction}
								/>
							</div>
						{/if}
					</div>
				{/each}
				
				<!-- Token Management Buttons -->
				<div class="p-4 flex justify-center gap-3">
					<button
						class="flex items-center gap-2 py-2 px-4 bg-kong-bg-light/10 hover:bg-kong-bg-light/20 text-kong-text-primary rounded-md transition-colors"
						on:click={openManageTokensModal}
					>
						<Settings size={16} />
						<span>Manage Tokens</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Sync Confirmation Modal -->
	<Modal
		isOpen={showSyncConfirmModal}
		title="Confirm Token Sync"
		onClose={cancelSync}
		width="450px"
	>
		<div class="p-4">
			<div class="mb-6">
				<p class="text-sm text-kong-text-secondary mb-4">
					The following changes will be made to your token list:
				</p>
				
				{#if tokenSyncCandidates.tokensToAdd.length > 0}
					<div class="mb-4">
						<h4 class="text-sm font-medium mb-2 flex items-center gap-2">
							<Plus size={16} class="text-kong-accent-green" />
							<span>{tokenSyncCandidates.tokensToAdd.length} token{tokenSyncCandidates.tokensToAdd.length !== 1 ? 's' : ''} to add:</span>
						</h4>
						<div class="bg-kong-bg-light/10 p-3 rounded-md text-sm max-h-40 overflow-y-auto">
							<ul class="space-y-2">
								{#each tokenSyncCandidates.tokensToAdd as token}
									<li class="flex items-center gap-2">
										<TokenImages
											tokens={[token]}
											size={18}
											showSymbolFallback={true}
										/>
										<span>{token.name} ({token.symbol})</span>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}
				
				{#if tokenSyncCandidates.tokensToRemove.length > 0}
					<div>
						<h4 class="text-sm font-medium mb-2 flex items-center gap-2">
							<Minus size={16} class="text-kong-accent-red" />
							<span>{tokenSyncCandidates.tokensToRemove.length} token{tokenSyncCandidates.tokensToRemove.length !== 1 ? 's' : ''} to remove:</span>
						</h4>
						<div class="bg-kong-bg-light/10 p-3 rounded-md text-sm max-h-40 overflow-y-auto">
							<ul class="space-y-2">
								{#each tokenSyncCandidates.tokensToRemove as token}
									<li class="flex items-center gap-2">
										<TokenImages
											tokens={[token]}
											size={18}
											showSymbolFallback={true}
										/>
										<span>{token.name} ({token.symbol})</span>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}
			</div>
			
			<div class="flex justify-end gap-3">
				<button
					class="px-4 py-2 bg-kong-bg-light/20 text-kong-text-primary rounded-md hover:bg-kong-bg-light/30 transition-colors"
					on:click={cancelSync}
				>
					Cancel
				</button>
				<button
					class="px-4 py-2 bg-kong-primary text-white rounded-md hover:bg-kong-primary/90 transition-colors"
					on:click={confirmAndApplyTokenChanges}
				>
					Apply Changes
				</button>
			</div>
		</div>
	</Modal>
	
	<!-- Sync Results Modal -->
	<Modal
		isOpen={showSyncResultModal}
		title="Token Sync Results"
		onClose={closeSyncResultModal}
		width="400px"
	>
		<div class="p-4">
			{#if syncStatus}
				<div class="mb-6 text-center">
					<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-kong-bg-light/20 mb-3">
						{#if syncStatus.added > 0 || syncStatus.removed > 0}
							<Check size={28} class="text-kong-accent-green" />
						{:else}
							<Shuffle size={28} class="text-kong-primary" />
						{/if}
					</div>
					
					<h3 class="text-lg font-medium mb-1">
						{#if syncStatus.added > 0 || syncStatus.removed > 0}
							Tokens updated successfully
						{:else}
							No changes needed
						{/if}
					</h3>
					
					<p class="text-sm text-kong-text-secondary">
						{#if syncStatus.added > 0 || syncStatus.removed > 0}
							Your token list has been synchronized with your balances
						{:else}
							Your token list is already in sync with your balances
						{/if}
					</p>
				</div>
				
				<div class="grid grid-cols-2 gap-4">
					<div class="bg-kong-bg-light/10 p-4 rounded-lg text-center">
						<div class="flex items-center justify-center gap-2 mb-2">
							<Plus size={16} class="text-kong-accent-green" />
							<span class="text-lg font-medium">{syncStatus.added}</span>
						</div>
						<div class="text-sm text-kong-text-secondary">
							Token{syncStatus.added !== 1 ? 's' : ''} Added
						</div>
					</div>
					
					<div class="bg-kong-bg-light/10 p-4 rounded-lg text-center">
						<div class="flex items-center justify-center gap-2 mb-2">
							<Minus size={16} class="text-kong-accent-red" />
							<span class="text-lg font-medium">{syncStatus.removed}</span>
						</div>
						<div class="text-sm text-kong-text-secondary">
							Token{syncStatus.removed !== 1 ? 's' : ''} Removed
						</div>
					</div>
				</div>
				
				<div class="mt-6 text-center">
					<button
						class="px-4 py-2 bg-kong-primary text-white rounded-md hover:bg-kong-primary/90 transition-colors"
						on:click={closeSyncResultModal}
					>
						Close
					</button>
				</div>
			{:else}
				<div class="text-center py-8">
					<AlertCircle size={32} class="text-kong-accent-red mx-auto mb-3" />
					<h3 class="text-lg text-kong-accent-red font-medium mb-2">Sync Failed</h3>
					<p class="text-sm text-kong-text-secondary">
						There was an error synchronizing your tokens. Please try again later.
					</p>
				</div>
			{/if}
		</div>
	</Modal>
	
	<!-- Add Token Modal -->
	<AddNewTokenModal 
		isOpen={showAddTokenModal} 
		onClose={closeAddTokenModal}
		on:tokenAdded={handleNewTokenAdded}
	/>
	
	<!-- Manage Tokens Modal -->
	<ManageTokensModal
		isOpen={showManageTokensModal}
		onClose={closeManageTokensModal}
	/>

	<!-- Receive Token Modal -->
	{#if selectedToken && showReceiveTokenModal}
		<ReceiveTokenModal 
			token={selectedToken.token}
			isOpen={showReceiveTokenModal}
			onClose={closeReceiveTokenModal}
		/>
	{/if}
</div>
