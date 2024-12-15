<script lang="ts">
	import { uint8ArrayToHexString } from '@dfinity/utils';
  import { fly } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { onMount } from "svelte";

  interface UserData {
    owner: string;
    subaccount: string;
    type: string;
  }

  let loading = true;
  let error: string | null = null;
  let userData: UserData | null = null;

  onMount(async () => {
    userData = {
      owner: auth.pnp?.account?.owner?.toString(),
      subaccount: uint8ArrayToHexString(auth.pnp?.account?.subaccount),
      type: auth.pnp?.account?.type
    }
  });
</script>

<div class="tab-panel" transition:fly={{ y: 20, duration: 300 }}>
  <div class="pb-4">
    <h3 class="text-sm text-white/90 mb-2 font-semibold">User Details</h3>
    <div class="w-full max-w-full mt-2">
      {#if loading}
        <div class="p-4 text-center bg-black/30 rounded border border-white/10 text-white/70">
          Loading user details...
        </div>
      {:else if error}
        <div class="p-4 text-center bg-black/30 rounded border border-white/10 text-red-400">
          Error: {error}
        </div>
      {:else if userData}
        <div class="grid gap-2">
          {#each Object.entries(userData) as [key, value]}
            <div class="flex flex-col p-3 bg-black/30 rounded border border-white/10">
              <span class="text-xs text-white/70 uppercase mb-1">{key}:</span>
              <span class="text-white/90 font-mono text-sm break-all">
                {value}
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="p-4 text-center bg-black/30 rounded border border-white/10 text-white/70">
          No user data available
        </div>
      {/if}
    </div>
  </div>
</div>

<style scoped>
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
