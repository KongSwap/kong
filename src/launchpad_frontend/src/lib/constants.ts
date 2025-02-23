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

// Production canister IDs
export const canisterIds: CanisterIds = {
  launchpad_backend: {
    ic: "pdisl-kiaaa-aaaag-atzwa-cai",
    local: "bd3sg-teaaa-aaaaa-qaaba-cai"
  },
  launchpad_frontend: {
    ic: "p5o2f-3aaaa-aaaag-atzwq-cai",
    local: "be2us-64aaa-aaaaa-qaabq-cai"
  },
  kong_ledger: {
    ic: "o7oak-iyaaa-aaaaq-aadzq-cai",
    local: "bkyz2-fmaaa-aaaaa-qaaaq-cai"
  }
}; 
