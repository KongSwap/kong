// Production canister IDs
export const canisterIds = {
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

export const API_ENDPOINTS = {
    CREATE_TOKEN: '/api/create-token',
    GET_BALANCE: '/api/get-balance',
    TRANSFER: '/api/transfer',
}; 
