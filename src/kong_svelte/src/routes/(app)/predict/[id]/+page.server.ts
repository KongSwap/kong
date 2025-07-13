import type { PageServerLoad } from './$types';
import { getMarketDetailDataSSR } from '$lib/services/ssr/predictionService.server';
import { error } from '@sveltejs/kit';
import { generateMetadata, generateStructuredData } from '$lib/utils/metadata';

export const load: PageServerLoad = async ({ params, setHeaders, url, parent }) => {
  // Set cache headers for dynamic content
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
  });

  try {
    // Use optimized SSR service for batch data fetching
    const { market, marketTokenInfo, supportedTokens, initialBets } = 
      await getMarketDetailDataSSR(params.id);

    if (!market) {
      throw error(404, 'Market not found');
    }

    // Get parent data (includes base metadata from layout)
    const parentData = await parent();
    
    // Generate metadata using centralized utility
    const metadata = generateMetadata(url.pathname, {
      title: `${market.question} - KongSwap Predictions`,
      description: market.rules || `Predict the outcome of: ${market.question}`,
      imageUrl: market.image_url || 'https://kongswap.io/images/predictionmarket-og.jpg',
      id: params.id
    });

    // Generate structured data for SEO
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: market.question,
      description: market.rules,
      startDate: new Date(Number(market.created_at) / 1_000_000).toISOString(),
      endDate: new Date(Number(market.end_time) / 1_000_000).toISOString(),
      eventStatus: market.status?.Active ? 'EventScheduled' : 
                   market.status?.Closed ? 'EventCompleted' : 'EventCancelled',
      organizer: {
        '@type': 'Organization',
        name: 'KongSwap Predictions'
      },
      location: {
        '@type': 'VirtualLocation',
        url: url.href
      },
      offers: market.outcomes.map((outcome: string, index: number) => ({
        '@type': 'Offer',
        name: outcome,
        price: market.outcome_percentages?.[index] || 0,
        priceCurrency: marketTokenInfo?.symbol || 'KONG'
      }))
    };

    return {
      // Spread parent data to maintain metadata chain
      ...parentData,
      // Override metadata for this specific page
      metadata,
      // Page-specific data
      market,
      marketTokenInfo,
      supportedTokens,
      initialBets,
      structuredData,
      marketId: params.id,
      timestamp: Date.now()
    };
  } catch (err) {
    console.error('Failed to load market:', err);
    
    if (err instanceof Error && 'status' in err && err.status === 404) {
      throw error(404, 'Market not found');
    }
    
    throw error(500, 'Failed to load market data');
  }
};