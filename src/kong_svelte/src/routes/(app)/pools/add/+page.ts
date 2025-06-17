import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
  // Extract tokens from URL
  const token0 = url.searchParams.get('token0');
  const token1 = url.searchParams.get('token1');
  
  // Return data that will be available during static generation
  // The actual token fetching happens in the component where it can
  // properly handle browser-only APIs
  return {
    token0,
    token1
  };
};

// This ensures the page is rendered at build time with all possible
// token combinations that might be linked to
export const prerender = false;