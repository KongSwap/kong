<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { canisterId as launchpadCanisterId, idlFactory as launchpadIDL } from '$declarations/launchpad';
  import TokenGrid from "./token/TokenGrid.svelte";

  export let searchQuery = "";
  let tokens: any[] = [];
  let loading = false;

  onMount(async () => {
    loading = true;
    try {
      const actor = auth.getActor(launchpadCanisterId, launchpadIDL, { anon: true });
      tokens = await actor.list_tokens();
      console.log(tokens);
    } catch (error) {
      console.error('Failed to load tokens', error);
    } finally {
      loading = false;
    }
  });
</script>

<TokenGrid {tokens} {loading} {searchQuery} />
