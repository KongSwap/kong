import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ params }) => {
  // Parse the pool ID - expected format: "address0_address1" or legacy "address0-address1"
  // We need to handle full canister IDs which contain hyphens
  
  let address0: string;
  let address1: string;
  
  // Check if it's using underscore separator (new format)
  if (params.id.includes('_')) {
    [address0, address1] = params.id.split('_');
  } else {
    // Legacy format or need to parse differently
    // For canister IDs like "ryjl3-tyaaa-aaaaa-aaaba-cai-cngnf-vqaaa-aaaar-qag4q-cai"
    // We need to find where one ID ends and the other begins
    
    // Common pattern: IDs ending with "-cai" 
    const parts = params.id.split('-cai-');
    if (parts.length === 2) {
      address0 = parts[0] + '-cai';
      address1 = parts[1];
    } else {
      // Fallback: try to split in the middle if we have an even number of segments
      const segments = params.id.split('-');
      const midpoint = Math.floor(segments.length / 2);
      address0 = segments.slice(0, midpoint).join('-');
      address1 = segments.slice(midpoint).join('-');
    }
  }
  
  if (!address0 || !address1) {
    throw new Error('Invalid pool ID format');
  }
  
  return {
    poolId: params.id,
    address0,
    address1
  };
};
