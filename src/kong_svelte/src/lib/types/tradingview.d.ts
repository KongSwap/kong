interface TradingViewWidget {
  widget: new (config: any) => any;
}

declare global {
  var TradingView: TradingViewWidget | undefined;
}

export {};
