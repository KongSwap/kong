import type { PageServerLoad } from './$types';
import { getMarketDetailDataSSR } from '$lib/services/ssr/predictionService.server';
import { error } from '@sveltejs/kit';
import { generateMetadata } from '$lib/utils/metadata';

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

    // Prepare clean metadata - single field per tag, no fallbacks here
    const cleanImage = Array.isArray(market.image_url) ? market.image_url[0] : market.image_url;
    
    const metadata = generateMetadata(url.pathname, {
      title: `${market.question} - KongSwap Predictions`,
      description: market.rules || `Predict the outcome of: ${market.question}`,
      image: cleanImage || 'https://kongswap.io/images/predictionmarket-og.jpg',
      id: params.id
    });

    return {
      metadata,
      market,
      marketTokenInfo,
      supportedTokens,
      initialBets,
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