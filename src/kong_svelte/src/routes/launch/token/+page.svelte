<script lang="ts">
  // Redirect to the proper URL format with [canisterId]
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // Redirect to launch home if accessed directly
    goto('/launch');
  });
</script>

<div class="container mx-auto p-8">
  <h1 class="text-3xl font-bold mb-6">Token Details</h1>
  <p>Redirecting to token list...</p>
</div> 