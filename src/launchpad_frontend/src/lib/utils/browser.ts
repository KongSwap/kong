// src/launchpad_frontend/src/lib/utils/browser.ts

export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Regular expressions for mobile devices
  const mobileRegex = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i
  ];
  
  return mobileRegex.some((regex) => regex.test(userAgent));
}

export function isPwa(): boolean {
  if (typeof window === 'undefined') return false;
  
  // iOS detection
  const isInStandaloneMode = ('standalone' in window.navigator) && 
                            ((window.navigator as any).standalone === true);
  
  // Android/Desktop PWA detection
  const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Chrome on Android detection
  const isAndroidPwa = document.referrer.includes('android-app://');
  
  return isInStandaloneMode || isDisplayModeStandalone || isAndroidPwa;
}

export const isPlugAvailable = () => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).ic;
}; 
