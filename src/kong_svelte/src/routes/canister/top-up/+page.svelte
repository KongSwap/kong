<script lang="ts">
  import TopUp from '$lib/components/canister/TopUp.svelte';
  import { auth } from '$lib/services/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  let isAuthenticated = false;
  
  onMount(async () => {
    isAuthenticated = await auth.isAuthenticated();
    
    if (!isAuthenticated) {
      goto('/login?redirect=/canister/top-up');
    }
  });
</script>

<svelte:head>
  <title>Top Up Canister | Kong</title>
</svelte:head>

<div class="container">
  <div class="header">
    <h1>Top Up Canister</h1>
    <p>Convert ICP to cycles and top up an existing canister</p>
  </div>
  
  {#if isAuthenticated}
    <TopUp />
  {:else}
    <div class="loading">
      <p>Checking authentication...</p>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .header {
    margin-bottom: 2rem;
    text-align: center;
  }
  
  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    color: #333;
  }
  
  .header p {
    font-size: 1.2rem;
    color: #666;
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
  }
</style> 