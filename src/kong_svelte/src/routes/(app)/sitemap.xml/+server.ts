
const SITEMAP_URL = 'https://kongswap.io'; // Base URL for the site
// Define static pages
// Exclude pages that rely heavily on client-side rendering or are dynamic by nature
// (e.g., /swap, /pools, /stats, /predict based on svelte.config.js)
const staticPages = [
  '/',
  '/swap',
  '/pools',
  '/stats',
  '/predict',
  '/settings',
  '/airdrop-claims',
  '/wallets',
  // Add other static routes here as needed
];

export async function GET() {
  const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format

  const headers = {
    'Cache-Control': 'max-age=0, s-maxage=3600', // Cache for 1 hour on CDN
    'Content-Type': 'application/xml',
  };

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="https://www.w3.org/1999/xhtml"
  xmlns:mobile="https://www.google.com/schemas/sitemap-mobile/1.0"
  xmlns:news="https://www.google.com/schemas/sitemap-news/0.9"
  xmlns:image="https://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="https://www.google.com/schemas/sitemap-video/1.1"
>
${staticPages
  .map(
    (page) => `
  <url>
    <loc>${SITEMAP_URL}${page}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq> <!-- Adjust frequency as needed -->
    <priority>${page === '/' ? '1.0' : '0.7'}</priority> <!-- Adjust priority as needed -->
  </url>
`,
  )
  .join('')}
</urlset>`;

  return new Response(xml.trim(), { headers });
}

// Ensure this endpoint is prerendered
export const prerender = true; 