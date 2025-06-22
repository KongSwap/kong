<script lang="ts">
	import { Coins, Shuffle, Settings } from "lucide-svelte";
	import TokenDropdown from "./TokenDropdown.svelte";
	import { userTokens } from "$lib/stores/userTokens";
	import { currentUserBalancesStore } from "$lib/stores/balancesStore";
	import { fade, slide } from "svelte/transition";
	import { onMount } from "svelte";
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toastStore';
	import AddNewTokenModal from "$lib/components/wallet/AddNewTokenModal.svelte";
	import ManageTokensModal from "$lib/components/wallet/ManageTokensModal.svelte";
	import ReceiveTokenModal from "$lib/components/wallet/ReceiveTokenModal.svelte";
	import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
	import SyncConfirmModal from "./SyncConfirmModal.svelte";
	import SyncResultModal from "./SyncResultModal.svelte";
	import { discoverTokens, shouldRefreshTokenCache } from "$lib/services/tokenDiscoveryService";
	import { analyzeUserTokens, applyTokenSync } from "$lib/services/tokenSyncService";
	import { loadUserBalances, setLastRefreshed } from "$lib/services/balanceService";
	import TokenListItem from "./TokenListItem.svelte";
	import WalletListHeader from "./WalletListHeader.svelte";
	import { fetchPoolTotals } from "$lib/api/pools";

	// Define a type that combines a token with its balance information
	interface TokenWithBalance {
		token: Kong.Token;
		in_tokens: bigint;
		in_usd: string;
	}
	
	// Solana SPL token type from provider (adjust if needed)
	type SplTokenBalance = {
		amount: string;
		decimals: number;
		logo?: string;
		mint: string;
		name: string;
		symbol: string;
		usdValue: number;
		uiAmount: number;
	};

	type WalletTokensListProps = {
		isLoading?: boolean;
		walletId?: string;
		// Optional pre-processed token balances (for backward compatibility)
		tokenBalances?: Kong.Token[];
		// Callback props instead of event dispatchers
		onAction?: (
			action: 'send' | 'receive' | 'swap' | 'info' | 'add_lp',
			token: TokenWithBalance
		) => void;
		onTokenAdded?: (token: Kong.Token) => void;
		onBalancesLoaded?: () => void;
		showUsdValues?: boolean; // <-- Add prop for USD visibility
		onRefresh?: () => void; // <-- Add onRefresh prop from parent
	};

	let { 
		isLoading = false,
		walletId = "",
		tokenBalances = [],
		onAction = () => {},
		onTokenAdded = () => {},
		onBalancesLoaded = () => {},
		showUsdValues = true, // <-- Destructure with default
		onRefresh = undefined // <-- Destructure onRefresh prop
	}: WalletTokensListProps = $props();

	// --- Solana State ---
	// let solNativeBalance = $state<number | null>(null);
	// let splTokens = $state<SplTokenBalance[]>([]);
	// let isLoadingSolana = $state(false);
	// let solanaLoadError = $state<string | null>(null);
	// --------------------

	// Process tokens with balance information when we need to do it internally
	const processedTokenBalances = $derived(
		// If tokenBalances were provided, use them (backward compatibility)
		tokenBalances.length > 0 ? tokenBalances :
		// Otherwise process them internally
		(() => {
			const currentEnabled = $userTokens.enabledTokens;
			const tokenDataMap = $userTokens.tokenData;

			// --- Process ICP Tokens ---
			const icpProcessed = Array.from(currentEnabled)
				.map(canisterId => {
					const token = tokenDataMap.get(canisterId);
					if (!token) {
						console.warn(`[WalletTokensList] Enabled token ${canisterId} not found in tokenData map during derived recalc.`);
						return null; // Skip if token data isn't available for some reason
					}

					const balanceInfo = $currentUserBalancesStore[token.address];
					
					// If this token doesn't have balance info yet, just return the token
					if (!balanceInfo) {
						return token;
					}

					return token;
				})
				.filter(Boolean); // Filter out any nulls (missing tokens)

			// --- Process Solana Tokens ---
			// const solProcessed: Kong.Token[] = [];
			
			// Add SPL tokens
			// splTokens.forEach(spl => {
			// 	// Placeholder token for SPL
			// 	const splToken: Kong.Token = {
			// 		id: 0,
			// 		name: spl.name,
			// 		symbol: spl.symbol,
			// 		address: spl.mint,
			// 		chain: 'Solana',
			// 		fee: 0,
			// 		fee_fixed: '0',
			// 		token_type: 'SPL',
			// 		standards: ['SPL'],
			// 		decimals: Number(spl.decimals),
			// 		metrics: {
			// 			price: String(spl.usdValue / spl.uiAmount),
			// 			price_change_24h: '0',
			// 			total_supply: '0',
			// 			market_cap: '0',
			// 			volume_24h: '0',
			// 			tvl: '0',
			// 			updated_at: new Date().toISOString()
			// 		},
			// 		logo_url: spl.logo || ''
			// 	};
				
			// 	solProcessed.push(splToken);
			// });

			// --- Combine and Sort ---
			const combined = [...icpProcessed]; // Use only ICP tokens for now
			
			// Sort by USD value - we'll get USD values from the store
			const sorted = combined.sort((a, b) => {
				const aUsdValue = Number($currentUserBalancesStore[a.address]?.in_usd || '0');
				const bUsdValue = Number($currentUserBalancesStore[b.address]?.in_usd || '0');
				return bUsdValue - aUsdValue;
			});
			
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
	let tokenSyncCandidates = $state<{tokensToAdd: Kong.Token[], tokensToRemove: Kong.Token[]}>({
		tokensToAdd: [],
		tokensToRemove: []
	});

	// Add pool stats state
	let poolStats = $state<{
		total_volume_24h: number;
		total_tvl: number;
		total_fees_24h: number;
	} | null>(null);
	let isLoadingPoolStats = $state(false);

	// Function to load pool stats
	async function loadPoolStats() {
		if (isLoadingPoolStats) return;
		isLoadingPoolStats = true;
		try {
			poolStats = await fetchPoolTotals();
		} catch (error) {
			console.error("Error loading pool stats:", error);
		} finally {
			isLoadingPoolStats = false;
		}
	}

	// Load pool stats on mount
	onMount(() => {
		loadPoolStats();
	});

	// --- Fetch Solana Balances ---
	// async function fetchSolanaBalances() {
	// 	if (!auth.pnp?.provider?.getSolBalance || !auth.pnp?.provider?.getSplTokenBalances) {
	// 		console.log("[WalletTokensList] Solana provider methods not available.");
	// 		return;
	// 	}
		
	// 	isLoadingSolana = true;
	// 	solanaLoadError = null;
		
	// 	try {
	// 		const [solBalance, splBalances] = await Promise.all([
	// 			auth.pnp.provider.getSolBalance(),
	// 			auth.pnp.provider.getSplTokenBalances()
	// 		]);
			
	// 		console.log('[WalletTokensList] SOL Balance:', solBalance);
	// 		console.log('[WalletTokensList] SPL Balances:', splBalances);
			
	// 		// Ensure solBalance is a number (or handle potential errors)
	// 		if (typeof solBalance === 'number') {
	// 			solNativeBalance = solBalance;
	// 		} else {
	// 			console.warn('[WalletTokensList] Received non-number SOL balance:', solBalance);
	// 			solNativeBalance = 0; // Default to 0 if invalid
	// 		}
			
	// 		// Ensure splBalances is an array (or handle potential errors)
	// 		if (Array.isArray(splBalances)) {
	// 			splTokens = splBalances;
	// 		} else {
	// 			console.warn('[WalletTokensList] Received non-array SPL balances:', splBalances);
	// 			splTokens = []; // Default to empty array if invalid
	// 		}
			
	// 	} catch (error) {
	// 		console.error("Error fetching Solana balances:", error);
	// 		solanaLoadError = error instanceof Error ? error.message : "Failed to load Solana balances";
	// 		solNativeBalance = null; // Reset on error
	// 		splTokens = [];         // Reset on error
	// 	} finally {
	// 		isLoadingSolana = false;
	// 	}
	// }
	// ---------------------------

	// Run a thorough token discovery process that finds tokens with balances
	async function runTokenDiscovery() {
		if (!walletId || isLoadingBalances || isSyncing) return;
		
		// Show loading state
		isLoadingBalances = true;
		isSyncing = true;
		
		try {
			// 1. First, load a fresh list of all available tokens (with caching)
			let allAvailableTokens: Kong.Token[];
			const now = Date.now();

			// Use the service function to check if cache refresh is needed
			if (!shouldRefreshTokenCache(allAvailableTokensCacheTimestamp, allAvailableTokensCache)) {
				allAvailableTokens = allAvailableTokensCache;
			} else {
				const { fetchAllTokens } = await import("$lib/api/tokens");
				allAvailableTokens = await fetchAllTokens();
				allAvailableTokensCache = allAvailableTokens; // Update cache
				allAvailableTokensCacheTimestamp = now;    // Update timestamp
			}
			
			// Use the service function to discover tokens
			const enabledTokenIds = $userTokens.enabledTokens;
			const currentEnabledTokens = $userTokens.tokens
				.filter(token => token.address && enabledTokenIds.has(token.address));
			
			const discoveryResult = await discoverTokens(
				walletId,
				allAvailableTokens,
				enabledTokenIds,
				currentEnabledTokens
			);
						
			// Populate the token sync candidates
			tokenSyncCandidates = {
				tokensToAdd: discoveryResult.tokensToAdd,
				tokensToRemove: discoveryResult.tokensToRemove
			};
			
			// Show the confirmation modal if we have changes to make
			if (discoveryResult.tokensToAdd.length > 0 || discoveryResult.tokensToRemove.length > 0) {
				syncStatus = discoveryResult.syncStatus;
				showSyncConfirmModal = true;
				return true;
			} else {
				// No changes needed
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

	// Handle refresh button click
	function handleRefresh() {
		if (onRefresh) {
			onRefresh();
		} else if (walletId) {
			loadUserBalancesWrapper(true);
		} else {
		}
	}

	// Load user balances function - uses the service
	async function loadUserBalancesWrapper(forceRefresh = false) {
		if (!walletId) {
			return;
		}

		balanceLoadError = null;
		isLoadingBalances = true;
		
		try {
			const balancesLoaded = await loadUserBalances(walletId, forceRefresh);
			
			if (balancesLoaded) {
				const refreshTimestamp = Date.now();
				lastRefreshed = refreshTimestamp;
				setLastRefreshed(refreshTimestamp);
				onBalancesLoaded();
			} else {
			}
		} catch (err) {
			console.error("❌ WalletTokensList: Error loading balances:", err);
			balanceLoadError =
				err instanceof Error ? err.message : "Failed to load balances";
		} finally {
			isLoadingBalances = false;
		}
	}

	// Sync tokens based on actual balances - uses the service
	async function handleSyncTokens(skipInitialRefresh = false) {
		if (!walletId || isSyncing) return;

		isSyncing = true;
		syncStatus = null;
		showSyncStatus = false;

		try {
			// Make sure we have the latest balances before analyzing tokens
			if (!skipInitialRefresh) {
				await loadUserBalancesWrapper(true);
			}

			// Use the service to analyze tokens
			const result = await analyzeUserTokens(walletId);
			
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

	// Apply token changes after user confirmation - uses the service
	async function confirmAndApplyTokenChanges() {
		try {
			// Use the service to apply the changes
			syncStatus = await applyTokenSync(
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
				await userTokens.refreshTokenData();
				await loadUserBalancesWrapper(true);
			}
		} catch (error) {
			console.error("Error applying token changes:", error);
			syncStatus = { added: 0, removed: 0 };
			showSyncResultModal = true;
		}
	}

	// Cancel the sync operation (now just closes the modal)
	function cancelSync() {
		tokenSyncCandidates = { tokensToAdd: [], tokensToRemove: [] }; // Clear candidates on cancel
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
		loadUserBalancesWrapper(true);
	}

	// Handle when a new token is added
	function handleNewTokenAdded(event: CustomEvent<Kong.Token>) {
		const newToken = event.detail;
		// Call the onTokenAdded callback from props
		onTokenAdded(newToken);
		// Load balances to show the new token
		loadUserBalancesWrapper(true);
	}

	// For dropdown - use $state for proper reactivity in Svelte 5
	let selectedToken = $state<TokenWithBalance | null>(null);
	let selectedTokenId = $state<string | null>(null);
	let selectedTokenElement = $state<HTMLElement | null>(null);
	let showDropdown = $state(false);
	
	// --- Constants for Add LP --- 
	const ICP_CANISTER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";
	const KONG_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai"; // Used if ICP is selected
	// ---------------------------

	// Handle token click to show dropdown
	function handleTokenClick(event: MouseEvent, token: Kong.Token) {
		// Prevent opening dropdown if syncing or already selected
		if (isSyncing) return;
		
		// Get balance information for this token
		const balanceInfo = $currentUserBalancesStore[token.address];
		const tokenBalance = {
			in_tokens: balanceInfo?.in_tokens || BigInt(0),
			in_usd: balanceInfo?.in_usd || '0'
		};
		
		// Create a merged token with balance info
		const tokenWithBalance = {
			token,
			...tokenBalance
		};
		
		// If clicking the same token that's already open, close it
		if (selectedTokenId === token.address && showDropdown) {
			closeDropdown();
			return;
		}
		
		const target = event.currentTarget as HTMLElement;
		selectedTokenElement = target;
		selectedToken = tokenWithBalance;
		selectedTokenId = token.address;
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
	function handleDropdownAction(action: 'send' | 'receive' | 'swap' | 'info' | 'copy' | 'add_lp') {
		if (!selectedToken) return;

		let shouldCloseDropdown = true; // Default to closing

		switch (action) {
			case 'receive':
				showReceiveTokenModal = true;
				shouldCloseDropdown = false; // Keep open for modal
				break;
			case 'copy':
				// Copy action is handled directly in TokenDropdown
				shouldCloseDropdown = false; // Keep open for feedback (copy success state)
				break;
			case 'send':
				 onAction(action, selectedToken);
				 shouldCloseDropdown = false; // Keep open
				 break;
			case 'add_lp':
				const token0Id = selectedToken.token.address;
				if (!token0Id) {
					console.error("Cannot Add LP: Selected token has no canister ID.");
					toastStore.error("Cannot create LP link: Missing token ID.");
					shouldCloseDropdown = true; // Close on error
					break;
				}
				
				// Default to pairing with ICP, unless ICP is selected, then pair with KONG
				let token1Id = ICP_CANISTER_ID;
				if (token0Id === ICP_CANISTER_ID) {
					token1Id = KONG_CANISTER_ID; // Use KONG as the partner for ICP
				}

				// Prevent pairing a token with itself (shouldn't happen with above logic, but safe)
				if (token0Id === token1Id) {
					 console.error("Cannot Add LP: Cannot pair token with itself.");
					 toastStore.error("Cannot create LP link: Cannot pair token with itself.");
					 shouldCloseDropdown = true; // Close on error
					 break;
				}

				// Check if either token is SOL Native or an SPL token
				// const isSolanaToken = (id: string) => id === 'SOL_NATIVE' || splTokens.some(spl => spl.mint === id);
				
				// if (isSolanaToken(token0Id) || isSolanaToken(token1Id)) {
				// 	console.warn("[WalletTokensList] Add LP action is not yet implemented for Solana tokens.");
				// 	toastStore.warning("Add LP for Solana tokens is not yet available.");
				// 	shouldCloseDropdown = true; // Close dropdown as action is not supported
				// 	break;
				// }

				const url = `/pools/${token0Id}_${token1Id}/position`;	
				goto(url);
				// Optionally call the prop if the parent needs to react *before* navigation
				// onAction(action, selectedToken);
				shouldCloseDropdown = false; // Keep dropdown open during navigation
				break;
			case 'info':
			case 'swap':
			default:
				 onAction(action, selectedToken);
				 shouldCloseDropdown = true; // Close for these actions
				 break;
		}

		if (shouldCloseDropdown) {
			closeDropdown();
		}
	}

	// Effect to load balances when walletId becomes available or changes
	let previousWalletId: string | undefined = undefined;
	$effect.pre(() => {
		// Capture the previous walletId before the main effect runs
		previousWalletId = walletId;
	});

	$effect(() => {
		// Run only if walletId is now truthy AND different from the previous value
		if (walletId && walletId !== previousWalletId) {
			loadUserBalancesWrapper(false); // Use false, let internal logic decide if refresh needed
		}
	});

	// Effect to load Solana balances when provider is ready
	// $effect(() => {
	// 	if ($auth.isConnected && auth?.pnp?.adapter?.chain === 'SOL' && auth.pnp?.provider?.getSolBalance && auth.pnp?.provider?.getSplTokenBalances) {
	// 		console.log("[WalletTokensList] Solana provider available, fetching balances.");
	// 		fetchSolanaBalances();
	// 	} else {
	// 		// Reset if disconnected or provider changes
	// 		solNativeBalance = null;
	// 		splTokens = [];
	// 		isLoadingSolana = false;
	// 		solanaLoadError = null;
	// 	}
	// });

	// Close the receive token modal
	function closeReceiveTokenModal() {
		showReceiveTokenModal = false;
		// Reset the selected token to allow reopening the modal
		selectedToken = null;
		selectedTokenId = null;
	}
	
	// --- Token Discovery Cache ---
	let allAvailableTokensCache: Kong.Token[] = [];
	let allAvailableTokensCacheTimestamp = 0;
	// ---------------------------

	// Function to handle sync button click
	async function handleSyncButtonClick() {
		// Try thorough discovery first
		const foundTokens = await runTokenDiscovery();

		// If discovery didn't show the confirmation modal, fall back to regular sync
		if (!foundTokens) {
			// Force a refresh to ensure balances are up to date
			await loadUserBalancesWrapper(true);
			handleSyncTokens(true); // Pass true to skip the initial refresh
		}
	}
</script>

<!-- Component container without scrolling behavior -->
<div class="flex flex-col h-full">
	<!-- Fixed header that doesn't scroll -->
	<WalletListHeader 
		title="Assets"
		count={processedTokenBalances.length}
		isLoading={isLoading || isLoadingBalances}
		onRefresh={onRefresh || handleRefresh}
	>
		<svelte:fragment slot="actions">
			<button 
				class="text-xs text-kong-text-secondary/70 hover:text-kong-primary px-2 py-1 rounded flex items-center gap-1.5 hover:bg-kong-bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={handleSyncButtonClick}
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
						<span class="text-kong-success">
							{syncStatus.added > 0 ? `+${syncStatus.added}` : ""}
							{syncStatus.added > 0 && syncStatus.removed > 0 ? "/" : ""}
							{syncStatus.removed > 0 ? `-${syncStatus.removed}` : ""}
						</span>
					{:else}
						<span class="text-kong-text-secondary/60">No changes</span>
					{/if}
				</div>
			{/if}
		</svelte:fragment>

		<!-- Add Pool Stats -->
		<svelte:fragment slot="stats">
			{#if isLoadingPoolStats}
				<div class="flex gap-4 text-xs text-kong-text-secondary/60">
					<div>Loading stats...</div>
				</div>
			{:else if poolStats}
				<div class="flex gap-4 text-xs">
					<div class="flex flex-col">
						<span class="text-kong-text-secondary/60">24h Volume</span>
						<span class="text-kong-text-primary">${poolStats.total_volume_24h.toLocaleString()}</span>
					</div>
					<div class="flex flex-col">
						<span class="text-kong-text-secondary/60">TVL</span>
						<span class="text-kong-text-primary">${poolStats.total_tvl.toLocaleString()}</span>
					</div>
					<div class="flex flex-col">
						<span class="text-kong-text-secondary/60">24h Fees</span>
						<span class="text-kong-text-primary">${poolStats.total_fees_24h.toLocaleString()}</span>
					</div>
				</div>
			{/if}
		</svelte:fragment>
	</WalletListHeader>

	<!-- Scrollable content area -->
	<div class="flex-1 overflow-y-auto scrollbar-thin">
		{#if balanceLoadError}
			<div class="text-xs text-kong-error mt-1 px-4 mb-2">
				Error loading ICP balances: {balanceLoadError}
			</div>
		{/if}

		{#if processedTokenBalances.length === 0 && !isLoading && !isLoadingBalances}
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
			<div class="relative pv"> 
				{#if isSyncing}
					<div 
						class="absolute inset-0 flex flex-col items-center justify-start pt-10 bg-kong-bg-primary/80 rounded-md z-10"
						transition:fade={{ duration: 150 }}
					>
						<LoadingIndicator message="Syncing tokens..." fullHeight />
					</div>
				{/if}
				<div class="space-y-0">
					{#each processedTokenBalances as token (token.address)}
						<div
							class:opacity-30={showDropdown && selectedTokenId !== token.address}
							class:pointer-events-none={showDropdown && selectedTokenId !== token.address}
							class="transition-opacity duration-200"
						>
							<TokenListItem 
								token={token}
								isActive={showDropdown && selectedTokenId === token.address}
								isSyncing={isSyncing}
								showUsdValues={showUsdValues}
								onClick={(e) => handleTokenClick(e, token)}
							/>
							
							<!-- Token Actions Row - Expanded underneath the token -->
							{#if selectedTokenId === token.address && showDropdown}
								<div 
									class="px-4 py-3 border-b border-kong-border/30 bg-kong-bg-secondary" 
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
					<div class="p-2 flex justify-center gap-3">
						<button
							class="flex items-center gap-2 py-2 px-4 bg-kong-bg-primary/10 hover:bg-kong-bg-primary/20 text-kong-text-primary rounded-md transition-colors"
							onclick={openManageTokensModal}
						>
							<Settings size={16} />
							<span>Manage Tokens</span>
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
	
	<!-- Sync Confirmation Modal -->
	<SyncConfirmModal 
		bind:isOpen={showSyncConfirmModal} 
		candidates={tokenSyncCandidates} 
		onConfirm={confirmAndApplyTokenChanges}
		onCancel={cancelSync}
	/>
	
	<!-- Sync Results Modal -->
	<SyncResultModal
		bind:isOpen={showSyncResultModal}
		syncStatus={syncStatus}
		onClose={closeSyncResultModal}
	/>
	
	<!-- Add Token Modal -->
	{#if showAddTokenModal}
		<AddNewTokenModal 
			isOpen={showAddTokenModal} 
			onClose={closeAddTokenModal}
			on:tokenAdded={handleNewTokenAdded}
		/>
	{/if}
	
	<!-- Manage Tokens Modal -->
	<ManageTokensModal
		isOpen={showManageTokensModal}
		onClose={closeManageTokensModal}
	/>

	<!-- Receive Token Modal -->
	{#if selectedToken}
		<ReceiveTokenModal 
			token={selectedToken.token}
			isOpen={showReceiveTokenModal}
			onClose={closeReceiveTokenModal}
		/>
	{/if}
</div>

<style>
  /* Scrollbar styling */
  :global(.scrollbar-thin::-webkit-scrollbar) {
    width: 0.375rem; /* w-1.5 */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-track) {
    background-color: transparent; /* bg-transparent */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-thumb) {
    background-color: var(--kong-border); /* bg-kong-border */
    border-radius: 9999px; /* rounded-full */
  }
</style>
