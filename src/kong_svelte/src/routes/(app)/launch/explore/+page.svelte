<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";

  // Redirect if not authenticated (example)
  $effect(() => {
    if (!$auth.isConnected) {
      // goto("/"); // Or handle appropriately
      console.log("User not connected, showing explore page anyway for now.");
    }
  });
</script>

<div class="container mx-auto px-4 py-8">
  <Panel>
    <h2 class="text-xl font-semibold mb-4">Explore Launchpad</h2>
    <p class="text-kong-text-secondary">Discover new projects and tokens launching on KongSwap.</p>
    <!-- Add explore content here -->
  </Panel>
</div>
