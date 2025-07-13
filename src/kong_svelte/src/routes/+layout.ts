import type { LayoutLoad } from './$types';

// Enable prerendering for static pages only
// Dynamic routes like /predict/[id] will override this setting
export const prerender = 'auto';

export const load: LayoutLoad = async ({ data }) => {
  // Pass through server-side metadata with client-side enhancements
  return {
    // Server data includes metadata from +layout.server.ts
    ...data,
    // Any client-only data can be added here
  };
};