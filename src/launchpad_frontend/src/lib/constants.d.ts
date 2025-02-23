export interface CanisterIds {
  launchpad_backend: {
    ic: string;
    local: string;
  };
  launchpad_frontend: {
    ic: string;
    local: string;
  };
  kong_ledger: {
    ic: string;
    local: string;
  };
}

export const canisterIds: CanisterIds; 
