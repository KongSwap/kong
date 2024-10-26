<script lang="ts">
	import LanguageSelector from './../lib/components/LanguageSelector.svelte';
	import Navbar from '$lib/components/nav/Navbar.svelte';
	import { onMount } from 'svelte';
	import '../app.css';

	let mode: string | null = null;

	onMount(async () => {
		switch (window.location.hostname) {
			case "localhost":
				mode = "DEV";
				break;
			case "todo":
				// TODO: Add staging canister ID
				break;
			case "kongswap.io":
				mode = null;
				break;
		}
	});
</script>

<svelte:head>
	<title>{mode ? `[${mode}] KongSwap` : 'KongSwap'}</title>
</svelte:head>

<Navbar />

<div class="pt-16"> <!-- Add padding to account for fixed navbar -->
	<!-- <LanguageSelector /> -->
	<slot />
</div>

<style>
	:global(body) {
		background: #000000 url("/backgrounds/kong_jungle.webp") no-repeat center center fixed;
		background-size: cover;
	}
</style>
