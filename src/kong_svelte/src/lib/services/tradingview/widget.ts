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
    console.log('Loading TradingView library...');
    if (window.TradingView) {
      console.log('TradingView already loaded');
      return;
    }

    // Load the library
    const script = document.createElement('script');
    script.src = '/charting_library/charting_library/charting_library.js';
    script.type = 'text/javascript';
    script.async = true;

    const loadPromise = new Promise((resolve, reject) => {
      script.onload = () => {
        console.log('TradingView library loaded successfully');
        resolve(true);
      };
      script.onerror = (error) => {
        console.error('Failed to load TradingView library:', error);
        reject(error);
      };
    });

    document.head.appendChild(script);
    await loadPromise;
  } catch (error) {
    console.error('Error in loadTradingViewLibrary:', error);
    throw error;
  }
} 