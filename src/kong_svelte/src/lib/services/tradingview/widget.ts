interface TradingViewWidget {
  widget: new (config: any) => any;
}

declare global {
  interface Window {
    TradingView?: TradingViewWidget;
  }
}

export const loadTradingViewLibrary = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.TradingView) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = '/charting_library/charting_library/charting_library.standalone.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (error) => reject(error);
    document.head.appendChild(script);
  });
}; 