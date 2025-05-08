<script lang="ts">
  import { onMount } from 'svelte';
  import * as launchpadAPI from "$lib/api/launchpad";
  import TokenGrid from "./token/TokenGrid.svelte";

  export let searchQuery = "";
  let tokens: any[] = [];
  let loading = false;

  onMount(async () => {
    loading = true;
    try {
      tokens = await launchpadAPI.listTokens();
      console.log(tokens);
    } catch (error) {
      console.error('Failed to load tokens', error);
    } finally {
      loading = false;
    }
  });
</script>

<TokenGrid {tokens} {loading} {searchQuery} />