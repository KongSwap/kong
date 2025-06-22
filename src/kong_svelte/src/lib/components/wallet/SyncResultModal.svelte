<script lang="ts">
	import { Check, AlertCircle, Plus, Minus, Shuffle } from 'lucide-svelte';
	import Modal from '$lib/components/common/Modal.svelte';

	type SyncResultModalProps = {
		isOpen: boolean;
		syncStatus: { added: number; removed: number } | null;
		onClose: () => void;
	};

	let { 
		isOpen = $bindable(), 
		syncStatus = $bindable(null),
		onClose
	}: SyncResultModalProps = $props();
</script>

<Modal
	isOpen={isOpen}
	title="Token Sync Results"
	onClose={onClose}
	width="400px"
>
	<div class="p-4">
		{#if syncStatus}
			<div class="mb-6 text-center">
				<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-kong-bg-secondary/20 mb-3">
					{#if syncStatus.added > 0 || syncStatus.removed > 0}
						<Check size={28} class="text-kong-success" />
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
				<div class="bg-kong-bg-secondary/10 p-4 rounded-lg text-center">
					<div class="flex items-center justify-center gap-2 mb-2">
						<Plus size={16} class="text-kong-success" />
						<span class="text-lg font-medium">{syncStatus.added}</span>
					</div>
					<div class="text-sm text-kong-text-secondary">
						Token{syncStatus.added !== 1 ? 's' : ''} Added
					</div>
				</div>
				
				<div class="bg-kong-bg-secondary/10 p-4 rounded-lg text-center">
					<div class="flex items-center justify-center gap-2 mb-2">
						<Minus size={16} class="text-kong-error" />
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
					onclick={onClose}
				>
					Close
				</button>
			</div>
		{:else}
			<div class="text-center py-8">
				<AlertCircle size={32} class="text-kong-error mx-auto mb-3" />
				<h3 class="text-lg text-kong-error font-medium mb-2">Sync Failed</h3>
				<p class="text-sm text-kong-text-secondary">
					There was an error synchronizing your tokens. Please try again later.
				</p>
			</div>
		{/if}
	</div>
</Modal> 