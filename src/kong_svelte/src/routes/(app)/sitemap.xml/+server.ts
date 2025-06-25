import type { RequestHandler } from './$types';

const SITEMAP_URL = 'https://kongswap.io'; // Base URL for the site

interface SitemapPage {
  url: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
}

// Define static pages with more detailed configuration
const staticPages: SitemapPage[] = [
  { url: '/', changefreq: 'daily', priority: '1.0' },
  { url: '/swap', changefreq: 'hourly', priority: '0.9' },
  { url: '/pools', changefreq: 'hourly', priority: '0.9' },
  { url: '/stats', changefreq: 'hourly', priority: '0.8' },
  { url: '/predict', changefreq: 'hourly', priority: '0.8' },
  { url: '/settings', changefreq: 'weekly', priority: '0.5' },
  { url: '/airdrop-claims', changefreq: 'daily', priority: '0.7' },
  { url: '/wallets', changefreq: 'weekly', priority: '0.6' },
  { url: '/pro', changefreq: 'weekly', priority: '0.7' },
  // Add other static routes here as needed
];

// TODO: In the future, you can fetch dynamic pages like prediction markets
// const fetchDynamicPages = async () => {
//   try {
//     // Fetch prediction market IDs and other dynamic content
//     const markets = await fetch(`${SITEMAP_URL}/api/prediction-markets`);
//     return markets.map(market => ({
//       url: `/predict/${market.id}`,
//       changefreq: 'daily',
//       priority: '0.6',
//       lastmod: market.updated_at
//     }));
//   } catch (error) {
//     console.error('Error fetching dynamic pages for sitemap:', error);
//     return [];
//   }
// };

export async function GET() {
  // For static adapter compatibility, generate at build time
  const buildTime = new Date().toISOString();
  
  // All pages for static generation (no dynamic fetching)
  const allPages = staticPages;

  const headers = {
    'Cache-Control': 'public, max-age=86400', // Cache for 24 hours (static content)
    'Content-Type': 'application/xml; charset=utf-8',
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:mobile="https://www.google.com/schemas/sitemap-mobile/1.0"
  xmlns:image="https://www.google.com/schemas/sitemap-image/1.1"
>
${allPages
  .map(
    (page) => `  <url>
    <loc>${SITEMAP_URL}${page.url}</loc>
    <lastmod>${page.lastmod || buildTime}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <mobile:mobile/>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml.trim(), { headers });
}

// Ensure this endpoint is prerendered
export const prerender = true; 