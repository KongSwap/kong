export function getChartConfig(params: {
  symbol: string;
  datafeed: any;
  container: HTMLElement;
  containerWidth: number;
  containerHeight: number;
  isMobile: boolean;
  autosize?: boolean;
}) {
  const { symbol, datafeed, container, containerWidth, containerHeight, isMobile, autosize } = params;

  const customTheme = {
    chart: {
      backgroundColor: 'rgba(22, 16, 40, 1)',
      layout: {
        background: { color: 'rgba(22, 16, 40, 1)' },
        textColor: '#9ca3af',
      },
      topToolbar: {
        backgroundColor: 'rgba(22, 16, 40, 1)',
        borderColor: 'transparent',
      },
      leftToolbar: {
        backgroundColor: 'rgba(22, 16, 40, 1)',
        borderColor: 'transparent',
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
    theme: 'dark',
    timezone: 'Etc/UTC',
    toolbar_bg: 'rgba(22, 16, 40, 1)',
    loading_screen: { 
      backgroundColor: "rgba(22, 16, 40, 1)",
      foregroundColor: "#2962FF"
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
    custom_css_url: '/tradingview-chart.css',
    overrides: {
      ...customTheme,
      // Chart styling
      "mainSeriesProperties.candleStyle.upColor": "#22c55e",
      "mainSeriesProperties.candleStyle.downColor": "#ef4444",
      "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
      "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
      "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
      "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
      
      // Chart background
      "paneProperties.vertGridProperties.color": "rgba(30, 41, 59, 0.64)",
      "paneProperties.horzGridProperties.color": "rgba(30, 41, 59, 0.64)",
      "paneProperties.backgroundType": "gradient",
      "paneProperties.backgroundGradientStartColor": "rgba(22, 16, 40, 0.9)",
      "paneProperties.backgroundGradientEndColor": "rgba(1, 1, 1, 0.5)",
      
      // Chart area
      "chartProperties.background": "rgba(22, 16, 40, 1)",
      "chartProperties.backgroundType": "solid",
      
      // Price scale formatting
      "mainSeriesProperties.priceFormat.precision": isMobile ? 6 : 4,
      "mainSeriesProperties.priceFormat.minMove": isMobile ? 0.000001 : 0.0001,
      
      // Price axis
      "scalesProperties.backgroundColor": "rgba(22, 16, 40, 1)",
      "scalesProperties.lineColor": "rgba(30, 41, 59, 0.2)",
      "scalesProperties.textColor": "#9ca3af",
      "scalesProperties.fontSize": isMobile ? 14 : 12,
      
      // Time axis
      "timeScale.backgroundColor": "rgba(22, 16, 40, 1)",
      "timeScale.borderColor": "rgba(30, 41, 59, 0.2)",
      "timeScale.textColor": "#9ca3af",
      
      // Volume
      "volumePaneSize": "medium",
      ...(isMobile ? {
        "paneProperties.topMargin": 12,
        "paneProperties.bottomMargin": 12,
        "paneProperties.leftAxisMargin": 12,
        "paneProperties.rightAxisMargin": 12,
        
        // Price display settings
        "scalesProperties.fontSize": 14,
        "scalesProperties.textColor": "#9ca3af",
        "scalesProperties.lineColor": "rgba(255, 255, 255, 0.1)",
        "scalesProperties.showLeftScale": false,
        "scalesProperties.showRightScale": true,
        
        // Price format settings
        "priceScale.autoScale": true,
        "priceScale.formatAmount": 6,
        "priceFormat.type": "price",
        "priceFormat.precision": 6,
        "priceFormat.minMove": 0.000001,
        
        // Time scale settings
        "timeScale.fontSize": 14,
        "timeScale.rightOffset": 5,
        "timeScale.leftOffset": 5,
        
        // Other mobile-specific settings
        "paneProperties.legendProperties.showLegend": true,
        "paneProperties.legendProperties.showStudyArguments": true,
        "paneProperties.legendProperties.showStudyTitles": true,
        "volumePaneSize": "small",
        
        // Candle style settings
        "mainSeriesProperties.candleStyle.drawWick": true,
        "mainSeriesProperties.candleStyle.drawBorder": true,
        "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
        "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
        
        // Grid settings
        "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.15)",
        "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.15)",
        
        // Crosshair settings
        "crossHairProperties.color": "#9ca3af",
        "crossHairProperties.width": 1,
        "crossHairProperties.style": 2,
      } : {}),
    },
    studies_overrides: {
      "volume.volume.color.0": "#ef4444",
      "volume.volume.color.1": "#22c55e",
      "volume.volume.transparency": 50,
      "volume.volume ma.color": "#2962FF",
      "volume.volume ma.transparency": 30,
      "volume.volume ma.linewidth": 2,
      "volume.show ma": true,
      "volume.ma length": 20
    }
  };
} 