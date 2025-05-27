/**
 * Utility to read a CSS variable from the document or fallback to a given value.
 */
const getCssVar = (cssVar: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallback;
};

/**
 * Convert an RGB CSS variable (stored as space-separated numbers) into a hex color.
 * Example: "255 255 255" -> "#ffffff"
 */
const rgbVarToHex = (cssVar: string, fallback: string): string => {
  const rgb = getCssVar(cssVar, '').split(' ').map(Number);
  if (rgb.length === 3 && !rgb.some(isNaN)) {
    return `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }
  return fallback;
};

/**
 * Get the current TradingView theme colors derived from CSS variables.
 * Returns an object keyed by logical color name so it can be reused across widgets.
 */
export const getTradingViewColors = () => {
  // Core theme colors
  const bgPrimaryColor = rgbVarToHex('--bg-primary', '#000000');
  const bgSecondaryColor = rgbVarToHex('--bg-secondary', '#111111');
  const borderColor = rgbVarToHex('--border', '#333333');
  const borderLightColor = rgbVarToHex('--border-light', '#444444');
  const textPrimaryColor = rgbVarToHex('--text-primary', '#FFFFFF');
  const textSecondaryColor = rgbVarToHex('--text-secondary', '#AAAAAA');
  const accentBlueColor = rgbVarToHex('--accent-blue', '#00A7FF');
  const accentGreenColor = rgbVarToHex('--accent-green', '#05EC86');
  const accentRedColor = rgbVarToHex('--accent-red', '#FF4545');

  return {
    bgDarkColor: bgPrimaryColor,
    bgLightColor: bgSecondaryColor,
    borderColor,
    borderLightColor,
    textPrimaryColor,
    textSecondaryColor,
    accentBlueColor,
    accentGreenColor,
    accentRedColor
  } as const;
};

/**
 * Inject/update TradingView CSS custom properties on the root element so that
 * the library has the right colours *before* the widget is instantiated.
 */
export const setTradingViewRootVars = () => {
  if (typeof document === 'undefined') return;

  const {
    bgDarkColor,
    bgLightColor,
    borderColor,
    borderLightColor,
    textPrimaryColor,
    textSecondaryColor,
    accentBlueColor,
    accentGreenColor,
    accentRedColor
  } = getTradingViewColors();

  const root = document.documentElement.style;

  root.setProperty('--tv-color-platform-background', bgDarkColor);
  root.setProperty('--tv-color-pane-background', bgDarkColor);
  root.setProperty('--tv-color-background', bgDarkColor);
  root.setProperty('--tv-color-toolbar-button-background-hover', bgLightColor);
  root.setProperty('--tv-color-toolbar-button-background-expanded', borderColor);
  root.setProperty('--tv-color-toolbar-button-background-active', borderLightColor);
  root.setProperty('--tv-color-toolbar-button-background-active-hover', borderLightColor);
  root.setProperty('--tv-color-toolbar-button-text', textSecondaryColor);
  root.setProperty('--tv-color-toolbar-button-text-hover', textPrimaryColor);
  root.setProperty('--tv-color-toolbar-button-text-active', textPrimaryColor);
  root.setProperty('--tv-color-toolbar-button-text-active-hover', textPrimaryColor);
  root.setProperty('--tv-color-item-active-text', textPrimaryColor);
  root.setProperty('--tv-color-toolbar-toggle-button-background-active', accentBlueColor);
  root.setProperty('--tv-color-toolbar-toggle-button-background-active-hover', accentBlueColor);
  root.setProperty('--tv-color-toolbar-divider-background', borderColor);
  root.setProperty('--tv-color-popup-background', bgLightColor);
  root.setProperty('--tv-color-popup-element-text', textSecondaryColor);
  root.setProperty('--tv-color-popup-element-text-hover', textPrimaryColor);
  root.setProperty('--tv-color-popup-element-background-hover', borderColor);
  root.setProperty('--tv-color-popup-element-divider-background', borderColor);
  root.setProperty('--tv-color-popup-element-secondary-text', textSecondaryColor);
  root.setProperty('--tv-color-buy-button', accentGreenColor);
  root.setProperty('--tv-color-sell-button', accentRedColor);
  root.setProperty('--themed-color-buy-btn-chart', accentGreenColor);
  root.setProperty('--themed-color-sell-btn-chart', accentRedColor);
};

/**
 * Apply TradingView CSS custom properties on an existing widget instance.
 * Will silently ignore if the widget does not expose `setCSSCustomProperty`.
 */
export const applyTradingViewTheme = (chart: any) => {
  if (!chart || !chart.setCSSCustomProperty) return;

  const {
    bgDarkColor,
    bgLightColor,
    borderColor,
    borderLightColor,
    textPrimaryColor,
    textSecondaryColor,
    accentBlueColor,
    accentGreenColor,
    accentRedColor
  } = getTradingViewColors();

  try {
    chart.setCSSCustomProperty('--tv-color-platform-background', bgDarkColor);
    chart.setCSSCustomProperty('--tv-color-pane-background', bgDarkColor);
    chart.setCSSCustomProperty('--tv-color-background', bgDarkColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-background-hover', bgLightColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-background-expanded', borderColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-background-active', borderLightColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-background-active-hover', borderLightColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-text', textSecondaryColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-text-hover', textPrimaryColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-text-active', textPrimaryColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-button-text-active-hover', textPrimaryColor);
    chart.setCSSCustomProperty('--tv-color-item-active-text', textPrimaryColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-toggle-button-background-active', accentBlueColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-toggle-button-background-active-hover', accentBlueColor);
    chart.setCSSCustomProperty('--tv-color-toolbar-divider-background', borderColor);
    chart.setCSSCustomProperty('--tv-color-popup-background', bgLightColor);
    chart.setCSSCustomProperty('--tv-color-popup-element-text', textSecondaryColor);
    chart.setCSSCustomProperty('--tv-color-popup-element-text-hover', textPrimaryColor);
    chart.setCSSCustomProperty('--tv-color-popup-element-background-hover', borderColor);
    chart.setCSSCustomProperty('--tv-color-popup-element-divider-background', borderColor);
    chart.setCSSCustomProperty('--tv-color-popup-element-secondary-text', textSecondaryColor);
    chart.setCSSCustomProperty('--tv-color-buy-button', accentGreenColor);
    chart.setCSSCustomProperty('--tv-color-sell-button', accentRedColor);
    chart.setCSSCustomProperty('--themed-color-buy-btn-chart', accentGreenColor);
    chart.setCSSCustomProperty('--themed-color-sell-btn-chart', accentRedColor);
  } catch (e) {
    console.warn('[TradingViewTheme] Error updating CSS properties:', e);
  }
}; 