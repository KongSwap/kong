<script lang="ts">
  // Redirect to the proper URL format with [canisterId]
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // Redirect to launch page
    goto('/launch');
  });
</script>

<div class="container mx-auto p-12 text-center">
  <h1 class="text-2xl font-bold mb-4">Miner Details</h1>
  <p>Redirecting to miner list...</p>
</div> 