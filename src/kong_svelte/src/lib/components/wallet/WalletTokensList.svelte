<script lang="ts">
	import { formatToNonZeroDecimal, formatBalance } from '$lib/utils/numberFormatUtils';
	import { formatCurrency } from '$lib/utils/portfolioUtils';
	import { Coins, Loader2, RefreshCw, Shuffle, Check, AlertCircle, Plus, Minus, Upload, Settings } from "lucide-svelte";
	import TokenImages from "$lib/components/common/TokenImages.svelte";
	import TokenDropdown from "./TokenDropdown.svelte";
	import { userTokens } from "$lib/stores/userTokens";
	import { currentUserBalancesStore, loadBalances } from "$lib/stores/balancesStore";
	import { fade } from "svelte/transition";
	import Modal from "$lib/components/common/Modal.svelte";
	import AddNewTokenModal from "$lib/components/wallet/AddNewTokenModal.svelte";
	import ManageTokensModal from "$lib/components/wallet/ManageTokensModal.svelte";
	import ReceiveTokenModal from "$lib/components/wallet/ReceiveTokenModal.svelte";

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
		$userTokens.tokens.map((token) => {
			const balanceInfo = $currentUserBalancesStore?.[token.canister_id] || {
				in_tokens: 0n,
				in_usd: "0",
			};

			// Safely convert in_usd to number, handling non-numeric strings
			const usdValue = balanceInfo.in_usd 
				? parseFloat(balanceInfo.in_usd) 
				: 0;

			return {
				symbol: token.symbol,
				name: token.name,
				balance: formatBalance(balanceInfo.in_tokens, token.decimals || 0),
				usdValue: isNaN(usdValue) ? 0 : usdValue,
				icon: token.logo_url || "",
				change24h: token.metrics?.price_change_24h
					? parseFloat(token.metrics.price_change_24h)
					: 0,
				token: token, // Store the original token object for TokenImages
			};
		})
		.sort((a, b) => b.usdValue - a.usdValue) // Sort by value, highest first
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
				await loadBalances($userTokens.tokens, walletId, true);
				lastRefreshed = Date.now();
				onBalancesLoaded();
			} else {
				// For normal updates, check if we need to refresh
				const needsRefresh =
					Object.keys($currentUserBalancesStore || {}).length === 0 ||
					Date.now() - lastRefreshed > 30000; // Reduced to 30 seconds for more frequent updates
				
				if (needsRefresh) {
					await loadBalances($userTokens.tokens, walletId, true);
					lastRefreshed = Date.now();
					onBalancesLoaded();
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
	async function handleSyncTokens() {
		if (!walletId || isSyncing) return;
		
		isSyncing = true;
		syncStatus = null;
		showSyncStatus = false;
		
		try {
			// Use the userTokens store to analyze tokens
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
	let dropdownPosition = $state({ top: 0, left: 0, width: 0 });
	let showDropdown = $state(false);
	
	// Handle token click to show dropdown
	function handleTokenClick(event: MouseEvent, token: TokenBalance) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		
		dropdownPosition = {
			top: rect.bottom,
			left: rect.left,
			width: rect.width
		};
		
		selectedToken = token;
		showDropdown = true;
	}
	
	// Close the dropdown
	function closeDropdown() {
		showDropdown = false;
	}
	
	// Handle dropdown action selection
	function handleDropdownAction(action: 'send' | 'receive' | 'swap' | 'info') {
		if (selectedToken) {
			if (action === 'receive') {
				showReceiveTokenModal = true;
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
				on:click={handleSyncTokens}
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
		<div class="space-y-0">
			{#each processedTokenBalances as tokenBalance}
				<div
					class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-colors cursor-pointer relative"
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
			{/each}
			
			<!-- Token Management Buttons -->
			<div class="p-4 flex justify-center gap-3">
				<button
					class="flex items-center gap-2 py-2 px-4 bg-kong-bg-light/10 hover:bg-kong-bg-light/20 text-kong-text-primary rounded-md transition-colors"
					on:click={openAddTokenModal}
				>
					<Upload size={16} />
					<span>Import Token</span>
				</button>
				
				<button
					class="flex items-center gap-2 py-2 px-4 bg-kong-bg-light/10 hover:bg-kong-bg-light/20 text-kong-text-primary rounded-md transition-colors"
					on:click={openManageTokensModal}
				>
					<Settings size={16} />
					<span>Manage Tokens</span>
				</button>
			</div>
		</div>
	{/if}
	
	<!-- Token Dropdown -->
	{#if selectedToken && showDropdown}
		<div class="fixed inset-0 z-20 pointer-events-none">
			<div class="absolute inset-0 bg-black/20 pointer-events-auto" on:click={closeDropdown}></div>
			<div class="pointer-events-auto">
				<TokenDropdown 
					token={selectedToken} 
					position={dropdownPosition}
					visible={showDropdown}
					onClose={closeDropdown}
					onAction={handleDropdownAction}
				/>
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
