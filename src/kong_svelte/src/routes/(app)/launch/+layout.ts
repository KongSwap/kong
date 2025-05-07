// This layout file applies to all routes under /launch
// It forces SvelteKit to generate folder-style paths (…/index.html)
// so that a request to /launch/explore is served correctly by the IC
// asset canister (which falls back to index.html within that folder).
export const trailingSlash = 'always';
