import { derived } from "svelte/store";
import { themeStore } from "$lib/stores/themeStore";
import { getThemeById } from "$lib/themes/themeRegistry";

// Base derived store for the current theme object
const currentTheme = derived(themeStore, ($themeStore) => getThemeById($themeStore));

// Export derived stores for specific theme properties
export const themeColors = derived(currentTheme, ($theme) => $theme.colors);

export const themeId = derived(currentTheme, ($theme) => $theme.id);

// Example derived color properties (add more as needed)
export const primaryColor = derived(themeColors, ($colors) => $colors?.primary ?? 'rgba(55, 114, 255, 0.95)');
export const secondaryColor = derived(themeColors, ($colors) => $colors?.secondary ?? 'rgba(111, 66, 193, 0.95)');
export const errorColorStart = derived(themeColors, ($colors) => ($colors as any)?.error ?? 'rgba(239, 68, 68, 0.9)');
export const errorColorEnd = derived(themeColors, ($colors) => ($colors as any)?.errorDark ?? 'rgba(239, 68, 68, 0.8)');
export const processingColorStart = derived(themeColors, ($colors) => ($colors as any)?.info ?? '#3772ff');
export const processingColorEnd = derived(themeColors, ($colors) => ($colors as any)?.infoLight ?? '#4580ff');
export const buttonBorderColor = derived(themeColors, ($colors) => $colors?.borderLight ?? 'rgba(255, 255, 255, 0.12)');
export const glowEffectColor = derived(themeColors, ($colors) => ($colors as any)?.highlight ?? 'rgba(255, 255, 255, 0.2)');

// Derived properties for SwapPanel
export const swapPanelRoundness = derived(themeColors, ($colors) => ($colors as any)?.swapPanelRoundness ?? 'rounded-lg');
export const swapPanelBorder = derived(themeColors, ($colors) => ($colors as any)?.swapPanelBorder ?? '1px solid rgba(255, 255, 255, 0.1)');
export const swapPanelShadow = derived(themeColors, ($colors) => ($colors as any)?.swapPanelShadow ?? '0 8px 32px rgba(0, 0, 0, 0.32)');
export const swapPanelBorderStyle = derived(themeColors, ($colors) => ($colors as any)?.swapPanelBorderStyle ?? 'default');
export const swapPanelInputsRounded = derived(themeColors, ($colors) => (($colors as any)?.swapPanelInputsRounded ?? true));
export const transparentSwapPanel = derived(themeColors, ($colors) => (($colors as any)?.transparentSwapPanel ?? true)); 