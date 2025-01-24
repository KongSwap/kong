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
    theme = 'dark'
  } = params;

  const getPrecision = (price: number) => {
    if (price >= 1000) return 2;
    if (price >= 1) return 4;
    return 6;
  };

  const getMinMove = (price: number) => {
    if (price >= 1000) return 0.01;
    if (price >= 1) return 0.0001;
    return 0.000001;
  };

  const precision = getPrecision(currentPrice);
  const minMove = getMinMove(currentPrice);

  const customTheme = {
    chart: {
      backgroundColor: theme === 'dark' ? '#000000' : '#FFFFFF',
      layout: {
        background: { 
          type: "solid",
          color: theme === 'dark' ? '#000000' : '#FFFFFF'
        },
        textColor: theme === 'dark' ? '#9BA1B0' : '#4B5563',
      },
      topToolbar: {
        backgroundColor: theme === 'dark' ? '#000000' : '#FFFFFF',
        borderColor: theme === 'dark' ? '#2A2F3D' : '#E5E7EB',
      },
      leftToolbar: {
        backgroundColor: theme === 'dark' ? '#000000' : '#FFFFFF',
        borderColor: theme === 'dark' ? '#2A2F3D' : '#E5E7EB',
      }
    },
  };

  return {
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
    theme: theme,
    timezone: 'Etc/UTC',
    toolbar_bg: 'rgba(0,0,0,0)',
    loading_screen: { 
      backgroundColor: theme === 'dark' ? '#000000' : '#FFFFFF',
      foregroundColor: "#00A1FA"
    },
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
    custom_css_url: '../../tradingview-chart.css',
    overrides: {
      ...customTheme,
      // Chart styling
      "mainSeriesProperties.candleStyle.upColor": "#00cc81",
      "mainSeriesProperties.candleStyle.downColor": "#d11b1b",
      "mainSeriesProperties.candleStyle.borderUpColor": "#00cc81",
      "mainSeriesProperties.candleStyle.borderDownColor": "#d11b1b",
      "mainSeriesProperties.candleStyle.wickUpColor": "#00cc81",
      "mainSeriesProperties.candleStyle.wickDownColor": "#d11b1b",
      
      // Chart background and grid - adjust for themes
      "paneProperties.vertGridProperties.color": theme === 'dark' ? '#2A2F3D' : '#E5E7EB',
      "paneProperties.horzGridProperties.color": theme === 'dark' ? '#2A2F3D' : '#E5E7EB',
      "paneProperties.backgroundType": "solid",
      "paneProperties.background": theme === 'dark' ? '#000000' : '#FFFFFF',
      
      // Chart area
      "chartProperties.background": theme === 'dark' ? '#000000' : '#FFFFFF',
      "chartProperties.backgroundType": "solid",
      
      // Price axis
      "scalesProperties.backgroundColor": theme === 'dark' ? '#000000' : '#FFFFFF',
      "scalesProperties.lineColor": theme === 'dark' ? '#2A2F3D' : '#E5E7EB',
      "scalesProperties.textColor": theme === 'dark' ? '#9BA1B0' : '#4B5563',
      "scalesProperties.fontSize": isMobile ? 14 : 12,
      
      // Time axis
      "timeScale.backgroundColor": theme === 'dark' ? '#000000' : '#FFFFFF',
      "timeScale.borderColor": theme === 'dark' ? '#2A2F3D' : '#E5E7EB',
      "timeScale.textColor": theme === 'dark' ? '#9BA1B0' : '#4B5563',
      
      // Loading screen
      "loading_screen.backgroundColor": theme === 'dark' ? '#000000' : '#FFFFFF',
      "loading_screen.foregroundColor": "#00A1FA",
      
      // Volume
      "volumePaneSize": "medium",
      ...(isMobile ? {
        "paneProperties.topMargin": 8,
        "paneProperties.bottomMargin": 8,
        "paneProperties.leftAxisMargin": 8,
        "paneProperties.rightAxisMargin": 8,
        
        // Price display settings
        "scalesProperties.fontSize": 11,
        "scalesProperties.textColor": "#9BA1B0",
        "scalesProperties.lineColor": theme === 'dark' ? 
          'rgba(255, 255, 255, 0.1)' : 
          'rgba(0, 0, 0, 0.1)',
        "scalesProperties.showLeftScale": false,
        "scalesProperties.showRightScale": true,
        
        // Price format settings
        "priceScale.autoScale": true,
        "priceScale.formatAmount": 6,
        "priceFormat.type": "price",
        "priceFormat.precision": precision,
        "priceFormat.minMove": minMove,
        
        // Time scale settings
        "timeScale.fontSize": 11,
        "timeScale.rightOffset": 3,
        "timeScale.leftOffset": 3,
        
        // Other mobile-specific settings
        "paneProperties.legendProperties.showLegend": true,
        "paneProperties.legendProperties.showStudyArguments": false,
        "paneProperties.legendProperties.showStudyTitles": true,
        "paneProperties.legendProperties.fontSize": 11,
        "volumePaneSize": "tiny",
        
        // Candle style settings
        "mainSeriesProperties.candleStyle.drawWick": true,
        "mainSeriesProperties.candleStyle.drawBorder": true,
        "mainSeriesProperties.candleStyle.borderUpColor": "#00cc81",
        "mainSeriesProperties.candleStyle.borderDownColor": "#d11b1b",
        "mainSeriesProperties.candleStyle.wickUpColor": "#00cc81",
        "mainSeriesProperties.candleStyle.wickDownColor": "#d11b1b",
        
        // Grid settings
        "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.03)",
        "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.03)",
        
        // Crosshair settings
        "crossHairProperties.color": "#9BA1B0",
        "crossHairProperties.width": 0.5,
        "crossHairProperties.style": 2,
      } : {}),
    },
    studies_overrides: {
      "volume.volume.color.0": "#d11b1b",
      "volume.volume.color.1": "#00cc81",
      "volume.volume.transparency": theme === 'dark' ? 50 : 65,
      "volume.volume ma.color": "#00A1FA",
      "volume.volume ma.transparency": theme === 'dark' ? 30 : 45,
      "volume.volume ma.linewidth": 2,
      "volume.show ma": true,
      "volume.ma length": 20
    }
  };
} 