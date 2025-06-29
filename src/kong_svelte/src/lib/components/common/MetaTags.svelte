<script lang="ts">
  // Accept metadata including url as props
  let { 
    title, 
    description, 
    image, 
    url, 
    logo = 'https://kongswap.io/favicon/favicon-128x128.png',
    type = 'website',
    publishedTime,
    modifiedTime,
    author = 'KongSwap',
    section,
    tags = []
  }: { 
    title: string, 
    description: string, 
    image: string, 
    url: string,
    logo?: string,
    type?: string,
    publishedTime?: string,
    modifiedTime?: string,
    author?: string,
    section?: string,
    tags?: string[]
  } = $props();

  // Ensure description is within optimal length (150-160 characters)
  const optimizedDescription = description.length > 160 
    ? description.substring(0, 157) + '...'
    : description;

  // Extract domain for Twitter site
  const siteDomain = new URL(url).hostname;
</script>

<svelte:head>
  <!-- Page Title -->
  <title>{title}</title> 
  
  <!-- Base Meta Tags -->
  <meta name="description" content={optimizedDescription} />
  <meta name="author" content={author} />
  {#if tags.length > 0}
    <meta name="keywords" content={tags.join(', ')} />
  {/if}
  
  <!-- Additional SEO Meta Tags -->
  <meta name="application-name" content="KongSwap" />
  <meta name="apple-mobile-web-app-title" content="KongSwap" />
  <meta name="msapplication-TileColor" content="#0E111B" />
  
  <!-- Canonical URL -->
  <link rel="canonical" href={url} />
  
  <!-- Alternate URL for mobile (if needed) -->
  <!-- <link rel="alternate" media="only screen and (max-width: 640px)" href={url} /> -->
</svelte:head> 