<script lang="ts">
  import "../app.css";
  import { themeStore } from "$lib/stores/themeStore";
  // Theme initialization happens automatically in the store

  let { children } = $props<{
    children: any;
  }>();
</script>

{@render children?.()}

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