<script lang="ts">
  import "../app.css";
  import { app } from "$lib/state/app.state.svelte";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import MetaTags from "$lib/components/common/MetaTags.svelte";
  import ModalRenderer from "$lib/components/common/modals/ModalRenderer.svelte";
  import type { LayoutData } from "./$types";
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
</script>

<MetaTags
  logo="https://www.kongswap.io/android-chrome-192x192.png"
  title={data.metadata.title}
  description={data.metadata.description}
  image={data.metadata.image}
  url={data.metadata.url}
  tags={data.metadata.keywords || []}
/>

{@render children?.()}

<!-- Global Modal System -->
<ModalRenderer />
