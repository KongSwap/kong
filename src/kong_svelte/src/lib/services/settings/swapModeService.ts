const SWAP_MODE_KEY = 'kong_swap_mode';

export type SwapMode = 'basic' | 'pro';

export const swapModeService = {
  getLastMode(): SwapMode {
    try {
      return (localStorage.getItem(SWAP_MODE_KEY) as SwapMode) || 'basic';
    } catch {
      return 'basic';
    }
  },

  saveMode(mode: SwapMode) {
    try {
      localStorage.setItem(SWAP_MODE_KEY, mode);
    } catch (error) {
      console.warn('Failed to save swap mode:', error);
    }
  }
}; 