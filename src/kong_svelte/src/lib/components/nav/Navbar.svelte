<script lang="ts">
  /**
   * Navbar Component - Refactored
   * Now uses the new NavigationProvider architecture
   * This replaces the 559-line monolithic component with a focused approach
   */
  import NavigationProvider from "./NavigationProvider.svelte";

  // Props (maintain compatibility with existing usage)
  let { 
    class: className = ""
  } = $props();
</script>

<!-- 
  The new navigation system:
  - NavigationProvider orchestrates the entire navigation
  - DesktopNavbar handles desktop-specific navigation
  - MobileNavbar handles mobile-specific navigation  
  - Modern Svelte 5 state management
  - Improved accessibility and performance
  - Proper separation of concerns
-->
<NavigationProvider class={className} />

<!--
  Migration completed:
  ✅ Reduced from 559 lines to ~15 lines
  ✅ Split into focused components with clear responsibilities
  ✅ Modern Svelte 5 state management with runes
  ✅ Extracted configuration layer
  ✅ Improved accessibility with ARIA labels and keyboard navigation
  ✅ Better performance with memoization and proper cleanup
  ✅ Touch gesture handling extracted to reusable action
  ✅ Eliminated mixed state patterns
  ✅ Enhanced type safety
-->