<script lang="ts">
  // Accept metadata including url as props
  let { title, description, image, url, logo = 'https://kongswap.io/favicon/favicon-128x128.png' }: { 
    title: string, 
    description: string, 
    image: string, 
    url: string,
    logo?: string 
  } = $props();
</script>

<svelte:head>
  <!-- Use the title prop directly -->
  <title>{title}</title> 
  <!-- Add base description meta tag -->
  <meta name="description" content={description} />
  
  <!-- Open Graph Tags -->
  <meta property="og:locale" content="en" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={url} />
  <meta property="og:logo" content={logo} />

  <!-- Twitter Card Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />

  <link rel="canonical" href={url} />
</svelte:head> 