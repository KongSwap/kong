<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { t } from '$lib/translations';
	import { restoreWalletConnection } from '$lib/stores/walletStore';
	import LanguageSelector from './../lib/components/LanguageSelector.svelte';
	import { currentEnvMode } from '$lib/utils/envUtils';
	import { backendService } from '$lib/services/backendService';

	onMount(async () => {
		Promise.all([
			backendService.initializeActors(),
			restoreWalletConnection()
		]);
	});
</script>

<svelte:head>
	<title>{currentEnvMode() ? `[${currentEnvMode()}] KongSwap` : `KongSwap`} - {$t('common.browserSubtitle')}</title>
</svelte:head>

<LanguageSelector />

<!-- Slot for page content -->
<slot />

<style>
	:global(body) {
		background: #000000 url("/backgrounds/kong_jungle.webp") no-repeat center center fixed;
		background-size: cover;
	}
</style>
