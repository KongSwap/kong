
export function isMobileBrowser(): boolean {
  if (!navigator) return false;
  
  // First check if it's running as a PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
    || (window.navigator as any).standalone 
    || document.referrer.includes('android-app://');

  // If it's a PWA, don't treat as mobile
  if (isStandalone) return false;

  // Otherwise check if it's a mobile browser
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
} 