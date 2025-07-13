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
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={optimizedDescription} />
  <meta property="og:image" content={image} />
  <meta property="og:image:alt" content={title} />
  <meta property="og:url" content={url} />
  <meta property="og:type" content={type} />
  <meta property="og:site_name" content="KongSwap" />
  <meta property="og:locale" content="en_US" />
  
  {#if type === 'article' && publishedTime}
    <meta property="article:published_time" content={publishedTime} />
    {#if modifiedTime}
      <meta property="article:modified_time" content={modifiedTime} />
    {/if}
    <meta property="article:author" content={author} />
    {#if section}
      <meta property="article:section" content={section} />
    {/if}
    {#if tags.length > 0}
      {#each tags as tag}
        <meta property="article:tag" content={tag} />
      {/each}
    {/if}
  {/if}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={optimizedDescription} />
  <meta name="twitter:image" content={image} />
  <meta name="twitter:image:alt" content={title} />
  <meta name="twitter:site" content="@KongSwap" />
  <meta name="twitter:creator" content="@KongSwap" />
  
  <!-- Additional SEO Tags -->
  <meta property="fb:app_id" content="KongSwap" />
  <link rel="icon" type="image/png" href={logo} />
  
  <!-- Structured Data for Rich Snippets -->
  {@html `<script type="application/ld+json">
    ${JSON.stringify(
      type === 'article' ? {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": optimizedDescription,
        "image": image,
        "datePublished": publishedTime,
        "dateModified": modifiedTime || publishedTime,
        "author": {
          "@type": "Organization",
          "name": author || "KongSwap"
        },
        "publisher": {
          "@type": "Organization",
          "name": "KongSwap",
          "logo": {
            "@type": "ImageObject",
            "url": logo
          }
        },
        ...(section && { "articleSection": section })
      } : {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "KongSwap",
        "url": url,
        "description": optimizedDescription,
        "publisher": {
          "@type": "Organization",
          "name": "KongSwap",
          "logo": {
            "@type": "ImageObject",
            "url": logo
          }
        }
      }
    )}
  </script>`}
</svelte:head> 