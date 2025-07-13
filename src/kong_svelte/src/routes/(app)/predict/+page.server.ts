import type { PageServerLoad } from './$types';
import { getPredictionListDataSSR } from '$lib/services/ssr/predictionService.server';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  // Set cache headers for CDN optimization
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600'
  });

  // Parse URL parameters for filters (only if searchParams is available - not during prerendering)
  let statusFilter = 'all';
  let sortOption = 'newest';
  
  try {
    statusFilter = url.searchParams.get('status') || 'all';
    sortOption = url.searchParams.get('sort') || 'newest';
  } catch (error) {
    // During prerendering, searchParams is not available - use defaults
    // Client-side will handle URL parameter parsing
  }

  try {
    // Use optimized SSR service for batch data fetching
    const { recentBets, kongToken } = await getPredictionListDataSSR();
    
    return {
      recentBets,
      kongToken,
      initialFilters: {
        statusFilter,
        sortOption
      },
      // Pass timestamp for hydration consistency
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Failed to load prediction markets SSR data:', error);
    
    // Graceful fallback - let client handle data fetching
    return {
      recentBets: [],
      kongToken: null,
      initialFilters: {
        statusFilter,
        sortOption
      },
      error: 'Failed to load initial data',
      timestamp: Date.now()
    };
  }
};