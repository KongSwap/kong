/**
 * Formats token names for display, handling long names with special characters
 * @param name The token name to format
 * @param maxLength Maximum length before truncation (default: 20)
 * @returns Formatted token name
 */
export function formatTokenName(name: string, maxLength: number = 20): string {
  if (!name) return '';
  
  // If the name is short enough, return as-is
  if (name.length <= maxLength) {
    return name;
  }
  
  // For names with bullet separators (•), try to truncate intelligently
  if (name.includes('•')) {
    const parts = name.split('•');
    
    // If it's an ODIN token with the GHOSTNODE pattern
    if (parts.length >= 4 && parts[parts.length - 1] === 'ODIN') {
      // Keep first part and ODIN, truncate middle
      const firstPart = parts[0];
      const lastPart = 'ODIN';
      
      // Calculate how much space we have for the first part
      const availableSpace = maxLength - lastPart.length - 3; // -3 for "..."
      
      if (firstPart.length <= availableSpace) {
        return `${firstPart}...${lastPart}`;
      } else {
        // Truncate the first part too
        return `${firstPart.substring(0, availableSpace - 3)}...${lastPart}`;
      }
    }
    
    // For other bullet-separated names, show first and last parts
    if (parts.length >= 2) {
      const firstPart = parts[0];
      const lastPart = parts[parts.length - 1];
      const totalLength = firstPart.length + lastPart.length + 3; // +3 for "..."
      
      if (totalLength <= maxLength) {
        return `${firstPart}...${lastPart}`;
      }
    }
  }
  
  // Default truncation: show beginning and end
  const startLength = Math.floor((maxLength - 3) / 2);
  const endLength = Math.ceil((maxLength - 3) / 2);
  
  return `${name.substring(0, startLength)}...${name.substring(name.length - endLength)}`;
}

/**
 * Gets a display name for a token, preferring symbol for common cases
 * @param token The token object
 * @param preferSymbol Whether to prefer symbol over name (default: true)
 * @returns Display name for the token
 */
export function getTokenDisplayName(token: Kong.Token | null, preferSymbol: boolean = true): string {
  if (!token) return '';
  
  // For well-known tokens or when preferring symbols, use symbol
  if (preferSymbol && token.symbol && token.symbol.length <= 10) {
    return token.symbol;
  }
  
  // For tokens with very long names, format them
  return formatTokenName(token.name);
}

/**
 * Formats token name and symbol for display together
 * @param token The token object
 * @param format How to format the display
 * @returns Formatted string with name and symbol
 */
export function formatTokenNameWithSymbol(
  token: Kong.Token | null, 
  format: 'name-symbol' | 'symbol-name' | 'name-only' | 'symbol-only' = 'name-symbol'
): string {
  if (!token) return '';
  
  const formattedName = formatTokenName(token.name);
  
  switch (format) {
    case 'name-symbol':
      return `${formattedName} (${token.symbol})`;
    case 'symbol-name':
      return `${token.symbol} - ${formattedName}`;
    case 'name-only':
      return formattedName;
    case 'symbol-only':
      return token.symbol;
    default:
      return formattedName;
  }
}