import type { LayoutLoad } from './$types';

// This file is now only used for client-side operations
// Server-side metadata loading is handled by +layout.server.ts

export const load: LayoutLoad = ({ data }) => {
  // Just pass through the data from +layout.server.ts
  return data;
};