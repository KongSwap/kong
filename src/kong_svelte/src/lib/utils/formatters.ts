/**
 * Format a USD volume value into a human-readable string with appropriate suffixes
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  } else if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(2)}K`;
  } else {
    return `$${volume.toFixed(2)}`;
  }
}

/**
 * Format a principal ID to a shortened display version if too long
 */
export function formatPrincipalId(id: string): string {
  if (!id) return '';
  if (id.length <= 15) return id;
  return `${id.substring(0, 5)}...${id.substring(id.length - 5)}`;
}

/**
 * Format a number with commas for thousands separators
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a timestamp to a readable string
 */
export function formatTimestamp(timestamp: number): string {
  return formatDate(new Date(timestamp));
} 