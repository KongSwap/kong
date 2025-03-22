<script lang="ts">
  import { page } from "$app/state";

  // Default values
  const defaultTitle = process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]";
  const defaultDescription = "Trade on prediction markets with KongSwap";
  const defaultImage = "https://kongswap.io/images/banner.webp";
  
  // Route-specific metadata
  const routeMetadata = {
    '/predict': {
      title: "Prediction Markets - KongSwap",
      description: "Trade on prediction markets with KongSwap",
      image: "https://kongswap.io/images/predictionmarket-og.png"
    }
    // Add more routes as needed
  };
  
  // Reactive values based on current route
  let title = $derived(getMetadataForCurrentRoute().title);
  let description = $derived(getMetadataForCurrentRoute().description);
  let image = $derived(getMetadataForCurrentRoute().image);
  
  function getMetadataForCurrentRoute() {
    const path = page.url.pathname;
    
    // Find the most specific route match
    for (const [route, metadata] of Object.entries(routeMetadata)) {
      if (path.startsWith(route)) {
        return metadata;
      }
    }
    
    // Return defaults if no matches
    return {
      title: defaultTitle,
      description: defaultDescription,
      image: defaultImage
    };
  }
</script>

<svelte:head>
  <title>{title} - Rumble in the crypto jungle!</title>
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
</svelte:head> 