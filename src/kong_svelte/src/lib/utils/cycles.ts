/**
 * Formats a cycles amount into a human-readable string
 * 
 * @param cycles The amount of cycles as a bigint
 * @returns A formatted string representation of the cycles amount
 */
export function formatCycles(cycles: bigint): string {
  // Define cycle units
  const trillion = 1_000_000_000_000n;
  const billion = 1_000_000_000n;
  const million = 1_000_000n;
  const thousand = 1_000n;
  
  // Format based on magnitude
  if (cycles >= trillion) {
    const trillions = Number(cycles / trillion) + Number((cycles % trillion) * 1000n / trillion) / 1000;
    return `${trillions.toFixed(3)} T cycles`;
  } else if (cycles >= billion) {
    const billions = Number(cycles / billion) + Number((cycles % billion) * 1000n / billion) / 1000;
    return `${billions.toFixed(3)} B cycles`;
  } else if (cycles >= million) {
    const millions = Number(cycles / million) + Number((cycles % million) * 1000n / million) / 1000;
    return `${millions.toFixed(3)} M cycles`;
  } else if (cycles >= thousand) {
    const thousands = Number(cycles / thousand) + Number((cycles % thousand) * 1000n / thousand) / 1000;
    return `${thousands.toFixed(3)} K cycles`;
  } else {
    return `${cycles.toString()} cycles`;
  }
}

/**
 * Parses a human-readable cycles string into a bigint
 * 
 * @param cyclesStr A formatted string representation of cycles (e.g., "1.5 T cycles")
 * @returns The amount of cycles as a bigint
 */
export function parseCycles(cyclesStr: string): bigint {
  // Remove "cycles" and trim whitespace
  const str = cyclesStr.replace('cycles', '').trim();
  
  // Check for units
  if (str.includes('T')) {
    const num = parseFloat(str.replace('T', '').trim());
    return BigInt(Math.floor(num * 1_000_000_000_000));
  } else if (str.includes('B')) {
    const num = parseFloat(str.replace('B', '').trim());
    return BigInt(Math.floor(num * 1_000_000_000));
  } else if (str.includes('M')) {
    const num = parseFloat(str.replace('M', '').trim());
    return BigInt(Math.floor(num * 1_000_000));
  } else if (str.includes('K')) {
    const num = parseFloat(str.replace('K', '').trim());
    return BigInt(Math.floor(num * 1_000));
  } else {
    return BigInt(str);
  }
} 
