import { browser } from "$app/environment";

// Define acceptable event names
export enum AnalyticsEvent {
  ConnectWallet = 'connect_wallet',
  // Add other event names here
  // Example: SwapCompleted = 'swap_completed',
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Tracks an event using Google Analytics (gtag.js).
 * Ensures the call is made only in the browser environment and if gtag is available.
 *
 * @param eventName - The name of the event to track.
 * @param eventParams - An object containing parameters for the event.
 */
export const trackEvent = (eventName: AnalyticsEvent, eventParams?: Record<string, any>) => {
  if (browser && window.gtag) {
    window.gtag("event", eventName, eventParams);
  } else if (browser) {
    console.warn("gtag is not defined on window. Analytics event not sent.");
  }
}; 