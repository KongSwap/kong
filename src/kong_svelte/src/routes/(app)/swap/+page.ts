import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Redirect /swap to / since the swap interface is at the root
export const load: PageLoad = async () => {
  throw redirect(301, '/');
};

// Disable SSR since we're using adapter-static
export const ssr = false;
export const prerender = false; // Can't prerender redirects 