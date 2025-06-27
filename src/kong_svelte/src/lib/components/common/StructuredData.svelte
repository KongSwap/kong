<script lang="ts">
  // Structured Data Component for SEO
  let { 
    type = 'WebPage',
    data = {},
    pageUrl = '',
    title = '',
    description = '',
    image = ''
  }: {
    type?: string;
    data?: Record<string, any>;
    pageUrl?: string;
    title?: string;
    description?: string;
    image?: string;
  } = $props();

  // Base structured data for all pages
  const baseStructuredData = {
    "@context": "https://schema.org",
    "@type": type,
    "name": title,
    "description": description,
    "url": pageUrl,
    "image": image,
    "isPartOf": {
      "@type": "WebSite",
      "@id": "https://kongswap.io/#website",
      "url": "https://kongswap.io",
      "name": "KongSwap"
    },
    "publisher": {
      "@id": "https://kongswap.io/#organization"
    },
    "potentialAction": {
      "@type": "ReadAction",
      "target": [pageUrl]
    }
  };

  // Merge with additional data
  const structuredData = { ...baseStructuredData, ...data };

  // Clean up undefined values
  const cleanStructuredData = JSON.parse(JSON.stringify(structuredData, (key, value) => {
    return value === undefined || value === '' ? undefined : value;
  }));
</script>

<svelte:head>
  <script type="application/ld+json">
    {@html JSON.stringify(cleanStructuredData, null, 0)}
  </script>
</svelte:head> 