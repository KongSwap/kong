<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import TopUp from './TopUp.svelte';

    let canisterId: string | null = null;

    // Use a reactive statement to update canisterId when the URL changes
    $: if (browser && $page && $page.url) {
        const newCanisterId = $page.url.searchParams.get('canisterId');
        if (newCanisterId !== canisterId) {
            console.log("URL canisterId changed from", canisterId, "to", newCanisterId);
            canisterId = newCanisterId;
        }
    }

    onMount(() => {
        if (browser) {
            console.log("Page component mounted, $page.url:", $page.url);
        }
    });
</script>

<div class="container px-4 py-8 mx-auto">
    <TopUp {canisterId} />
</div>
