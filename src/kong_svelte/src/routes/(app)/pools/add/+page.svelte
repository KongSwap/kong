<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  onMount(() => {
    goto('/', { replaceState: true });
  });
</script>

<div>Redirecting...</div>