import type { LayoutServerLoad } from './$types';
import { generateMetadata } from '$lib/utils/metadata';

export const load: LayoutServerLoad = async ({ url }) => {
  // Generate default metadata server-side based on the current URL
  // This will be overridden by page-specific metadata if provided
  const metadata = generateMetadata(url.pathname);
  
  return {
    metadata,
    // Include timestamp for cache busting if needed
    timestamp: new Date().toISOString(),
    // Pass the full URL for client-side use
    currentUrl: url.toString()
  };
};