/**
 * Truncates a string in the middle, replacing the middle portion with ellipsis
 * 
 * @param str The string to truncate
 * @param maxLength The maximum length of characters to show (excluding ellipsis)
 * @returns The truncated string with ellipsis in the middle
 */
export function truncateMiddle(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  
  const halfLength = Math.floor(maxLength / 2);
  const firstHalf = str.substring(0, halfLength);
  const secondHalf = str.substring(str.length - halfLength);
  
  return `${firstHalf}...${secondHalf}`;
} 