<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import TopUp from './TopUp.svelte';

    let canisterId: string | null = null;

    // Use a reactive statement to update canisterId when the URL changes
    $: {
        if ($page && $page.url) {
            const params = new URLSearchParams($page.url.search);
            const newCanisterId = params.get('canisterId');
            if (newCanisterId !== canisterId) {
                console.log("URL canisterId changed from", canisterId, "to", newCanisterId);
                canisterId = newCanisterId;
            }
        }
    }

    onMount(() => {
        console.log("Page component mounted, $page.url:", $page.url);
    });
</script>

<div class="container px-4 py-8 mx-auto">
    <TopUp {canisterId} />
</div>
