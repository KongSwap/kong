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
      return;
    }

    // Load the library
    const script = document.createElement('script');
    script.src = window.location.origin + '/charting_library/charting_library/charting_library.js';
    script.type = 'text/javascript';
    script.async = true;
    script.crossOrigin = 'anonymous';

    const loadPromise = new Promise((resolve, reject) => {
      script.onload = () => {
        // Add a small delay to ensure the library is fully initialized
        setTimeout(() => {
          if (window.TradingView) {
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
    await loadPromise;
  } catch (error) {
    console.error('[TradingView] Error in loadTradingViewLibrary:', error);
    throw error;
  }
} 