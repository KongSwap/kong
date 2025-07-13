<script lang="ts">
  import "../app.css";
  import { app } from "$lib/state/app.state.svelte";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import MetaTags from "$lib/components/common/MetaTags.svelte";
  import ModalRenderer from "$lib/components/common/modals/ModalRenderer.svelte";
  import type { LayoutData } from "./$types";
  import { page } from "$app/state";
  // Theme initialization happens automatically in the store

  const handleResize = () => {
    app.isMobile = browser && window.innerWidth < 768;
    app.navbarHeight =
      document.getElementById("navbar-section")?.offsetHeight || 0;
  };

  onMount(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  let { children, data } = $props<{
    children: any;
    data: LayoutData;
  }>();
  
  // Use page-specific metadata if available, otherwise layout metadata
  const metadata = $derived(page.data?.metadata || data.metadata);
</script>

<MetaTags
  logo="https://www.kongswap.io/android-chrome-192x192.png"
  title={metadata?.title || 'KongSwap'}
  description={metadata?.description || 'Trade tokens on Internet Computer'}
  image={metadata?.image || 'https://kongswap.io/images/banner.jpg'}
  url={metadata?.url || 'https://kongswap.io'}
  tags={metadata?.tags || []}
  type={metadata?.type}
  publishedTime={metadata?.publishedTime}
  modifiedTime={metadata?.modifiedTime}
  author={metadata?.author}
  section={metadata?.section}
/>

{@render children?.()}

<!-- Global Modal System -->
<ModalRenderer />
