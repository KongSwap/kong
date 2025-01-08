// See https://kit.svelte.dev/docs/types#app
declare global {
  interface CanisterIdIcpLedger {
    [key: string]: any;
  }
  
  const CANISTER_ID_ICP_LEDGER: CanisterIdIcpLedger;

  interface Result<T> {
    Ok?: T;
    Err?: string;
  }
}

export {};
