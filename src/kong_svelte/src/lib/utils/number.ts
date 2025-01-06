export function formatNumber(
  value: number,
  decimals: number = 2,
  includeCommaSeparator: boolean = true
): string {
  if (!value && value !== 0) return "0";

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: includeCommaSeparator,
  });

  return formatter.format(value);
} 