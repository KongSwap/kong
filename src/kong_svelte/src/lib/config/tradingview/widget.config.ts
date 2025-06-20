interface TradingViewWidget {
  widget: new (config: any) => any;
}

declare global {
  interface Window {
    TradingView?: TradingViewWidget;
  }
}

export async function loadTradingViewLibrary() {
  try {
    if (window.TradingView) {
      console.log("[TradingView] Library already loaded");
      return;
    }

    // Load the library
    const script = document.createElement('script');
    script.src = window.location.origin + '/charting_library/charting_library/charting_library.js';
    script.type = 'text/javascript';
    script.async = true;
    script.crossOrigin = 'anonymous';

    console.log("[TradingView] Loading library from:", script.src);

    const loadPromise = new Promise((resolve, reject) => {
      script.onload = () => {
        console.log("[TradingView] Script loaded, checking initialization...");
        // Add a small delay to ensure the library is fully initialized
        setTimeout(() => {
          if (window.TradingView) {
            console.log("[TradingView] Library initialized successfully");
            resolve(true);
          } else {
            console.error("[TradingView] Library failed to initialize - window.TradingView is undefined");
            reject(new Error('TradingView failed to initialize'));
          }
        }, 100);
      };
      script.onerror = (error) => {
        console.error('[TradingView] Failed to load library script:', error);
        reject(error);
      };
    });

    document.head.appendChild(script);
    console.log("[TradingView] Script element added to DOM");
    
    // Check if script is actually in the DOM
    const addedScript = document.querySelector(`script[src="${script.src}"]`);
    console.log("[TradingView] Script found in DOM:", !!addedScript);
    
    await loadPromise;
  } catch (error) {
    console.error('[TradingView] Error in loadTradingViewLibrary:', error);
    throw error;
  }
} 