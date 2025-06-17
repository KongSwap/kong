<script lang="ts">
	import { Plus, Minus } from 'lucide-svelte';
	import Modal from '$lib/components/common/Modal.svelte';
	import TokenImages from '$lib/components/common/TokenImages.svelte';

	type SyncCandidates = {
		tokensToAdd: Kong.Token[];
		tokensToRemove: Kong.Token[];
	};

	type SyncProps = {
		isOpen: boolean;
		candidates: SyncCandidates;
		onConfirm: () => Promise<void>; // Add onConfirm prop
		onCancel: () => void;         // Add onCancel prop
	};

	let { 
		isOpen = $bindable(), 
		candidates = { tokensToAdd: [], tokensToRemove: [] },
		onConfirm, // Destructure props
		onCancel   // Destructure props
	}: SyncProps = $props();

	async function handleConfirm() { // Make async
		console.log("[SyncConfirmModal] handleConfirm called via prop");
		await onConfirm(); // Call the prop
		// Parent decides if/when to close the modal
	}

	function handleCancel() {
		console.log("[SyncConfirmModal] handleCancel called via prop");
		onCancel(); // Call the prop
		// Parent decides if/when to close the modal
	}
</script>

<Modal
	isOpen={isOpen}
	title="Confirm Token Sync"
	onClose={handleCancel} 
	width="450px"
>
	<div class="p-4">
		<div class="mb-6">
			<p class="text-sm text-kong-text-secondary mb-4">
				The following changes will be made to your token list:
			</p>
			
			{#if candidates.tokensToAdd.length > 0}
				<div class="mb-4">
					<h4 class="text-sm font-medium mb-2 flex items-center gap-2">
						<Plus size={16} class="text-kong-success" />
						<span>{candidates.tokensToAdd.length} token{candidates.tokensToAdd.length !== 1 ? 's' : ''} to add:</span>
					</h4>
					<div class="bg-kong-bg-secondary/10 p-3 rounded-md text-sm max-h-40 overflow-y-auto scrollbar-custom">
						<ul class="space-y-2">
							{#each candidates.tokensToAdd as token (token.address)}
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
			
			{#if candidates.tokensToRemove.length > 0}
				<div>
					<h4 class="text-sm font-medium mb-2 flex items-center gap-2">
						<Minus size={16} class="text-kong-error" />
						<span>{candidates.tokensToRemove.length} token{candidates.tokensToRemove.length !== 1 ? 's' : ''} to remove:</span>
					</h4>
					<div class="bg-kong-bg-secondary/10 p-3 rounded-md text-sm max-h-40 overflow-y-auto scrollbar-custom">
						<ul class="space-y-2">
							{#each candidates.tokensToRemove as token (token.address)}
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
				class="px-4 py-2 bg-kong-bg-secondary/20 text-kong-text-primary rounded-md hover:bg-kong-bg-secondary/30 transition-colors"
				onclick={handleCancel}
			>
				Cancel
			</button>
			<button
				class="px-4 py-2 bg-kong-primary text-white rounded-md hover:bg-kong-primary/90 transition-colors"
				onclick={handleConfirm}
			>
				Apply Changes
			</button>
		</div>
	</div>
</Modal> 