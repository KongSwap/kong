/**
 * Formats an ICP amount into a human-readable string
 * 
 * @param icp The amount of ICP in e8s (1 ICP = 10^8 e8s)
 * @returns A formatted string representation of the ICP amount
 */
export function formatICP(icp: bigint): string {
  // Convert e8s to ICP
  const icpValue = Number(icp) / 100_000_000;
  
  // Format with 8 decimal places maximum, but trim trailing zeros
  return `${icpValue.toFixed(8).replace(/\.?0+$/, '')} ICP`;
}

/**
 * Converts ICP to e8s
 * 
 * @param icp The amount of ICP as a number
 * @returns The amount in e8s as a bigint
 */
export function icpToE8s(icp: number): bigint {
  return BigInt(Math.floor(icp * 100_000_000));
}

/**
 * Converts e8s to ICP
 * 
 * @param e8s The amount in e8s as a bigint
 * @returns The amount of ICP as a number
 */
export function e8sToICP(e8s: bigint): number {
  return Number(e8s) / 100_000_000;
} 
