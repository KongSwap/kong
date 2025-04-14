<script lang="ts">
	import { formatBalance } from '$lib/utils/numberFormatUtils';
	import { Coins, Loader2, RefreshCw, Shuffle, Settings } from "lucide-svelte";
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
		// Optional pre-processed token balances (for backward compatibility)
		tokenBalances?: TokenBalance[];
		// Callback props instead of event dispatchers
		onAction?: (
			action: 'send' | 'receive' | 'swap' | 'info' | 'add_lp',
			token: TokenBalance
		) => void;
		onTokenAdded?: (token: FE.Token) => void;
		onBalancesLoaded?: () => void;
		showUsdValues?: boolean; // <-- Add prop for USD visibility
	};

	let { 
		isLoading = false,
		walletId = "",
		tokenBalances = [],
		onAction = () => {},
		onTokenAdded = () => {},
		onBalancesLoaded = () => {},
		showUsdValues = true // <-- Destructure with default
	}: WalletTokensListProps = $props();

	// Process tokens with balance information when we need to do it internally
	const processedTokenBalances = $derived(
		// If tokenBalances were provided, use them (backward compatibility)
		tokenBalances.length > 0 ? tokenBalances :
		// Otherwise process them internally
		(() => {
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

	// Run a thorough token discovery process that finds tokens with balances
	async function runTokenDiscovery() {
		if (!walletId || isLoadingBalances || isSyncing) return;
		
		// Show loading state
		isLoadingBalances = true;
		isSyncing = true;
		
		try {
			// 1. First, load a fresh list of all available tokens (with caching)
			let allAvailableTokens: FE.Token[];
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
				.filter(token => token.canister_id && enabledTokenIds.has(token.canister_id));
			
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

	// Load user balances function - uses the service
	async function loadUserBalancesWrapper(forceRefresh = false) {
		if (!walletId) return;

		balanceLoadError = null;
		isLoadingBalances = true;
		
		try {
			const balancesLoaded = await loadUserBalances(walletId, forceRefresh);
			
			if (balancesLoaded) {
				const refreshTimestamp = Date.now();
				lastRefreshed = refreshTimestamp;
				setLastRefreshed(refreshTimestamp);
				onBalancesLoaded();
			}
		} catch (err) {
			console.error("Error loading balances:", err);
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
		console.log("[WalletTokensList] cancelSync called");
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
	function handleNewTokenAdded(event: CustomEvent<FE.Token>) {
		const newToken = event.detail;
		// Call the onTokenAdded callback from props
		onTokenAdded(newToken);
		// Load balances to show the new token
		loadUserBalancesWrapper(true);
	}

	// For dropdown - use $state for proper reactivity in Svelte 5
	let selectedToken = $state<TokenBalance | null>(null);
	let selectedTokenId = $state<string | null>(null);
	let selectedTokenElement = $state<HTMLElement | null>(null);
	let showDropdown = $state(false);
	
	// --- Constants for Add LP --- 
	const ICP_CANISTER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";
	const KONG_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai"; // Used if ICP is selected
	// ---------------------------

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
				const token0Id = selectedToken.token?.canister_id;
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

				const url = `/pools/add?token0=${token0Id}&token1=${token1Id}`;
				console.log('Navigating to Add LP:', url);
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

	// Handle refresh button click
	function handleRefresh() {
		if (walletId) {
			loadUserBalancesWrapper(true);
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
			console.log(`[WalletTokensList] walletId changed from ${previousWalletId} to ${walletId}, triggering initial load.`);
			loadUserBalancesWrapper(false); // Use false, let internal logic decide if refresh needed
		}
	});

	// Close the receive token modal
	function closeReceiveTokenModal() {
		showReceiveTokenModal = false;
	}
	
	// --- Token Discovery Cache ---
	let allAvailableTokensCache: FE.Token[] = [];
	let allAvailableTokensCacheTimestamp = 0;
	// ---------------------------

	// Function to handle sync button click
	async function handleSyncButtonClick() {
		// Try thorough discovery first
		const foundTokens = await runTokenDiscovery();

		// If discovery didn't show the confirmation modal, fall back to regular sync
		if (!foundTokens) {
			console.log("Discovery found no changes, falling back to regular sync analysis (skipping redundant balance refresh).");
			// Force a refresh to ensure balances are up to date
			await loadUserBalancesWrapper(true);
			handleSyncTokens(true); // Pass true to skip the initial refresh
		}
	}
</script>

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
						<TokenListItem 
							token={tokenBalance}
							isActive={showDropdown && selectedTokenId === tokenBalance.token?.canister_id}
							isSyncing={isSyncing}
							showUsdValues={showUsdValues}
							onClick={(e) => handleTokenClick(e, tokenBalance)}
						/>
						
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
