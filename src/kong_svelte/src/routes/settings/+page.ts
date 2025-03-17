import { browser } from '$app/environment';

// Mark this page for client-side rendering but allow initial server render
export const ssr = true;

// Ensure client-side code is used after initial render
export const csr = true;

// Don't prerender this page
export const prerender = false; 