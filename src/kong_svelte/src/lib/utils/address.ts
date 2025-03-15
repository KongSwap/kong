/**
 * Truncates an address for display purposes, showing only the first few and last few characters.
 * 
 * @param address The address to truncate
 * @returns Truncated address in the format "first6...last4"
 */
export function truncateAddress(address: string): string {
  if (typeof address !== "string") {
    return "";
  }
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
