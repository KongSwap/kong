<script lang="ts">
  import "../app.css";
  import { themeStore } from "$lib/stores/themeStore";
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  onMount(async () => {
    themeStore.initTheme();
  })

  // Routes that should skip this root layout
  let skipRootLayout = $derived(
    $page.url.pathname.startsWith('/app') || 
    $page.url.pathname.startsWith('/dashboard')
    // Add more paths as needed
  );
</script>

{#if skipRootLayout}
  <!-- Just render children without any root layout wrapper -->
  <slot />
{:else}
  <!-- Your original root layout content for other pages -->
  <div class="root-layout-wrapper">
    <!-- Add any root layout specific content here -->
    <slot />
  </div>
{/if}

<style>


  /* Faster fade-out for loading spinner */
  @media (prefers-reduced-motion: no-preference) {

    @keyframes fadeOut {
      to {
        opacity: 0;
        visibility: hidden;
      }
    }
  }
</style>