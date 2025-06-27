import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import type { Page } from "@sveltejs/kit";

export type URLSyncConfig = {
  [key: string]: {
    param: string;
    value: any;
  };
};

/**
 * Syncs state values with URL parameters
 * @param page - The SvelteKit page store
 * @param config - Configuration object mapping state to URL params
 * @param options - Additional options for navigation
 */
export function syncURLParams(
  page: Page,
  config: URLSyncConfig,
  options: { replaceState?: boolean; noScroll?: boolean; keepFocus?: boolean } = {}
) {
  if (!browser) return;

  const newUrlParams = new URLSearchParams(page.url.searchParams.toString());
  let changed = false;

  // Check each config entry for changes
  for (const [key, { param, value }] of Object.entries(config)) {
    const currentValue = newUrlParams.get(param);
    const newValue = value?.toString() || "";

    if (currentValue !== newValue) {
      if (value) {
        newUrlParams.set(param, newValue);
      } else {
        newUrlParams.delete(param);
      }
      changed = true;
    }
  }

  // Navigate if parameters changed
  if (changed) {
    const currentPath = page.url.pathname;
    goto(`${currentPath}?${newUrlParams.toString()}`, {
      replaceState: options.replaceState ?? true,
      noScroll: options.noScroll ?? true,
      keepFocus: options.keepFocus ?? true,
    });
  }
}

/**
 * Extracts initial values from URL parameters
 * @param page - The SvelteKit page store
 * @param params - Array of parameter names to extract
 * @returns Object with parameter values
 */
export function getURLParams(
  page: Page,
  params: string[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  
  for (const param of params) {
    result[param] = page.url.searchParams.get(param);
  }
  
  return result;
}