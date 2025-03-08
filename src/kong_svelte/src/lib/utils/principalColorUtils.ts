/**
 * Generates a consistent color from a principal ID using a hash function
 * @param principalId The principal ID to generate a color for
 * @returns An HSL color string
 */
export function getPrincipalColor(principalId: string): string {
  // Use a simple hash function to generate a number from the string
  const hash = principalId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const hue = Math.abs(hash % 360);
  
  // Check if we're in dark mode
  const isDarkMode = document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('plain-black');
  
  if (isDarkMode) {
    // Dark mode: More saturated, darker colors
    return `hsl(${hue}, 70%, 25%)`;
  } else {
    // Light mode: Less saturated, lighter colors
    return `hsl(${hue}, 60%, 75%)`;
  }
} 