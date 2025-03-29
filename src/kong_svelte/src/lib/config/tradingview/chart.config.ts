export function getChartConfig(params: {
  symbol: string;
  datafeed: any;
  container: HTMLElement;
  containerWidth: number;
  containerHeight: number;
  isMobile: boolean;
  autosize?: boolean;
  currentPrice?: number;
  theme?: string;
  quoteTokenDecimals?: number;
  baseTokenDecimals?: number;
}) {
  const { 
    symbol, 
    datafeed, 
    container, 
    containerWidth, 
    containerHeight, 
    isMobile, 
    autosize,
    currentPrice = 1000,
    quoteTokenDecimals = 8,
    baseTokenDecimals = 8
  } = params;

  const getPrecision = (price: number) => {
    // Adjust price based on token decimals to get the actual price
    const adjustedPrice = price * Math.pow(10, baseTokenDecimals - quoteTokenDecimals);
    
    if (adjustedPrice >= 1000) return 5;
    if (adjustedPrice >= 1) return 6;
    return 8;
  };

  const getMinMove = (price: number) => {
    // Adjust price based on token decimals to get the actual price
    const adjustedPrice = price * Math.pow(10, baseTokenDecimals - quoteTokenDecimals);
    
    if (adjustedPrice >= 1000) return 0.0001;
    if (adjustedPrice >= 1) return 0.000001;
    return 0.00000001;
  };

  const precision = getPrecision(currentPrice);
  const minMove = getMinMove(currentPrice);

  // Get computed CSS values from the document
  const getThemeColor = (cssVar: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallback;
  };

  // Get RGB values and convert to hex
  const rgbToHex = (rgbVar: string, fallback: string): string => {
    const rgb = getThemeColor(rgbVar, '').split(' ').map(Number);
    if (rgb.length === 3 && !rgb.some(isNaN)) {
      return `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }
    return fallback;
  };

  // Core theme colors
  const bgDarkColor = rgbToHex('--bg-dark', '#000000');
  const borderColor = rgbToHex('--border', '#333333');
  const textSecondaryColor = rgbToHex('--text-secondary', '#AAAAAA');
  const accentBlueColor = rgbToHex('--accent-blue', '#00A7FF');
  const accentGreenColor = rgbToHex('--accent-green', '#05EC86');
  const accentRedColor = rgbToHex('--accent-red', '#FF4545');

  // Build the config object
  const config = {
    symbol,
    datafeed,
    interval: '60',
    container,
    library_path: '/charting_library/charting_library/',
    width: containerWidth,
    height: isMobile ? 400 : containerHeight,
    locale: 'en',
    fullscreen: false,
    autosize: autosize ?? true,
    backgroundColor: bgDarkColor,
    backgroundType: 'solid',
    background: bgDarkColor,
    timezone: 'Etc/UTC',
    loading_screen: { 
      backgroundColor: bgDarkColor,
      foregroundColor: accentBlueColor
    },
    numeric_formatting: { decimal_sign: '.' },
    disabled_features: [
      'use_localstorage_for_settings',
      'study_templates',
      'header_saveload',
      'header_settings',
      'header_compare',
      'header_symbol_search',
      'header_screenshot',
      'timeframes_toolbar',
      'symbol_info',
      ...(isMobile ? [
        'left_toolbar',
        'volume_force_overlay',
        'create_volume_indicator_by_default',
        'border_around_the_chart',
        'main_series_scale_menu',
        'scales_date_format_button',
        'display_market_status',
        'control_bar',
        'chart_crosshair_menu',
        'popup_hints',
        'legend_context_menu',
      ] : [])
    ],
    enabled_features: [
      ...(isMobile ? [] : [
        'create_volume_indicator_by_default',
        'left_toolbar',
        'volume_force_overlay'
      ]),
      'show_chart_property_page',
      'support_multicharts',
      'legend_widget'
    ],
    // Use absolute path to make sure the CSS file is found
    overrides: {
      // Main chart style
      "mainSeriesProperties.style": 1, // 1 = Candles
      "mainSeriesProperties.candleStyle.upColor": accentGreenColor,
      "mainSeriesProperties.candleStyle.downColor": accentRedColor,
      "mainSeriesProperties.candleStyle.drawWick": true,
      "mainSeriesProperties.candleStyle.drawBorder": true,
      "mainSeriesProperties.candleStyle.borderUpColor": accentGreenColor,
      "mainSeriesProperties.candleStyle.borderDownColor": accentRedColor,
      "mainSeriesProperties.candleStyle.wickUpColor": accentGreenColor,
      "mainSeriesProperties.candleStyle.wickDownColor": accentRedColor,
      
      // Chart background and grid
      "paneProperties.background": bgDarkColor,
      "paneProperties.vertGridProperties.color": borderColor,
      "paneProperties.horzGridProperties.color": borderColor,
      "paneProperties.crossHairProperties.color": accentBlueColor,

      "platformProperties.background": bgDarkColor,
      
      // Scale (Y axis)
      "scalesProperties.backgroundColor": bgDarkColor,
      "scalesProperties.lineColor": borderColor,
      "scalesProperties.textColor": textSecondaryColor,
      
      // Volume indicator
      "volumePaneSize": "medium",
      
      // Time scale (X axis)
      "timeScale.rightOffset": 5,
      "timeScale.borderColor": borderColor,
      "timeScale.backgroundColor": bgDarkColor,
      "timeScale.textColor": textSecondaryColor,
      "timeScale.lineColor": borderColor,
    }
  };

  return config;
} 